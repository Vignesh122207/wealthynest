package com.wealthynest.infrastructure.constructs;

import java.util.List;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.services.kms.IKey;
import software.amazon.awscdk.services.s3.BlockPublicAccess;
import software.amazon.awscdk.services.s3.Bucket;
import software.amazon.awscdk.services.s3.BucketEncryption;
import software.amazon.awscdk.services.s3.LifecycleRule;
import software.amazon.awscdk.services.s3.StorageClass;
import software.amazon.awscdk.services.s3.Transition;
import software.constructs.Construct;

/**
 * A private, versioned, KMS-encrypted S3 bucket with a Glacier-then-expire lifecycle — the
 * standard shape every backup/archival bucket in this app needs. Reused instead of re-declaring
 * the same {@code Bucket.Builder} block per stack.
 */
public final class VersionedEncryptedBucketConstruct extends Construct {

    private final Bucket bucket;

    public VersionedEncryptedBucketConstruct(Construct scope, String id, Props props) {
        super(scope, id);

        this.bucket = Bucket.Builder.create(this, "Bucket")
            .bucketName(props.bucketName())
            .versioned(true)
            .encryption(BucketEncryption.KMS)
            .encryptionKey(props.encryptionKey())
            .bucketKeyEnabled(true)
            .blockPublicAccess(BlockPublicAccess.BLOCK_ALL)
            .enforceSsl(true)
            .removalPolicy(RemovalPolicy.RETAIN)
            .lifecycleRules(List.of(
                LifecycleRule.builder()
                    .id("glacier-then-expire")
                    .enabled(true)
                    .transitions(List.of(
                        Transition.builder()
                            .storageClass(StorageClass.GLACIER)
                            .transitionAfter(Duration.days(props.glacierTransitionDays()))
                            .build()
                    ))
                    .expiration(Duration.days(props.expirationDays()))
                    .noncurrentVersionExpiration(Duration.days(props.noncurrentExpirationDays()))
                    .build()
            ))
            .build();
    }

    public Bucket getBucket() {
        return bucket;
    }

    public record Props(
        String bucketName,
        IKey encryptionKey,
        int glacierTransitionDays,
        int expirationDays,
        int noncurrentExpirationDays
    ) {
    }
}
