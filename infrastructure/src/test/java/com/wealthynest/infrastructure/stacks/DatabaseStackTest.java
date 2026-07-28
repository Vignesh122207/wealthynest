package com.wealthynest.infrastructure.stacks;

import java.util.Map;
import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.assertions.Match;
import software.amazon.awscdk.assertions.Template;

class DatabaseStackTest {

    private static DatabaseStack buildStack(App app) {
        NetworkStack network = new NetworkStack(app, "TestNetwork", TestFixtures.stackProps(), TestFixtures.appConfig());
        SecurityStack security = new SecurityStack(app, "TestSecurity", TestFixtures.stackProps(), TestFixtures.appConfig());
        return new DatabaseStack(app, "TestDatabase", TestFixtures.stackProps(), TestFixtures.appConfig(),
            network.getVpc(), security.getDatabaseCredentialsSecret(),
            network.getSecretsManagerEndpointSecurityGroup());
    }

    @Test
    void databaseCredentialsSecretIsAttachedToTheDbInstance() {
        App app = new App();
        Template template = Template.fromStack(buildStack(app));

        template.resourceCountIs("AWS::SecretsManager::SecretTargetAttachment", 1);
        template.hasResourceProperties("AWS::SecretsManager::SecretTargetAttachment", Map.of(
            "TargetType", "AWS::RDS::DBInstance"
        ));
    }

    @Test
    void dbCredentialsRotateOnTheConfiguredSchedule() {
        App app = new App();
        Template template = Template.fromStack(buildStack(app));

        // 30 comes from TestFixtures.appConfig()'s DatabaseConfig.credentialRotationDays. Rendered
        // as a rate expression, not AutomaticallyAfterDays, because Duration.days() resolves to
        // ScheduleExpression under the hood.
        template.hasResourceProperties("AWS::SecretsManager::RotationSchedule", Map.of(
            "RotationRules", Map.of("ScheduleExpression", "rate(30 days)")
        ));
    }

    @Test
    void rotationLambdaCanReachOnlyRdsAndTheSecretsManagerEndpoint() {
        App app = new App();
        Template template = Template.fromStack(buildStack(app));

        template.hasResourceProperties("AWS::EC2::SecurityGroupIngress", Map.of(
            "FromPort", 5432, "ToPort", 5432, "IpProtocol", "tcp"
        ));
        template.hasResourceProperties("AWS::EC2::SecurityGroupIngress", Map.of(
            "FromPort", 443, "ToPort", 443, "IpProtocol", "tcp"
        ));
        // Exactly 2: the rotation Lambda's own two ingress grants - RDS and the SM endpoint.
        // ComputeStack's DatabaseIngressFromAppServer/CacheIngressFromAppServer rules live in
        // ComputeStack's own template, not this one, so they don't add to this count.
        template.resourceCountIs("AWS::EC2::SecurityGroupIngress", 2);
    }

    @Test
    void rotationLambdaSecurityGroupIsDedicatedNotShared() {
        App app = new App();
        Template template = Template.fromStack(buildStack(app));

        template.hasResourceProperties("AWS::EC2::SecurityGroup", Match.objectLike(Map.of(
            "GroupDescription", Match.stringLikeRegexp(".*rotation Lambda.*")
        )));
    }
}
