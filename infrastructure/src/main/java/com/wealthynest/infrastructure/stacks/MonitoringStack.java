package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.constructs.AlarmFactory;
import java.util.List;
import java.util.Map;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.cloudwatch.ComparisonOperator;
import software.amazon.awscdk.services.cloudwatch.Dashboard;
import software.amazon.awscdk.services.cloudwatch.GraphWidget;
import software.amazon.awscdk.services.cloudwatch.IMetric;
import software.amazon.awscdk.services.cloudwatch.Metric;
import software.amazon.awscdk.services.ec2.Instance;
import software.amazon.awscdk.services.elasticache.CfnReplicationGroup;
import software.amazon.awscdk.services.rds.DatabaseInstance;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.sns.subscriptions.EmailSubscription;
import software.constructs.Construct;

/**
 * SNS alarm topic, dashboard, and EC2/RDS/ElastiCache alarms. The CloudWatch Log Groups and the
 * CloudWatch Agent's own SSM-Parameter-Store config live in {@link ComputeStack} instead, even
 * though "CloudWatch Logs" reads like a Monitoring concern - {@code ComputeStack}'s own comment
 * on {@code CloudWatchAgentConfig} explains why: the instance role needs to read that parameter,
 * and granting that read here would make ComputeStack depend on MonitoringStack, which already
 * depends on ComputeStack (it takes the instance itself, for the alarms below) - a cycle for the
 * same underlying reason documented on {@code DatabaseStack} and {@code ComputeStack}'s ingress
 * rules. This stack only ever reaches *into* Compute/Database, never the other way.
 */
public class MonitoringStack extends Stack {

    private final Topic alarmTopic;
    private final Dashboard dashboard;

    public MonitoringStack(
        Construct scope,
        String id,
        StackProps props,
        AppConfig config,
        Instance appInstance,
        DatabaseInstance database,
        CfnReplicationGroup cache
    ) {
        super(scope, id, props);

        this.alarmTopic = Topic.Builder.create(this, "AlarmTopic")
            .topicName(config.resourceName("alarms"))
            .displayName("WealthyNest production alarms")
            .build();
        alarmTopic.addSubscription(new EmailSubscription(config.monitoring().alarmEmail()));

        AlarmFactory alarms = new AlarmFactory(this, alarmTopic);
        String instanceId = appInstance.getInstanceId();

        IMetric memoryMetric = Metric.Builder.create()
            .namespace("CWAgent")
            .metricName("mem_used_percent")
            .dimensionsMap(Map.of("InstanceId", instanceId))
            .statistic("Average")
            .period(Duration.minutes(5))
            .build();
        IMetric diskMetric = Metric.Builder.create()
            .namespace("CWAgent")
            .metricName("disk_used_percent")
            .dimensionsMap(Map.of("InstanceId", instanceId, "path", "/", "fstype", "ext4"))
            .statistic("Average")
            .period(Duration.minutes(5))
            .build();
        // The L2 Instance construct doesn't expose metric helpers (unlike AutoScalingGroup /
        // Alarms-friendly constructs elsewhere in CDK) - build the standard EC2 CPU metric by hand.
        IMetric cpuMetric = Metric.Builder.create()
            .namespace("AWS/EC2")
            .metricName("CPUUtilization")
            .dimensionsMap(Map.of("InstanceId", instanceId))
            .statistic("Average")
            .period(Duration.minutes(5))
            .build();

        alarms.threshold("wealthynest-ec2-cpu-high", cpuMetric,
            80, 3, ComparisonOperator.GREATER_THAN_THRESHOLD,
            "EC2 CPU above 80% for 3 consecutive 5-minute periods");
        alarms.threshold("wealthynest-ec2-memory-high", memoryMetric,
            85, 3, ComparisonOperator.GREATER_THAN_THRESHOLD,
            "EC2 memory above 85% for 3 consecutive 5-minute periods");
        alarms.threshold("wealthynest-ec2-disk-high", diskMetric,
            85, 3, ComparisonOperator.GREATER_THAN_THRESHOLD,
            "EC2 root volume above 85% used for 3 consecutive 5-minute periods");

        alarms.threshold("wealthynest-rds-cpu-high", database.metricCPUUtilization(),
            80, 3, ComparisonOperator.GREATER_THAN_THRESHOLD, "RDS CPU above 80%");
        alarms.threshold("wealthynest-rds-free-storage-low", database.metricFreeStorageSpace(),
            2_000_000_000, 1, ComparisonOperator.LESS_THAN_THRESHOLD, "RDS free storage below 2GB");
        alarms.threshold("wealthynest-rds-freeable-memory-low", database.metricFreeableMemory(),
            256_000_000, 3, ComparisonOperator.LESS_THAN_THRESHOLD, "RDS freeable memory below 256MB");
        alarms.threshold("wealthynest-rds-connections-high", database.metricDatabaseConnections(),
            80, 3, ComparisonOperator.GREATER_THAN_THRESHOLD, "RDS connection count above 80");

        // ElastiCache publishes per-node metrics under CacheClusterId, not ReplicationGroupId.
        // "<replicationGroupId>-001" is the documented, stable node-naming convention for the
        // primary node of a single-shard replication group (numCacheClusters=1, our default) -
        // revisit this if numNodes is ever raised past 1.
        String cacheClusterId = cache.getRef() + "-001";
        IMetric redisCpuMetric = Metric.Builder.create()
            .namespace("AWS/ElastiCache")
            .metricName("EngineCPUUtilization")
            .dimensionsMap(Map.of("CacheClusterId", cacheClusterId))
            .statistic("Average")
            .period(Duration.minutes(5))
            .build();
        IMetric redisEvictionsMetric = Metric.Builder.create()
            .namespace("AWS/ElastiCache")
            .metricName("Evictions")
            .dimensionsMap(Map.of("CacheClusterId", cacheClusterId))
            .statistic("Sum")
            .period(Duration.minutes(5))
            .build();

        alarms.threshold("wealthynest-redis-cpu-high", redisCpuMetric,
            80, 3, ComparisonOperator.GREATER_THAN_THRESHOLD, "Redis engine CPU above 80%");
        alarms.threshold("wealthynest-redis-evictions-high", redisEvictionsMetric,
            100, 3, ComparisonOperator.GREATER_THAN_THRESHOLD,
            "Redis evicting keys - working set no longer fits the node's memory");

        this.dashboard = Dashboard.Builder.create(this, "Dashboard")
            .dashboardName(config.resourceName("dashboard"))
            .build();
        dashboard.addWidgets(
            GraphWidget.Builder.create().title("EC2 - CPU").width(8)
                .left(List.of(cpuMetric)).build(),
            GraphWidget.Builder.create().title("EC2 - Memory %").width(8)
                .left(List.of(memoryMetric)).build(),
            GraphWidget.Builder.create().title("EC2 - Disk %").width(8)
                .left(List.of(diskMetric)).build()
        );
        dashboard.addWidgets(
            GraphWidget.Builder.create().title("RDS - CPU / Connections").width(12)
                .left(List.of(database.metricCPUUtilization()))
                .right(List.of(database.metricDatabaseConnections()))
                .build(),
            GraphWidget.Builder.create().title("RDS - Free Storage / Freeable Memory").width(12)
                .left(List.of(database.metricFreeStorageSpace()))
                .right(List.of(database.metricFreeableMemory()))
                .build()
        );
        dashboard.addWidgets(
            GraphWidget.Builder.create().title("Redis - CPU / Evictions").width(12)
                .left(List.of(redisCpuMetric))
                .right(List.of(redisEvictionsMetric))
                .build()
        );
    }

    public Topic getAlarmTopic() {
        return alarmTopic;
    }

    public Dashboard getDashboard() {
        return dashboard;
    }
}
