package com.wealthynest.infrastructure.constructs;

import java.util.List;
import software.amazon.awscdk.Tags;
import software.amazon.awscdk.services.ec2.BlockDevice;
import software.amazon.awscdk.services.ec2.BlockDeviceVolume;
import software.amazon.awscdk.services.ec2.CfnEIP;
import software.amazon.awscdk.services.ec2.CfnEIPAssociation;
import software.amazon.awscdk.services.ec2.EbsDeviceOptions;
import software.amazon.awscdk.services.ec2.EbsDeviceVolumeType;
import software.amazon.awscdk.services.ec2.IVpc;
import software.amazon.awscdk.services.ec2.Instance;
import software.amazon.awscdk.services.ec2.InstanceType;
import software.amazon.awscdk.services.ec2.MachineImage;
import software.amazon.awscdk.services.ec2.OperatingSystemType;
import software.amazon.awscdk.services.ec2.Peer;
import software.amazon.awscdk.services.ec2.Port;
import software.amazon.awscdk.services.ec2.SecurityGroup;
import software.amazon.awscdk.services.ec2.SsmParameterImageOptions;
import software.amazon.awscdk.services.ec2.SubnetSelection;
import software.amazon.awscdk.services.ec2.SubnetType;
import software.amazon.awscdk.services.ec2.UserData;
import software.amazon.awscdk.services.iam.ManagedPolicy;
import software.amazon.awscdk.services.iam.Role;
import software.amazon.awscdk.services.iam.ServicePrincipal;
import software.amazon.awscdk.services.kms.IKey;
import software.constructs.Construct;

/**
 * A hardened, internet-facing EC2 app server: Ubuntu LTS resolved via Canonical's public SSM AMI
 * parameter, pinned to a specific dated build rather than {@code current} (see
 * {@link #PINNED_UBUNTU_BUILD}), an Elastic IP, an IAM role scoped for SSM Session Manager +
 * CloudWatch Agent only (application permissions are granted separately by whichever stack owns
 * the resource being granted), and a security group that accepts inbound HTTP/HTTPS from
 * Cloudflare's published edge ranges only — never SSH, never 0.0.0.0/0.
 */
public final class Ec2AppServerConstruct extends Construct {

    // `current` resolves fresh on every `cdk deploy`, not just when someone deliberately bumps
    // it - Canonical republishes it every few weeks. `ImageId` is an immutable EC2 instance
    // property, so any drift forces a replacement on the *next* deploy regardless of what that
    // deploy's actual code change was, and that replacement isn't guaranteed to succeed (see the
    // 2026-08-01 incident: it got blocked by CicdStack/MonitoringStack still importing the old
    // instance's exported Ref, and rolled back). Pin to a known-good dated build here instead;
    // bump it deliberately, in its own reviewed change, when you want to move to a newer one -
    // check available dates with `aws ssm get-parameters-by-path --recursive --path
    // /aws/service/canonical/ubuntu/server/26.04/stable`.
    private static final String PINNED_UBUNTU_BUILD = "20260731";

    private final Instance instance;
    private final Role role;
    private final SecurityGroup securityGroup;
    private final CfnEIP elasticIp;

    public Ec2AppServerConstruct(Construct scope, String id, Props props) {
        super(scope, id);

        this.securityGroup = SecurityGroup.Builder.create(this, "SecurityGroup")
            .vpc(props.vpc())
            .securityGroupName(props.securityGroupName())
            .description("WealthyNest backend app server - HTTP/HTTPS from Cloudflare edge only, no SSH")
            .allowAllOutbound(true)
            .build();
        addCloudflareIngress(props);

        this.role = Role.Builder.create(this, "InstanceRole")
            .assumedBy(new ServicePrincipal("ec2.amazonaws.com"))
            .description(
                "WealthyNest backend EC2 role: SSM Session Manager + CloudWatch Agent only. "
                    + "Application-data permissions (Secrets Manager, S3) are granted by the "
                    + "stacks that own those resources, not declared here, to keep each grant "
                    + "auditable at its source.")
            .managedPolicies(List.of(
                ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
                ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy")
            ))
            .build();

        this.instance = Instance.Builder.create(this, "Instance")
            .vpc(props.vpc())
            .vpcSubnets(SubnetSelection.builder().subnetType(SubnetType.PUBLIC).build())
            .instanceType(new InstanceType(props.instanceType()))
            .machineImage(MachineImage.fromSsmParameter(
                amiParameterPath(props.architecture()),
                SsmParameterImageOptions.builder().os(OperatingSystemType.LINUX).build()
            ))
            .securityGroup(securityGroup)
            .role(role)
            .requireImdsv2(true)
            .blockDevices(List.of(
                BlockDevice.builder()
                    .deviceName("/dev/sda1")
                    .volume(BlockDeviceVolume.ebs(props.rootVolumeGb(), EbsDeviceOptions.builder()
                        .volumeType(EbsDeviceVolumeType.GP3)
                        .encrypted(true)
                        .kmsKey(props.ebsKmsKey())
                        .deleteOnTermination(true)
                        .build()))
                    .build()
            ))
            .userData(props.userData())
            .build();
        Tags.of(instance).add("Name", props.nameTag());

        this.elasticIp = CfnEIP.Builder.create(this, "ElasticIp")
            .domain("vpc")
            .build();
        CfnEIPAssociation.Builder.create(this, "ElasticIpAssociation")
            .allocationId(elasticIp.getAttrAllocationId())
            .instanceId(instance.getInstanceId())
            .build();
    }

    private void addCloudflareIngress(Props props) {
        for (String cidr : props.cloudflareIpv4Ranges()) {
            securityGroup.addIngressRule(Peer.ipv4(cidr), Port.tcp(443), "Cloudflare edge HTTPS " + cidr);
            securityGroup.addIngressRule(Peer.ipv4(cidr), Port.tcp(80), "Cloudflare edge HTTP (redirect) " + cidr);
        }
        for (String cidr : props.cloudflareIpv6Ranges()) {
            securityGroup.addIngressRule(Peer.ipv6(cidr), Port.tcp(443), "Cloudflare edge HTTPS " + cidr);
            securityGroup.addIngressRule(Peer.ipv6(cidr), Port.tcp(80), "Cloudflare edge HTTP (redirect) " + cidr);
        }
        if (props.hasAdminCidr()) {
            securityGroup.addIngressRule(
                Peer.ipv4(props.adminCidrForSsm()),
                Port.tcp(443),
                "Direct admin HTTPS access, bypassing Cloudflare (break-glass debugging only)"
            );
        }
    }

    private static String amiParameterPath(String architecture) {
        String archSegment = switch (architecture) {
            case "arm64" -> "arm64";
            case "x86_64" -> "amd64";
            default -> throw new IllegalArgumentException(
                "Unsupported ec2Architecture '%s' - expected 'arm64' or 'x86_64'".formatted(architecture));
        };
        return "/aws/service/canonical/ubuntu/server/26.04/stable/%s/%s/hvm/ebs-gp3/ami-id"
            .formatted(PINNED_UBUNTU_BUILD, archSegment);
    }

    public Instance getInstance() {
        return instance;
    }

    public Role getRole() {
        return role;
    }

    public SecurityGroup getSecurityGroup() {
        return securityGroup;
    }

    /** Public IP address of the instance (a CDK token) - {@code AWS::EC2::EIP}'s Ref *is* the IP. */
    public String getPublicIp() {
        return elasticIp.getRef();
    }

    public record Props(
        IVpc vpc,
        String instanceType,
        String architecture,
        int rootVolumeGb,
        List<String> cloudflareIpv4Ranges,
        List<String> cloudflareIpv6Ranges,
        String adminCidrForSsm,
        UserData userData,
        IKey ebsKmsKey,
        String nameTag,
        String securityGroupName
    ) {
        public boolean hasAdminCidr() {
            return adminCidrForSsm != null && !adminCidrForSsm.isBlank();
        }
    }
}
