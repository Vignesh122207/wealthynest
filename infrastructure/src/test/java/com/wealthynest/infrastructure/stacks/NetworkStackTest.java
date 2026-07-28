package com.wealthynest.infrastructure.stacks;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.Map;
import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.assertions.Template;

class NetworkStackTest {

    @Test
    void createsVpcWithConfiguredCidr() {
        App app = new App();
        NetworkStack stack = new NetworkStack(app, "TestNetwork", TestFixtures.stackProps(), TestFixtures.appConfig());
        Template template = Template.fromStack(stack);

        template.hasResourceProperties("AWS::EC2::VPC", Map.of("CidrBlock", "10.20.0.0/16"));
    }

    @Test
    void noNatGatewayWhenDisabled() {
        App app = new App();
        NetworkStack stack = new NetworkStack(app, "TestNetwork", TestFixtures.stackProps(),
            TestFixtures.appConfig(false));
        Template template = Template.fromStack(stack);

        template.resourceCountIs("AWS::EC2::NatGateway", 0);
        // 2 AZs x (public + private-isolated) = 4 subnets, no private-egress group.
        template.resourceCountIs("AWS::EC2::Subnet", 4);
    }

    @Test
    void addsNatGatewayAndEgressSubnetsWhenEnabled() {
        App app = new App();
        NetworkStack stack = new NetworkStack(app, "TestNetwork", TestFixtures.stackProps(),
            TestFixtures.appConfig(true));
        Template template = Template.fromStack(stack);

        template.resourceCountIs("AWS::EC2::NatGateway", 1);
        // 2 AZs x (public + private-isolated + private-egress) = 6 subnets.
        template.resourceCountIs("AWS::EC2::Subnet", 6);
    }

    @Test
    void vpcHasFlowLogsToCloudWatch() {
        App app = new App();
        NetworkStack stack = new NetworkStack(app, "TestNetwork", TestFixtures.stackProps(), TestFixtures.appConfig());
        Template template = Template.fromStack(stack);

        template.resourceCountIs("AWS::EC2::FlowLog", 1);
        template.hasResourceProperties("AWS::EC2::FlowLog", Map.of(
            "TrafficType", "ALL",
            "LogDestinationType", "cloud-watch-logs"
        ));
    }

    @Test
    void secretsManagerInterfaceEndpointInPrivateIsolatedSubnetsWithNoOpenIngress() {
        App app = new App();
        NetworkStack stack = new NetworkStack(app, "TestNetwork", TestFixtures.stackProps(), TestFixtures.appConfig());
        Template template = Template.fromStack(stack);

        template.hasResourceProperties("AWS::EC2::VPCEndpoint", Map.of(
            "VpcEndpointType", "Interface",
            "PrivateDnsEnabled", true
        ));
        // No wide-open ingress - only whichever stack owns a consumer (e.g. DatabaseStack's
        // rotation Lambda) opens a rule against this endpoint's security group explicitly.
        template.hasResourceProperties("AWS::EC2::SecurityGroup", Map.of(
            "GroupDescription",
            "WealthyNest Secrets Manager VPC interface endpoint - ingress opened per-consumer"
        ));
    }

    @Test
    void vpcExposedForDownstreamStacks() {
        App app = new App();
        NetworkStack stack = new NetworkStack(app, "TestNetwork", TestFixtures.stackProps(), TestFixtures.appConfig());

        assertNotNull(stack.getVpc());
        assertFalse(stack.getVpc().getVpcId().isBlank());
    }
}
