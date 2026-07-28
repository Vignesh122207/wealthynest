package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.constructs.PostgresDatabaseConstruct;
import com.wealthynest.infrastructure.constructs.RedisReplicationGroupConstruct;
import java.util.List;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.ec2.CfnSecurityGroupIngress;
import software.amazon.awscdk.services.ec2.ISecurityGroup;
import software.amazon.awscdk.services.ec2.IVpc;
import software.amazon.awscdk.services.ec2.SecurityGroup;
import software.amazon.awscdk.services.ec2.SubnetSelection;
import software.amazon.awscdk.services.ec2.SubnetType;
import software.amazon.awscdk.services.kms.IKey;
import software.amazon.awscdk.services.kms.Key;
import software.amazon.awscdk.services.secretsmanager.HostedRotation;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.RotationScheduleOptions;
import software.amazon.awscdk.services.secretsmanager.SecretTargetAttachment;
import software.amazon.awscdk.services.secretsmanager.SecretTargetAttachmentProps;
import software.amazon.awscdk.services.secretsmanager.SingleUserHostedRotationOptions;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.constructs.Construct;

/**
 * The two managed data stores: RDS PostgreSQL (system of record) and ElastiCache Redis (cache +
 * rate-limit counters). Both sit in private-isolated subnets with no route to the internet and no
 * public accessibility. Both start with a security group that has no ingress rules at all -
 * {@link ComputeStack} opens 5432/6379 itself as top-level {@code CfnSecurityGroupIngress}
 * resources scoped to its own stack, not by calling a method here, precisely so that opening
 * ingress doesn't make <i>this</i> stack depend on Compute. See {@code ComputeStack}'s comment on
 * {@code DatabaseIngressFromAppServer} for the full reasoning - it's the same class of pitfall as
 * the KMS key note below, just one call away from being invisible in a diff.
 *
 * <p><b>Two dependency-direction pitfalls that aren't obvious from the code:</b>
 *
 * <ul>
 *   <li>Owns its own KMS key rather than reusing {@code SecurityStack}'s. RDS Performance
 *       Insights and ElastiCache at-rest encryption both grant their service principal a
 *       key-policy statement scoped to this specific DB/cache resource ARN - a resource-policy
 *       edit on the key, which lives wherever the key does. A key created in SecurityStack would
 *       therefore make SecurityStack depend on DatabaseStack. Keeping the key local avoids that.
 *   <li>Credentials come from {@code Credentials.fromUsername(...).password(secret.secretValueFromJson(...))}
 *       rather than the more obvious {@code Credentials.fromSecret(secret)} - see
 *       {@code PostgresDatabaseConstruct}'s own comment for why {@code fromSecret} would make
 *       SecurityStack depend on DatabaseStack via an unconditional {@code secret.attach(this)}.
 * </ul>
 *
 * <p>Both pitfalls share the same shape: an L2 convenience method that looks like it's adding a
 * resource to whatever object you call it on, but actually creates that resource as a child of
 * the construct the method is defined on - which physically lives in whatever stack instantiated
 * <i>that</i> construct, regardless of which stack's code happens to call the method. Getting the
 * direction backwards doesn't fail at compile time; it fails at {@code cdk synth}, as a full
 * dependency-cycle report across every stack involved. See {@code InfrastructureApp} for the
 * resulting stack order these two fixes require (Database before Compute).
 *
 * <p><b>Automatic credential rotation.</b> {@code db-credentials} rotates every
 * {@code rdsCredentialRotationDays} via Secrets Manager's AWS-managed PostgreSQL single-user
 * {@link HostedRotation} - no rotation Lambda for us to write or patch. Getting there needs one
 * more piece {@code PostgresDatabaseConstruct} deliberately doesn't have: a
 * {@link SecretTargetAttachment}, built here (not via {@code databaseCredentialsSecret.attach()})
 * for the exact same reason {@code fromUsername} was chosen over {@code fromSecret} above -
 * calling {@code .attach()} on the secret creates the attachment as a child of the secret's own
 * scope (SecurityStack), which would make SecurityStack depend on DatabaseStack. Constructing
 * {@code SecretTargetAttachment} directly with {@code this} (DatabaseStack) as scope keeps the
 * edge one-directional; DatabaseStack already depends on SecurityStack for the secret itself, so
 * this adds no new edge. The attachment doesn't create a second secret - {@code getSecretArn()}
 * on the result is the same ARN, it just knows how to also write the DB's host/port/dbname back
 * into the secret's JSON, which is what lets the rotation Lambda actually connect.
 *
 * <p><b>Operational caveat that must not get lost:</b> PostgreSQL single-user rotation changes the
 * password on the live DB user in place - there's no overlap window the way multi-user rotation
 * has. {@code wealthynest-api} only reads {@code DB_PASSWORD} from
 * {@code /opt/wealthynest/current.env} at process start (see {@code deploy-backend.sh}), not on
 * every connection, so already-open pool connections keep working after a rotation (Postgres
 * doesn't kill live sessions on {@code ALTER ROLE ... PASSWORD}) but any *new* connection attempt
 * after that point will fail auth until the app re-reads the secret. {@code deploy-backend.sh
 * --refresh-env} does exactly that on demand (over SSM, no new JAR needed) - run it by hand after
 * a rotation, or wire it to something that fires on a schedule. Deliberately not automated here;
 * see {@code docs/secrets-management-guide.md} for why and what wiring that would take.
 *
 * <p><b>JWT/vault secrets are not part of this rotation.</b> {@code jwt-secret} has no natural
 * {@link HostedRotation} blueprint (there's no database to test a new value against) and rotating
 * it invalidates every currently-issued JWT - safe automatic rotation would need
 * {@code wealthynest-api} to verify against both the current and previous signing secret during a
 * grace window, which is a backend change, not an infra one, matching the exact scope boundary
 * already drawn for Redis transit encryption (see {@code RedisReplicationGroupConstruct}).
 * {@code vault-encryption-key}/{@code vault-hash-pepper} must never auto-rotate at all - their own
 * secret descriptions in {@code SecurityStack} explain why.
 */
public class DatabaseStack extends Stack {

    private final PostgresDatabaseConstruct database;
    private final RedisReplicationGroupConstruct cache;
    private final StringParameter dbUrlParameter;
    private final StringParameter redisHostParameter;
    private final StringParameter redisPortParameter;

    public DatabaseStack(
        Construct scope,
        String id,
        StackProps props,
        AppConfig config,
        IVpc vpc,
        ISecret databaseCredentialsSecret,
        ISecurityGroup secretsManagerEndpointSecurityGroup
    ) {
        super(scope, id, props);

        IKey dataKey = Key.Builder.create(this, "DatabaseDataKey")
            .description("WealthyNest CMK - RDS storage/Performance Insights, ElastiCache at-rest")
            .enableKeyRotation(true)
            .removalPolicy(RemovalPolicy.RETAIN)
            .build();
        dataKey.addAlias(config.resourceName("database-key"));

        this.database = new PostgresDatabaseConstruct(this, "Database", new PostgresDatabaseConstruct.Props(
            vpc,
            config.database().instanceClass(),
            config.database().allocatedStorageGb(),
            config.database().maxAllocatedStorageGb(),
            config.database().multiAz(),
            config.database().deletionProtection(),
            config.database().backupRetentionDays(),
            config.database().performanceInsightsRetentionDays(),
            config.monitoring().logRetentionDays(),
            databaseCredentialsSecret,
            dataKey,
            "wealthynest",
            config.resourceName("postgres")
        ));

        SecretTargetAttachment dbSecretAttachment = new SecretTargetAttachment(this, "DatabaseCredentialsAttachment",
            SecretTargetAttachmentProps.builder()
                .secret(databaseCredentialsSecret)
                .target(database.getDatabaseInstance())
                .build());

        // Own security group (not the endpoint's "open" default, which we didn't set) so the two
        // ingress rules below stay the explicit, per-consumer grants this app uses everywhere else.
        SecurityGroup rotationLambdaSecurityGroup = SecurityGroup.Builder.create(this, "DbRotationLambdaSecurityGroup")
            .vpc(vpc)
            .description("WealthyNest DB credentials rotation Lambda - reaches RDS and the Secrets Manager VPC endpoint only")
            .allowAllOutbound(true)
            .build();

        HostedRotation hostedRotation = HostedRotation.postgreSqlSingleUser(SingleUserHostedRotationOptions.builder()
            .vpc(vpc)
            .vpcSubnets(SubnetSelection.builder().subnetType(SubnetType.PRIVATE_ISOLATED).build())
            .securityGroups(List.of(rotationLambdaSecurityGroup))
            // Matches the character set db-credentials was generated with in SecurityStack - a
            // rotated password must satisfy the same constraints the original did.
            .excludeCharacters("\"@/\\ '")
            .build());
        dbSecretAttachment.addRotationSchedule("DbCredentialsRotationSchedule", RotationScheduleOptions.builder()
            .hostedRotation(hostedRotation)
            .automaticallyAfter(Duration.days(config.database().credentialRotationDays()))
            .build());

        CfnSecurityGroupIngress.Builder.create(this, "DatabaseIngressFromRotationLambda")
            .groupId(database.getSecurityGroup().getSecurityGroupId())
            .sourceSecurityGroupId(rotationLambdaSecurityGroup.getSecurityGroupId())
            .ipProtocol("tcp")
            .fromPort(5432)
            .toPort(5432)
            .description("DB credentials rotation Lambda to PostgreSQL")
            .build();
        CfnSecurityGroupIngress.Builder.create(this, "SecretsManagerEndpointIngressFromRotationLambda")
            .groupId(secretsManagerEndpointSecurityGroup.getSecurityGroupId())
            .sourceSecurityGroupId(rotationLambdaSecurityGroup.getSecurityGroupId())
            .ipProtocol("tcp")
            .fromPort(443)
            .toPort(443)
            .description("DB credentials rotation Lambda to the Secrets Manager VPC endpoint")
            .build();

        this.cache = new RedisReplicationGroupConstruct(this, "Cache", new RedisReplicationGroupConstruct.Props(
            vpc,
            config.redis().nodeType(),
            config.redis().numNodes(),
            dataKey,
            config.resourceName("redis")
        ));

        // Non-secret runtime config the app needs at boot, read by deploy-backend.sh alongside
        // SecurityStack's actual secrets. Plain SSM parameters, not Secrets Manager - a hostname
        // isn't sensitive, and mixing it into Secrets Manager would just be noise there.
        String jdbcUrl = "jdbc:postgresql://" + database.getDatabaseInstance().getDbInstanceEndpointAddress()
            + ":" + database.getDatabaseInstance().getDbInstanceEndpointPort() + "/wealthynest";
        this.dbUrlParameter = StringParameter.Builder.create(this, "DbUrlParameter")
            .parameterName("/wealthynest/" + config.envName() + "/db-url")
            .description("JDBC URL for wealthynest-api's DB_URL")
            .stringValue(jdbcUrl)
            .build();
        this.redisHostParameter = StringParameter.Builder.create(this, "RedisHostParameter")
            .parameterName("/wealthynest/" + config.envName() + "/redis-host")
            .description("ElastiCache primary endpoint for wealthynest-api's REDIS_HOST")
            .stringValue(cache.getPrimaryEndpointAddress())
            .build();
        this.redisPortParameter = StringParameter.Builder.create(this, "RedisPortParameter")
            .parameterName("/wealthynest/" + config.envName() + "/redis-port")
            .description("ElastiCache port for wealthynest-api's REDIS_PORT")
            .stringValue(cache.getPrimaryEndpointPort())
            .build();
    }

    public PostgresDatabaseConstruct getDatabase() {
        return database;
    }

    public RedisReplicationGroupConstruct getCache() {
        return cache;
    }

    public StringParameter getDbUrlParameter() {
        return dbUrlParameter;
    }

    public StringParameter getRedisHostParameter() {
        return redisHostParameter;
    }

    public StringParameter getRedisPortParameter() {
        return redisPortParameter;
    }
}
