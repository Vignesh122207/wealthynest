package com.wealthynest.infrastructure.constructs;

import java.util.List;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.services.ec2.IVpc;
import software.amazon.awscdk.services.ec2.InstanceType;
import software.amazon.awscdk.services.ec2.SecurityGroup;
import software.amazon.awscdk.services.ec2.SubnetSelection;
import software.amazon.awscdk.services.ec2.SubnetType;
import software.amazon.awscdk.services.kms.IKey;
import software.amazon.awscdk.services.rds.Credentials;
import software.amazon.awscdk.services.rds.CredentialsFromUsernameOptions;
import software.amazon.awscdk.services.rds.DatabaseInstance;
import software.amazon.awscdk.services.rds.DatabaseInstanceEngine;
import software.amazon.awscdk.services.rds.PerformanceInsightRetention;
import software.amazon.awscdk.services.rds.PostgresEngineVersion;
import software.amazon.awscdk.services.rds.PostgresInstanceEngineProps;
import software.amazon.awscdk.services.rds.StorageType;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.constructs.Construct;

/**
 * Private (no public access, no internet route needed) RDS PostgreSQL instance: storage
 * encrypted with our own CMK, automated backups, and Performance Insights. The security group
 * starts with no ingress rules - {@code ComputeStack} opens 5432 itself, as a resource scoped to
 * its own stack rather than calling a method on this construct's security group (which would
 * create the ingress rule as a DatabaseStack resource instead - see {@code ComputeStack}'s own
 * comment on {@code DatabaseIngressFromAppServer} for why that direction matters).
 *
 * <p>Deliberately uses {@code Credentials.fromUsername(...).password(secret.secretValueFromJson(...))}
 * instead of the more obvious {@code Credentials.fromSecret(secret)}. Both resolve the password
 * the same way at deploy time (a Secrets Manager dynamic reference, never plaintext in the
 * template) - the difference is that {@code fromSecret} also sets {@code credentials.secret},
 * which makes {@code DatabaseInstance} call {@code secret.attach(this)} unconditionally,
 * creating a {@code SecretTargetAttachment} as a child of the secret (i.e. in whichever stack the
 * secret lives - {@code SecurityStack}) that references this DB instance. That single CDK
 * behavior alone makes SecurityStack depend on DatabaseStack, and since DatabaseStack already
 * depends on SecurityStack for the credentials in the first place, it's an unconditional 2-stack
 * cycle with no way to order around it. {@code fromUsername} never sets {@code credentials.secret},
 * so no attachment is created - the dependency stays one-directional (Database -&gt; Security).
 */
public final class PostgresDatabaseConstruct extends Construct {

    /** Must match the {@code username} baked into SecurityStack's db-credentials secret template. */
    public static final String MASTER_USERNAME = "wealthynest_app";

    private final DatabaseInstance databaseInstance;
    private final SecurityGroup securityGroup;

    public PostgresDatabaseConstruct(Construct scope, String id, Props props) {
        super(scope, id);

        this.securityGroup = SecurityGroup.Builder.create(this, "SecurityGroup")
            .vpc(props.vpc())
            .securityGroupName(props.securityGroupName())
            .description("WealthyNest RDS PostgreSQL - private isolated subnet, no public access")
            .allowAllOutbound(false)
            .build();

        PerformanceInsightRetention piRetention = props.performanceInsightsRetentionDays() <= 7
            ? PerformanceInsightRetention.DEFAULT
            : PerformanceInsightRetention.MONTHS_1;

        this.databaseInstance = DatabaseInstance.Builder.create(this, "Instance")
            .instanceIdentifier(props.instanceIdentifier())
            .vpc(props.vpc())
            .vpcSubnets(SubnetSelection.builder().subnetType(SubnetType.PRIVATE_ISOLATED).build())
            .securityGroups(List.of(securityGroup))
            .engine(DatabaseInstanceEngine.postgres(PostgresInstanceEngineProps.builder()
                .version(PostgresEngineVersion.VER_17_5)
                .build()))
            .instanceType(new InstanceType(props.instanceClass()))
            .credentials(Credentials.fromUsername(MASTER_USERNAME, CredentialsFromUsernameOptions.builder()
                .password(props.credentialsSecret().secretValueFromJson("password"))
                .encryptionKey(props.kmsKey())
                .build()))
            .databaseName(props.databaseName())
            .storageType(StorageType.GP3)
            .allocatedStorage(props.allocatedStorageGb())
            .maxAllocatedStorage(props.maxAllocatedStorageGb())
            .storageEncrypted(true)
            .storageEncryptionKey(props.kmsKey())
            .multiAz(props.multiAz())
            .autoMinorVersionUpgrade(true)
            .backupRetention(Duration.days(props.backupRetentionDays()))
            .deletionProtection(props.deletionProtection())
            .removalPolicy(props.deletionProtection() ? RemovalPolicy.RETAIN : RemovalPolicy.SNAPSHOT)
            .enablePerformanceInsights(true)
            .performanceInsightEncryptionKey(props.kmsKey())
            .performanceInsightRetention(piRetention)
            .cloudwatchLogsExports(List.of("postgresql"))
            .cloudwatchLogsRetention(LogRetentionMapper.fromDays(props.logRetentionDays()))
            .build();
    }

    public DatabaseInstance getDatabaseInstance() {
        return databaseInstance;
    }

    public SecurityGroup getSecurityGroup() {
        return securityGroup;
    }

    public record Props(
        IVpc vpc,
        String instanceClass,
        int allocatedStorageGb,
        int maxAllocatedStorageGb,
        boolean multiAz,
        boolean deletionProtection,
        int backupRetentionDays,
        int performanceInsightsRetentionDays,
        int logRetentionDays,
        ISecret credentialsSecret,
        IKey kmsKey,
        String databaseName,
        String instanceIdentifier,
        String securityGroupName
    ) {
    }
}
