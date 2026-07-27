package com.wealthynest.infrastructure.config;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import software.amazon.awscdk.App;

/**
 * Reads the {@code wealthynest:environments} block from {@code cdk.json} (or a {@code -c}
 * override) and produces a fully validated {@link AppConfig}.
 *
 * <p>Fails fast with a specific message on any missing/malformed key — a stack half-built from a
 * bad config is worse than a synth that refuses to run.
 */
public final class ConfigLoader {

    private static final String ENVIRONMENTS_CONTEXT_KEY = "wealthynest:environments";
    private static final String ENV_CONTEXT_KEY = "env";
    private static final String DEFAULT_ENV_NAME = "production";

    private ConfigLoader() {
    }

    public static AppConfig load(App app) {
        String envName = stringContext(app, ENV_CONTEXT_KEY, DEFAULT_ENV_NAME);

        Object rawEnvironments = app.getNode().tryGetContext(ENVIRONMENTS_CONTEXT_KEY);
        if (!(rawEnvironments instanceof Map<?, ?> environments)) {
            throw new IllegalStateException(
                "cdk.json is missing the '%s' context block".formatted(ENVIRONMENTS_CONTEXT_KEY));
        }

        Object rawEnv = environments.get(envName);
        if (!(rawEnv instanceof Map<?, ?> env)) {
            throw new IllegalStateException(
                "No environment '%s' configured under '%s' in cdk.json. Configured environments: %s"
                    .formatted(envName, ENVIRONMENTS_CONTEXT_KEY, environments.keySet()));
        }

        return new AppConfig(
            envName,
            resolveAccount(app, env, envName),
            requireString(env, "region", envName),
            requireString(env, "domainName", envName),
            requireString(env, "apiSubdomain", envName),
            requireBoolean(env, "cloudflareProxied", envName),
            requireString(env, "githubRepo", envName),
            new AppConfig.NetworkConfig(
                requireString(env, "vpcCidr", envName),
                requireBoolean(env, "natGatewayEnabled", envName),
                requireStringList(env, "availabilityZones", envName)
            ),
            new AppConfig.ComputeConfig(
                requireString(env, "ec2InstanceType", envName),
                requireString(env, "ec2Architecture", envName),
                requireInt(env, "ec2RootVolumeGb", envName),
                optionalString(env, "ec2AdminCidrForSsm", ""),
                requireStringList(env, "cloudflareIpv4Ranges", envName),
                requireStringList(env, "cloudflareIpv6Ranges", envName)
            ),
            new AppConfig.DatabaseConfig(
                requireString(env, "rdsInstanceClass", envName),
                requireInt(env, "rdsAllocatedStorageGb", envName),
                requireInt(env, "rdsMaxAllocatedStorageGb", envName),
                requireBoolean(env, "rdsMultiAz", envName),
                requireBoolean(env, "rdsDeletionProtection", envName),
                requireInt(env, "rdsBackupRetentionDays", envName),
                requireInt(env, "rdsPerformanceInsightsRetentionDays", envName)
            ),
            new AppConfig.RedisConfig(
                requireString(env, "redisNodeType", envName),
                requireInt(env, "redisNumNodes", envName)
            ),
            new AppConfig.StorageConfig(
                requireInt(env, "backupBucketGlacierTransitionDays", envName),
                requireInt(env, "backupBucketExpirationDays", envName),
                requireInt(env, "backupBucketNoncurrentExpirationDays", envName)
            ),
            new AppConfig.MonitoringConfig(
                requireString(env, "alarmEmail", envName),
                requireInt(env, "logRetentionDays", envName)
            )
        );
    }

    /**
     * The AWS account is deliberately not required to be hardcoded in cdk.json (avoids
     * committing an account ID to source control). Precedence: explicit {@code account} in the
     * environment block, then {@code CDK_DEFAULT_ACCOUNT} (set by the CDK CLI from the caller's
     * resolved AWS credentials), then fail with a clear instruction.
     */
    private static String resolveAccount(App app, Map<?, ?> env, String envName) {
        String configured = optionalString(env, "account", "");
        if (!configured.isBlank()) {
            return configured;
        }
        String fromCallerIdentity = System.getenv("CDK_DEFAULT_ACCOUNT");
        if (fromCallerIdentity != null && !fromCallerIdentity.isBlank()) {
            return fromCallerIdentity;
        }
        throw new IllegalStateException(
            ("No AWS account resolved for environment '%s'. Either set 'account' in cdk.json's "
                + "wealthynest:environments.%s block, or ensure the CDK CLI has resolved AWS "
                + "credentials (CDK_DEFAULT_ACCOUNT) before running synth/diff/deploy.")
                .formatted(envName, envName));
    }

    private static String stringContext(App app, String key, String defaultValue) {
        Object value = app.getNode().tryGetContext(key);
        return value == null ? defaultValue : value.toString();
    }

    private static String requireString(Map<?, ?> env, String key, String envName) {
        Object value = env.get(key);
        if (!(value instanceof String s) || s.isBlank()) {
            throw missing(key, envName);
        }
        return s;
    }

    private static String optionalString(Map<?, ?> env, String key, String defaultValue) {
        Object value = env.get(key);
        return value instanceof String s ? s : defaultValue;
    }

    private static boolean requireBoolean(Map<?, ?> env, String key, String envName) {
        Object value = env.get(key);
        if (!(value instanceof Boolean b)) {
            throw missing(key, envName);
        }
        return b;
    }

    private static int requireInt(Map<?, ?> env, String key, String envName) {
        Object value = env.get(key);
        if (value instanceof Number n) {
            return n.intValue();
        }
        if (value instanceof String s) {
            try {
                return Integer.parseInt(s);
            } catch (NumberFormatException e) {
                throw missing(key, envName);
            }
        }
        throw missing(key, envName);
    }

    private static List<String> requireStringList(Map<?, ?> env, String key, String envName) {
        Object value = env.get(key);
        if (!(value instanceof List<?> rawList) || rawList.isEmpty()) {
            throw missing(key, envName);
        }
        List<String> result = new ArrayList<>(rawList.size());
        for (Object item : rawList) {
            result.add(String.valueOf(item));
        }
        return List.copyOf(result);
    }

    private static IllegalStateException missing(String key, String envName) {
        return new IllegalStateException(
            "Missing/invalid required config key '%s' for environment '%s' in cdk.json"
                .formatted(key, envName));
    }
}
