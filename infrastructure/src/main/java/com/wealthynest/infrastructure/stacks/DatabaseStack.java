package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.constructs.PostgresDatabaseConstruct;
import com.wealthynest.infrastructure.constructs.RedisReplicationGroupConstruct;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.ec2.IVpc;
import software.amazon.awscdk.services.kms.IKey;
import software.amazon.awscdk.services.kms.Key;
import software.amazon.awscdk.services.secretsmanager.ISecret;
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
        ISecret databaseCredentialsSecret
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
