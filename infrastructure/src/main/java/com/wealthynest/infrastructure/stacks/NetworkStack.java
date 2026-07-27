package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import java.util.ArrayList;
import java.util.List;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.ec2.IVpc;
import software.amazon.awscdk.services.ec2.IpAddresses;
import software.amazon.awscdk.services.ec2.SubnetConfiguration;
import software.amazon.awscdk.services.ec2.SubnetType;
import software.amazon.awscdk.services.ec2.Vpc;
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

        this.vpc = Vpc.Builder.create(this, "Vpc")
            .vpcName(config.resourceName("vpc"))
            .ipAddresses(IpAddresses.cidr(config.network().vpcCidr()))
            .availabilityZones(config.network().availabilityZones())
            .natGateways(config.network().natGatewayEnabled() ? 1 : 0)
            .subnetConfiguration(subnetConfigurations)
            .build();
    }

    public IVpc getVpc() {
        return vpc;
    }
}
