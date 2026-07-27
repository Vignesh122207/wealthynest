package com.wealthynest.infrastructure.stacks;

import java.util.Map;
import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.assertions.Template;

class StorageStackTest {

    private static StorageStack buildStack(App app) {
        SecurityStack security = new SecurityStack(app, "TestSecurity", TestFixtures.stackProps(), TestFixtures.appConfig());
        return new StorageStack(app, "TestStorage", TestFixtures.stackProps(), TestFixtures.appConfig(), security.getDataKey());
    }

    @Test
    void bucketIsVersionedAndPrivate() {
        App app = new App();
        Template template = Template.fromStack(buildStack(app));

        template.hasResourceProperties("AWS::S3::Bucket", Map.of(
            "VersioningConfiguration", Map.of("Status", "Enabled"),
            "PublicAccessBlockConfiguration", Map.of(
                "BlockPublicAcls", true,
                "BlockPublicPolicy", true,
                "IgnorePublicAcls", true,
                "RestrictPublicBuckets", true
            )
        ));
    }

    @Test
    void bucketHasGlacierLifecycleRule() {
        App app = new App();
        Template template = Template.fromStack(buildStack(app));

        template.hasResourceProperties("AWS::S3::Bucket", Map.of(
            "LifecycleConfiguration", Map.of(
                "Rules", java.util.List.of(Map.of(
                    "Status", "Enabled",
                    "ExpirationInDays", 365
                ))
            )
        ));
    }

    @Test
    void bucketPolicyDeniesInsecureTransport() {
        App app = new App();
        Template template = Template.fromStack(buildStack(app));

        template.hasResourceProperties("AWS::S3::BucketPolicy", Map.of(
            "PolicyDocument", Map.of(
                "Statement", software.amazon.awscdk.assertions.Match.arrayWith(java.util.List.of(
                    software.amazon.awscdk.assertions.Match.objectLike(Map.of(
                        "Effect", "Deny",
                        "Condition", Map.of("Bool", Map.of("aws:SecureTransport", "false"))
                    ))
                ))
            )
        ));
    }
}
