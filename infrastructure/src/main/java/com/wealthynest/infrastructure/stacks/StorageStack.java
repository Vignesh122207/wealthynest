package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.constructs.VersionedEncryptedBucketConstruct;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.kms.IKey;
import software.amazon.awscdk.services.s3.Bucket;
import software.constructs.Construct;

/**
 * Application backups: RDS logical dumps (see {@code scripts/backup-database.sh}) and any future
 * export the ops runbooks want durable. Not RDS's own automated snapshots (those are managed by
 * RDS itself, configured in {@link DatabaseStack}) — this bucket is for artifacts something
 * outside RDS produces.
 */
public class StorageStack extends Stack {

    private final Bucket backupBucket;

    public StorageStack(Construct scope, String id, StackProps props, AppConfig config, IKey dataKey) {
        super(scope, id, props);

        // S3 bucket names are globally unique across all AWS accounts - suffix with the account
        // ID so this doesn't collide with someone else's "wealthynest-prod-backups".
        String bucketName = config.resourceName("backups") + "-" + this.getAccount();

        this.backupBucket = new VersionedEncryptedBucketConstruct(this, "BackupBucket",
            new VersionedEncryptedBucketConstruct.Props(
                bucketName,
                dataKey,
                config.storage().glacierTransitionDays(),
                config.storage().expirationDays(),
                config.storage().noncurrentExpirationDays()
            )
        ).getBucket();
    }

    public Bucket getBackupBucket() {
        return backupBucket;
    }
}
