package com.wealthynest.infrastructure.config;

/**
 * Fully resolved, environment-specific configuration for one CDK app synthesis.
 * Built once by {@link ConfigLoader} and passed by reference into every stack —
 * stacks never read {@code cdk.json} context directly.
 */
public record AppConfig(
    String envName,
    String account,
    String region,
    String domainName,
    String apiSubdomain,
    boolean cloudflareProxied,
    String githubRepo,
    NetworkConfig network,
    ComputeConfig compute,
    DatabaseConfig database,
    RedisConfig redis,
    StorageConfig storage,
    MonitoringConfig monitoring
) {

    /** {@code "wealthynest-<env>-<suffix>"} — consistent naming across every stack. */
    public String resourceName(String suffix) {
        return "wealthynest-%s-%s".formatted(envName, suffix);
    }

    /**
     * {@code "/wealthynest/<env>/<path>"} — the one place SSM parameter and CloudWatch Log Group
     * paths are built, so no stack hand-concatenates this literal (and drifts from the others).
     */
    public String namespace(String path) {
        return "/wealthynest/%s/%s".formatted(envName, path);
    }

    public record NetworkConfig(
        String vpcCidr,
        boolean natGatewayEnabled,
        java.util.List<String> availabilityZones
    ) {
    }

    public record ComputeConfig(
        String instanceType,
        String architecture,
        int rootVolumeGb,
        String adminCidrForSsm,
        java.util.List<String> cloudflareIpv4Ranges,
        java.util.List<String> cloudflareIpv6Ranges
    ) {
        public boolean hasAdminCidr() {
            return adminCidrForSsm != null && !adminCidrForSsm.isBlank();
        }
    }

    public record DatabaseConfig(
        String instanceClass,
        int allocatedStorageGb,
        int maxAllocatedStorageGb,
        boolean multiAz,
        boolean deletionProtection,
        int backupRetentionDays,
        int performanceInsightsRetentionDays,
        int credentialRotationDays
    ) {
    }

    public record RedisConfig(
        String nodeType,
        int numNodes
    ) {
    }

    public record StorageConfig(
        int glacierTransitionDays,
        int expirationDays,
        int noncurrentExpirationDays
    ) {
    }

    public record MonitoringConfig(
        String alarmEmail,
        int logRetentionDays
    ) {
    }
}
