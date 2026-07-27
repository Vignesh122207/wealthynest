package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.config.AppSecrets;
import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.rds.DatabaseInstance;
import software.amazon.awscdk.services.s3.Bucket;
import software.constructs.Construct;

/**
 * Every value an operator or a CI/CD job needs to read after {@code cdk deploy} — centralized
 * here instead of scattered {@code CfnOutput}s across the stacks that own each resource, per the
 * brief's explicit ask for a dedicated OutputsStack.
 */
public class OutputsStack extends Stack {

    public OutputsStack(
        Construct scope,
        String id,
        StackProps props,
        AppConfig config,
        String appServerPublicIp,
        DatabaseInstance database,
        String redisPrimaryEndpointAddress,
        String redisPrimaryEndpointPort,
        Bucket backupBucket,
        AppSecrets secrets
    ) {
        super(scope, id, props);

        output("AppServerPublicIp", appServerPublicIp,
            "Elastic IP of the backend app server - point " + config.apiSubdomain() + " at this in Cloudflare DNS");
        output("DatabaseEndpoint", database.getDbInstanceEndpointAddress(), "RDS PostgreSQL endpoint hostname");
        output("DatabasePort", database.getDbInstanceEndpointPort(), "RDS PostgreSQL port");
        output("RedisEndpoint", redisPrimaryEndpointAddress, "ElastiCache Redis primary endpoint hostname");
        output("RedisPort", redisPrimaryEndpointPort, "ElastiCache Redis port");
        output("BackupBucketName", backupBucket.getBucketName(), "S3 bucket for application/database backups");

        output("DatabaseCredentialsSecretArn", secrets.databaseCredentials().getSecretArn(),
            "Secrets Manager ARN - DB_USERNAME / DB_PASSWORD");
        output("JwtSecretArn", secrets.jwt().getSecretArn(),
            "Secrets Manager ARN - JWT_SECRET");
        output("GoogleOAuthClientSecretArn", secrets.googleOAuthClientSecret().getSecretArn(),
            "Secrets Manager ARN - GOOGLE_NATIVE_CLIENT_SECRET (populate manually post-deploy)");
        output("SmtpCredentialsSecretArn", secrets.smtpCredentials().getSecretArn(),
            "Secrets Manager ARN - MAIL_USERNAME / MAIL_PASSWORD (populate manually post-deploy)");
        output("VaultEncryptionKeySecretArn", secrets.vaultEncryptionKey().getSecretArn(),
            "Secrets Manager ARN - VAULT_ENCRYPTION_KEY (populate manually post-deploy)");
        output("VaultHashPepperSecretArn", secrets.vaultHashPepper().getSecretArn(),
            "Secrets Manager ARN - VAULT_HASH_PEPPER (populate manually post-deploy)");
        output("FcmServiceAccountSecretArn", secrets.fcmServiceAccount().getSecretArn(),
            "Secrets Manager ARN - FCM_SERVICE_ACCOUNT_JSON (populate manually post-deploy, optional)");
    }

    private void output(String id, String value, String description) {
        CfnOutput.Builder.create(this, id).value(value).description(description).build();
    }
}
