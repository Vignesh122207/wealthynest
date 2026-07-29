package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.constructs.PostgresDatabaseConstruct;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.SecretValue;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.kms.IKey;
import software.amazon.awscdk.services.kms.Key;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.amazon.awscdk.services.secretsmanager.SecretStringGenerator;
import software.constructs.Construct;

/**
 * The single source of truth for every credential the backend needs. Two shapes:
 *
 * <ul>
 *   <li><b>CDK-generated</b> — value never needs to be known by a human (DB password, JWT
 *       signing secret). Created with {@code generateSecretString}; CloudFormation never sees
 *       the plaintext.</li>
 *   <li><b>Placeholder</b> — the real value comes from an external system (Google Cloud Console,
 *       Brevo, Firebase) or must be generated with a specific byte length ({@code openssl rand
 *       -base64 32}, per {@code wealthynest-api}'s own {@code .env.example}). CDK provisions an
 *       empty container with a {@code REPLACE_ME} marker; populating it is a manual, one-time
 *       {@code aws secretsmanager put-secret-value} step documented in
 *       {@code docs/secrets-management-guide.md}. This is deliberate — CDK generating a
 *       same-shaped-but-wrong-length value for something like {@code VAULT_ENCRYPTION_KEY} (must
 *       decode to exactly 32 raw bytes) would be a correctness bug, not a convenience.</li>
 * </ul>
 *
 * <p>Covers more than the literal 4 credentials named in the original brief (DB, JWT, Google
 * OAuth, SMTP) — {@code wealthynest-api}'s {@code application.yml} also requires
 * {@code VAULT_ENCRYPTION_KEY}, {@code VAULT_HASH_PEPPER}, and {@code FCM_SERVICE_ACCOUNT_JSON}.
 * All are real credentials the running application reads at boot; leaving any of them hardcoded
 * or undocumented would fail "never hardcode secrets" just as much as skipping the JWT secret
 * would.
 */
public class SecurityStack extends Stack {

    private final IKey dataKey;
    private final ISecret databaseCredentialsSecret;
    private final ISecret jwtSecret;
    private final ISecret googleOAuthClientSecret;
    private final ISecret googleOAuthWebClientSecret;
    private final ISecret smtpCredentialsSecret;
    private final ISecret vaultEncryptionKeySecret;
    private final ISecret vaultHashPepperSecret;
    private final ISecret fcmServiceAccountSecret;
    private final ISecret cloudflareOriginCertSecret;

    public SecurityStack(Construct scope, String id, StackProps props, AppConfig config) {
        super(scope, id, props);

        this.dataKey = Key.Builder.create(this, "DataKey")
            .description("WealthyNest CMK - RDS storage, ElastiCache at-rest, S3 backups")
            .enableKeyRotation(true)
            .removalPolicy(RemovalPolicy.RETAIN)
            .build();
        dataKey.addAlias(config.resourceName("data-key"));

        this.databaseCredentialsSecret = Secret.Builder.create(this, "DatabaseCredentialsSecret")
            .secretName(config.resourceName("db-credentials"))
            .description("RDS PostgreSQL master credentials - CDK-generated, maps to DB_USERNAME/DB_PASSWORD")
            .generateSecretString(SecretStringGenerator.builder()
                .secretStringTemplate("{\"username\":\"%s\"}".formatted(PostgresDatabaseConstruct.MASTER_USERNAME))
                .generateStringKey("password")
                .excludeCharacters("\"@/\\ '")
                .passwordLength(32)
                .build())
            .removalPolicy(RemovalPolicy.RETAIN)
            .build();

        this.jwtSecret = Secret.Builder.create(this, "JwtSecret")
            .secretName(config.resourceName("jwt-secret"))
            .description("wealthynest-api JWT signing secret - CDK-generated, maps to JWT_SECRET")
            .generateSecretString(SecretStringGenerator.builder()
                .passwordLength(64)
                .excludePunctuation(true)
                .build())
            .removalPolicy(RemovalPolicy.RETAIN)
            .build();

        this.googleOAuthClientSecret = placeholderSecret(
            "GoogleOAuthClientSecret",
            config.resourceName("google-oauth-client-secret"),
            "Google OAuth 'Desktop app' client secret (Cloud Console > Credentials) - maps to "
                + "GOOGLE_NATIVE_CLIENT_SECRET. Populate manually after deploy."
        );

        this.googleOAuthWebClientSecret = placeholderSecret(
            "GoogleOAuthWebClientSecret",
            config.resourceName("google-oauth-web-client-secret"),
            "Google OAuth 'Web application' client secret (Cloud Console > Credentials, same client "
                + "as GOOGLE_CLIENT_ID) - maps to GOOGLE_CLIENT_SECRET. Only used by the web "
                + "popup-code fallback (AuthServiceImpl.googleLoginPopup) for when One Tap's silent "
                + "prompt() is blocked/skipped on mobile. Populate manually after deploy."
        );

        this.smtpCredentialsSecret = Secret.Builder.create(this, "SmtpCredentialsSecret")
            .secretName(config.resourceName("smtp-credentials"))
            .description("Brevo SMTP credentials - maps directly to MAIL_USERNAME/MAIL_PASSWORD. "
                + "Populate manually after deploy.")
            .secretStringValue(SecretValue.unsafePlainText(
                "{\"MAIL_USERNAME\":\"REPLACE_ME\",\"MAIL_PASSWORD\":\"REPLACE_ME\"}"))
            .removalPolicy(RemovalPolicy.RETAIN)
            .build();

        this.vaultEncryptionKeySecret = placeholderSecret(
            "VaultEncryptionKeySecret",
            config.resourceName("vault-encryption-key"),
            "AES-256 field encryption key for the Vault feature - maps to VAULT_ENCRYPTION_KEY. "
                + "Must be `openssl rand -base64 32` (32 raw bytes) - generate and populate "
                + "manually after deploy, once, before first use. Rotating it makes every "
                + "existing vault item unreadable."
        );

        this.vaultHashPepperSecret = placeholderSecret(
            "VaultHashPepperSecret",
            config.resourceName("vault-hash-pepper"),
            "HMAC pepper for Vault reused-password detection - maps to VAULT_HASH_PEPPER. "
                + "Must be `openssl rand -base64 32`, deliberately separate from the encryption "
                + "key. Populate manually after deploy."
        );

        this.fcmServiceAccountSecret = placeholderSecret(
            "FcmServiceAccountSecret",
            config.resourceName("fcm-service-account"),
            "Base64-encoded Firebase service-account JSON - maps to FCM_SERVICE_ACCOUNT_JSON. "
                + "Optional: push notifications silently no-op if left as the placeholder. "
                + "Populate manually after deploy (see ANDROID_APP_ROADMAP.md)."
        );

        this.cloudflareOriginCertSecret = Secret.Builder.create(this, "CloudflareOriginCertSecret")
            .secretName(config.resourceName("cloudflare-origin-cert"))
            .description("Cloudflare Origin CA cert/key for nginx TLS termination - JSON {\"CERT\":..,"
                + "\"KEY\":..}. bootstrap-ec2.sh fetches this on every boot, so it survives instance "
                + "replacement without a manual SSM step. Populate manually after generating the "
                + "cert in the Cloudflare dashboard (SSL/TLS > Origin Server).")
            .secretStringValue(SecretValue.unsafePlainText("REPLACE_ME_POST_DEPLOY"))
            .removalPolicy(RemovalPolicy.RETAIN)
            .build();
    }

    private ISecret placeholderSecret(String constructId, String secretName, String description) {
        return Secret.Builder.create(this, constructId)
            .secretName(secretName)
            .description(description)
            .secretStringValue(SecretValue.unsafePlainText("REPLACE_ME_POST_DEPLOY"))
            .removalPolicy(RemovalPolicy.RETAIN)
            .build();
    }

    public IKey getDataKey() {
        return dataKey;
    }

    public ISecret getDatabaseCredentialsSecret() {
        return databaseCredentialsSecret;
    }

    public ISecret getJwtSecret() {
        return jwtSecret;
    }

    public ISecret getGoogleOAuthClientSecret() {
        return googleOAuthClientSecret;
    }

    public ISecret getGoogleOAuthWebClientSecret() {
        return googleOAuthWebClientSecret;
    }

    public ISecret getSmtpCredentialsSecret() {
        return smtpCredentialsSecret;
    }

    public ISecret getVaultEncryptionKeySecret() {
        return vaultEncryptionKeySecret;
    }

    public ISecret getVaultHashPepperSecret() {
        return vaultHashPepperSecret;
    }

    public ISecret getFcmServiceAccountSecret() {
        return fcmServiceAccountSecret;
    }

    public ISecret getCloudflareOriginCertSecret() {
        return cloudflareOriginCertSecret;
    }
}
