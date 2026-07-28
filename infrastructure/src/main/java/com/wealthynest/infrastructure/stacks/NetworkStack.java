package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.constructs.LogRetentionMapper;
import java.util.ArrayList;
import java.util.List;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.ec2.FlowLogDestination;
import software.amazon.awscdk.services.ec2.FlowLogOptions;
import software.amazon.awscdk.services.ec2.FlowLogTrafficType;
import software.amazon.awscdk.services.ec2.InterfaceVpcEndpoint;
import software.amazon.awscdk.services.ec2.InterfaceVpcEndpointAwsService;
import software.amazon.awscdk.services.ec2.InterfaceVpcEndpointOptions;
import software.amazon.awscdk.services.ec2.IVpc;
import software.amazon.awscdk.services.ec2.IpAddresses;
import software.amazon.awscdk.services.ec2.SecurityGroup;
import software.amazon.awscdk.services.ec2.SubnetConfiguration;
import software.amazon.awscdk.services.ec2.SubnetSelection;
import software.amazon.awscdk.services.ec2.SubnetType;
import software.amazon.awscdk.services.ec2.Vpc;
import software.amazon.awscdk.services.logs.LogGroup;
import software.constructs.Construct;

/**
 * VPC, subnets, and internet egress. The app server lives in a public subnet (fronted by
 * Cloudflare + its own security group, not an internal ALB), so RDS/ElastiCache only need
 * PRIVATE_ISOLATED subnets — no NAT Gateway is required for this topology, which is why
 * {@code natGatewayEnabled} defaults to {@code false} in {@code cdk.json}. Flip it on and a
 * PRIVATE_WITH_EGRESS subnet group is added for any future compute that needs outbound internet
 * without a public IP.
 *
 * <p>AZs come from explicit config ({@code availabilityZones}) rather than CDK's dynamic
 * {@code Vpc.maxAzs} lookup - this app always deploys to one specific, known account/region, so
 * there's nothing "agnostic" to resolve; a dynamic lookup would need the deploying principal to
 * have {@code ec2:DescribeAvailabilityZones} and would cache its answer into a committed
 * {@code cdk.context.json}, which is more moving parts for zero benefit here.
 */
public class NetworkStack extends Stack {

    private final IVpc vpc;
    private final InterfaceVpcEndpoint secretsManagerEndpoint;
    private final SecurityGroup secretsManagerEndpointSecurityGroup;

    public NetworkStack(Construct scope, String id, StackProps props, AppConfig config) {
        super(scope, id, props);

        List<SubnetConfiguration> subnetConfigurations = new ArrayList<>();
        subnetConfigurations.add(SubnetConfiguration.builder()
            .name("public")
            .subnetType(SubnetType.PUBLIC)
            .cidrMask(24)
            .build());
        subnetConfigurations.add(SubnetConfiguration.builder()
            .name("private-isolated")
            .subnetType(SubnetType.PRIVATE_ISOLATED)
            .cidrMask(24)
            .build());
        if (config.network().natGatewayEnabled()) {
            subnetConfigurations.add(SubnetConfiguration.builder()
                .name("private-egress")
                .subnetType(SubnetType.PRIVATE_WITH_EGRESS)
                .cidrMask(24)
                .build());
        }

        Vpc vpc = Vpc.Builder.create(this, "Vpc")
            .vpcName(config.resourceName("vpc"))
            .ipAddresses(IpAddresses.cidr(config.network().vpcCidr()))
            .availabilityZones(config.network().availabilityZones())
            .natGateways(config.network().natGatewayEnabled() ? 1 : 0)
            .subnetConfiguration(subnetConfigurations)
            .build();

        // ALL traffic (accepted and rejected), not just rejected - accepted-traffic records are
        // what let you reconstruct "what actually talked to what" during an incident, not just
        // "what got blocked". CDK auto-creates the IAM role this needs to write to the log group.
        LogGroup flowLogGroup = LogGroup.Builder.create(this, "VpcFlowLogGroup")
            .logGroupName("/wealthynest/" + config.envName() + "/vpc-flow-logs")
            .retention(LogRetentionMapper.fromDays(config.monitoring().logRetentionDays()))
            .build();
        vpc.addFlowLog("FlowLog", FlowLogOptions.builder()
            .destination(FlowLogDestination.toCloudWatchLogs(flowLogGroup))
            .trafficType(FlowLogTrafficType.ALL)
            .build());

        // PRIVATE_ISOLATED has no internet route by design, so the DB-credential rotation Lambda
        // DatabaseStack runs there needs a private path to Secrets Manager's API - a VPC interface
        // endpoint (PrivateLink), not a NAT Gateway just for this one call. Built here (not in
        // DatabaseStack) for the same reason FlowLog above and ComputeStack's ingress rules live
        // where their L2 method is actually defined: IVpc.addInterfaceEndpoint() creates the
        // resulting resource as a child of the VPC construct, i.e. in whichever stack owns the
        // VPC - calling it from DatabaseStack would silently make this a NetworkStack resource
        // anyway, just less legibly. No `open` flag - ingress is opened explicitly, per-consumer,
        // by whichever stack owns that consumer's security group (DatabaseStack, for the rotation
        // Lambda), the same explicit-ingress convention used everywhere else in this app.
        this.secretsManagerEndpointSecurityGroup = SecurityGroup.Builder.create(this, "SecretsManagerEndpointSecurityGroup")
            .vpc(vpc)
            .description("WealthyNest Secrets Manager VPC interface endpoint - ingress opened per-consumer")
            .allowAllOutbound(false)
            .build();
        this.secretsManagerEndpoint = vpc.addInterfaceEndpoint("SecretsManagerEndpoint", InterfaceVpcEndpointOptions.builder()
            .service(InterfaceVpcEndpointAwsService.SECRETS_MANAGER)
            .subnets(SubnetSelection.builder().subnetType(SubnetType.PRIVATE_ISOLATED).build())
            .securityGroups(List.of(secretsManagerEndpointSecurityGroup))
            .open(false)
            .build());

        this.vpc = vpc;
    }

    public IVpc getVpc() {
        return vpc;
    }

    public InterfaceVpcEndpoint getSecretsManagerEndpoint() {
        return secretsManagerEndpoint;
    }

    public SecurityGroup getSecretsManagerEndpointSecurityGroup() {
        return secretsManagerEndpointSecurityGroup;
    }
}
