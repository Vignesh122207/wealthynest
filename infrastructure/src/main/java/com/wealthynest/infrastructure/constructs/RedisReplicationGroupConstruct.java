package com.wealthynest.infrastructure.constructs;

import java.util.List;
import software.amazon.awscdk.services.ec2.IVpc;
import software.amazon.awscdk.services.ec2.SecurityGroup;
import software.amazon.awscdk.services.ec2.SubnetSelection;
import software.amazon.awscdk.services.ec2.SubnetType;
import software.amazon.awscdk.services.elasticache.CfnReplicationGroup;
import software.amazon.awscdk.services.elasticache.CfnSubnetGroup;
import software.amazon.awscdk.services.kms.IKey;
import software.constructs.Construct;

/**
 * Amazon ElastiCache for Redis, encrypted at rest with our own CMK. Never publicly reachable (not
 * a service capability ElastiCache even has). The security group starts with no ingress rules -
 * {@code ComputeStack} opens 6379 itself, as a resource scoped to its own stack; see
 * {@code ComputeStack}'s comment on {@code CacheIngressFromAppServer} for why calling a method on
 * this construct's security group instead would create a cyclic stack dependency.
 *
 * <p><b>Deliberately not using in-transit encryption / AUTH token.</b> ElastiCache requires
 * {@code TransitEncryptionEnabled=true} before it will accept an {@code AuthToken} at all, which
 * means the client must speak TLS. {@code wealthynest-api}'s Redis client
 * ({@code application.yml}'s {@code spring.data.redis.*}) has no TLS configuration today — only
 * a plain-TCP {@code REDIS_PASSWORD}, matching local dev's {@code redis-server --requirepass}.
 * Enabling transit encryption here without a corresponding backend change would silently break
 * every Redis connection in production. Since this infrastructure work is scoped to not touch
 * backend code, that one-line Spring config addition
 * ({@code spring.data.redis.ssl.enabled=true}) is called out as a follow-up in the security
 * review instead of being made here — see {@code docs/deployment-guide.md}.
 */
public final class RedisReplicationGroupConstruct extends Construct {

    private final CfnReplicationGroup replicationGroup;
    private final SecurityGroup securityGroup;

    public RedisReplicationGroupConstruct(Construct scope, String id, Props props) {
        super(scope, id);

        this.securityGroup = SecurityGroup.Builder.create(this, "SecurityGroup")
            .vpc(props.vpc())
            .description("WealthyNest ElastiCache Redis - private isolated subnet, no public access")
            .allowAllOutbound(false)
            .build();

        List<String> subnetIds = props.vpc()
            .selectSubnets(SubnetSelection.builder().subnetType(SubnetType.PRIVATE_ISOLATED).build())
            .getSubnetIds();

        CfnSubnetGroup subnetGroup = CfnSubnetGroup.Builder.create(this, "SubnetGroup")
            .description(props.resourceNamePrefix() + " Redis subnet group (private isolated)")
            .subnetIds(subnetIds)
            .build();

        boolean highAvailability = props.numNodes() > 1;

        this.replicationGroup = CfnReplicationGroup.Builder.create(this, "ReplicationGroup")
            .replicationGroupDescription(props.resourceNamePrefix() + " Redis - cache + rate limiting")
            .engine("redis")
            .engineVersion("7.1")
            .cacheNodeType(props.nodeType())
            .numCacheClusters(props.numNodes())
            .automaticFailoverEnabled(highAvailability)
            .multiAzEnabled(highAvailability)
            .cacheSubnetGroupName(subnetGroup.getRef())
            .securityGroupIds(List.of(securityGroup.getSecurityGroupId()))
            .atRestEncryptionEnabled(true)
            .kmsKeyId(props.kmsKey().getKeyArn())
            .transitEncryptionEnabled(false)
            .build();
    }

    public CfnReplicationGroup getReplicationGroup() {
        return replicationGroup;
    }

    public SecurityGroup getSecurityGroup() {
        return securityGroup;
    }

    public String getPrimaryEndpointAddress() {
        return replicationGroup.getAttrPrimaryEndPointAddress();
    }

    public String getPrimaryEndpointPort() {
        return replicationGroup.getAttrPrimaryEndPointPort();
    }

    public record Props(
        IVpc vpc,
        String nodeType,
        int numNodes,
        IKey kmsKey,
        String resourceNamePrefix
    ) {
    }
}
