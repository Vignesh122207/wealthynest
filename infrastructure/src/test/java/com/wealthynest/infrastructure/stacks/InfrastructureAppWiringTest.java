package com.wealthynest.infrastructure.stacks;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.config.AppSecrets;
import java.util.Map;
import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.assertions.Template;

/**
 * Builds all 7 stacks with the exact same wiring {@code InfrastructureApp.main} uses and calls
 * {@code app.synth()}. This is the regression test for the cyclic-stack-dependency class of bug:
 * {@code DatabaseInstance} unconditionally attaching its credentials secret to itself (creating a
 * resource in whichever stack owns the secret that references the DB instance) means the wiring
 * direction between SecurityStack/DatabaseStack/ComputeStack is load-bearing, not a style choice -
 * getting it backwards fails at synth time, not at compile time, so nothing but an actual synth
 * catches it.
 */
class InfrastructureAppWiringTest {

    @Test
    void fullAppSynthesizesWithoutACyclicDependency() {
        assertDoesNotThrow(InfrastructureAppWiringTest::buildAndSynth);
    }

    @Test
    void databaseIsPrivateEncryptedAndProtected() {
        App app = new App();
        DatabaseStack database = wireUpTo(app).database();

        Template.fromStack(database).hasResourceProperties("AWS::RDS::DBInstance", Map.of(
            "StorageEncrypted", true,
            "PubliclyAccessible", false,
            "DeletionProtection", true,
            "MasterUsername", "wealthynest_app"
        ));
    }

    @Test
    void ec2InstanceRequiresImdsv2AndHasNoSshIngress() {
        App app = new App();
        ComputeStack compute = wireUpTo(app).compute();
        Template template = Template.fromStack(compute);

        template.hasResourceProperties("AWS::EC2::LaunchTemplate", Map.of(
            "LaunchTemplateData", software.amazon.awscdk.assertions.Match.objectLike(Map.of(
                "MetadataOptions", Map.of("HttpTokens", "required")
            ))
        ));

        Map<String, Map<String, Object>> ingressRules =
            template.findResources("AWS::EC2::SecurityGroup", Map.of());
        for (Map<String, Object> resource : ingressRules.values()) {
            @SuppressWarnings("unchecked")
            var properties = (Map<String, Object>) resource.get("Properties");
            if (properties == null || !properties.containsKey("SecurityGroupIngress")) {
                continue;
            }
            @SuppressWarnings("unchecked")
            var rules = (java.util.List<Map<String, Object>>) properties.get("SecurityGroupIngress");
            for (Map<String, Object> rule : rules) {
                Object fromPort = rule.get("FromPort");
                if (fromPort instanceof Number n) {
                    org.junit.jupiter.api.Assertions.assertNotEquals(22, n.intValue(),
                        "no security group in this app should ever allow inbound SSH - access is via SSM Session Manager");
                }
            }
        }
    }

    @Test
    void ec2HasAutoRecoveryAlarmOnSystemStatusCheckFailure() {
        App app = new App();
        MonitoringStack monitoring = wireUpTo(app).monitoring();
        Template template = Template.fromStack(monitoring);

        // The ec2:recover action ARN is a Fn::Join of stack pseudo-parameters rather than a
        // plain string, so pin down alarm identity/thresholds here and leave the exact action
        // ARN shape unasserted - just confirm 2 actions are wired (recover + SNS notify).
        template.hasResourceProperties("AWS::CloudWatch::Alarm", Map.of(
            "MetricName", "StatusCheckFailed_System",
            "Namespace", "AWS/EC2",
            "EvaluationPeriods", 2,
            "Threshold", 0,
            "ComparisonOperator", "GreaterThanThreshold"
        ));

        Map<String, Map<String, Object>> alarms =
            template.findResources("AWS::CloudWatch::Alarm", Map.of(
                "Properties", Map.of("MetricName", "StatusCheckFailed_System")
            ));
        assertEquals(1, alarms.size());
        @SuppressWarnings("unchecked")
        var properties = (Map<String, Object>) alarms.values().iterator().next().get("Properties");
        @SuppressWarnings("unchecked")
        var alarmActions = (java.util.List<Object>) properties.get("AlarmActions");
        assertEquals(2, alarmActions.size(), "expected both the ec2:recover action and the SNS notify action");
    }

    private static void buildAndSynth() {
        App app = new App();
        wireUpTo(app);
        app.synth();
    }

    private static Wired wireUpTo(App app) {
        AppConfig config = TestFixtures.appConfig();
        var props = TestFixtures.stackProps();

        NetworkStack network = new NetworkStack(app, "TestNetwork", props, config);
        SecurityStack security = new SecurityStack(app, "TestSecurity", props, config);
        StorageStack storage = new StorageStack(app, "TestStorage", props, config, security.getDataKey());

        AppSecrets secrets = new AppSecrets(
            security.getDatabaseCredentialsSecret(),
            security.getJwtSecret(),
            security.getGoogleOAuthClientSecret(),
            security.getGoogleOAuthWebClientSecret(),
            security.getSmtpCredentialsSecret(),
            security.getVaultEncryptionKeySecret(),
            security.getVaultHashPepperSecret(),
            security.getFcmServiceAccountSecret(),
            security.getCloudflareOriginCertSecret()
        );

        DatabaseStack database = new DatabaseStack(app, "TestDatabase", props, config,
            network.getVpc(), security.getDatabaseCredentialsSecret(),
            network.getSecretsManagerEndpointSecurityGroup());

        ComputeStack compute = new ComputeStack(app, "TestCompute", props, config,
            network.getVpc(), security.getDataKey(), storage.getBackupBucket(), secrets, database,
            network.getSecretsManagerEndpointSecurityGroup());

        MonitoringStack monitoring = new MonitoringStack(app, "TestMonitoring", props, config,
            compute.getAppServer().getInstance(), database.getDatabase().getDatabaseInstance(),
            database.getCache().getReplicationGroup());

        new OutputsStack(app, "TestOutputs", props, config,
            compute.getAppServer().getPublicIp(),
            database.getDatabase().getDatabaseInstance(),
            database.getCache().getPrimaryEndpointAddress(),
            database.getCache().getPrimaryEndpointPort(),
            storage.getBackupBucket(),
            secrets
        );

        new CicdStack(app, "TestCicd", props, config,
            compute.getAppServer().getInstance(), storage.getBackupBucket());

        return new Wired(database, compute, monitoring);
    }

    private record Wired(DatabaseStack database, ComputeStack compute, MonitoringStack monitoring) {
    }
}
