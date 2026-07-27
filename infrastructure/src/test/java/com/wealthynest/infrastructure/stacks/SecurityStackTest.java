package com.wealthynest.infrastructure.stacks;

import java.util.Map;
import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.assertions.Match;
import software.amazon.awscdk.assertions.Template;

class SecurityStackTest {

    @Test
    void keyHasRotationEnabled() {
        App app = new App();
        SecurityStack stack = new SecurityStack(app, "TestSecurity", TestFixtures.stackProps(), TestFixtures.appConfig());
        Template template = Template.fromStack(stack);

        template.hasResourceProperties("AWS::KMS::Key", Map.of("EnableKeyRotation", true));
    }

    @Test
    void createsExactlySevenSecrets() {
        App app = new App();
        SecurityStack stack = new SecurityStack(app, "TestSecurity", TestFixtures.stackProps(), TestFixtures.appConfig());
        Template template = Template.fromStack(stack);

        template.resourceCountIs("AWS::SecretsManager::Secret", 7);
    }

    @Test
    void databaseCredentialsSecretIsGeneratedNeverHardcoded() {
        App app = new App();
        SecurityStack stack = new SecurityStack(app, "TestSecurity", TestFixtures.stackProps(), TestFixtures.appConfig());
        Template template = Template.fromStack(stack);

        // Generated secrets have a GenerateSecretString block and no literal SecretString.
        template.hasResourceProperties("AWS::SecretsManager::Secret", Map.of(
            "GenerateSecretString", Match.objectLike(Map.of("GenerateStringKey", "password")),
            "SecretString", Match.absent()
        ));
    }
}
