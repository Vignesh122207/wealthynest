package com.wealthynest.infrastructure.config;

import java.util.List;
import software.amazon.awscdk.services.secretsmanager.ISecret;

/**
 * Every credential {@link com.wealthynest.infrastructure.stacks.SecurityStack} owns, bundled so
 * downstream stacks (Compute, Monitoring, Outputs) take one reference instead of eight positional
 * parameters.
 */
public record AppSecrets(
    ISecret databaseCredentials,
    ISecret jwt,
    ISecret googleOAuthClientSecret,
    ISecret googleOAuthWebClientSecret,
    ISecret smtpCredentials,
    ISecret vaultEncryptionKey,
    ISecret vaultHashPepper,
    ISecret fcmServiceAccount,
    ISecret cloudflareOriginCert
) {
    public List<ISecret> all() {
        return List.of(
            databaseCredentials, jwt, googleOAuthClientSecret, googleOAuthWebClientSecret, smtpCredentials,
            vaultEncryptionKey, vaultHashPepper, fcmServiceAccount, cloudflareOriginCert
        );
    }
}
