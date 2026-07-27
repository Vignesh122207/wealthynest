package com.wealthynest.infrastructure.config;

import java.util.List;
import software.amazon.awscdk.services.secretsmanager.ISecret;

/**
 * Every credential {@link com.wealthynest.infrastructure.stacks.SecurityStack} owns, bundled so
 * downstream stacks (Compute, Monitoring, Outputs) take one reference instead of seven positional
 * parameters.
 */
public record AppSecrets(
    ISecret databaseCredentials,
    ISecret jwt,
    ISecret googleOAuthClientSecret,
    ISecret smtpCredentials,
    ISecret vaultEncryptionKey,
    ISecret vaultHashPepper,
    ISecret fcmServiceAccount
) {
    public List<ISecret> all() {
        return List.of(
            databaseCredentials, jwt, googleOAuthClientSecret, smtpCredentials,
            vaultEncryptionKey, vaultHashPepper, fcmServiceAccount
        );
    }
}
