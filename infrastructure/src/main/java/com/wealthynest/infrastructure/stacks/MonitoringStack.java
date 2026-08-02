package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.constructs.AlarmFactory;
import java.util.List;
import java.util.Map;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.cloudwatch.Alarm;
import software.amazon.awscdk.services.cloudwatch.ComparisonOperator;
import software.amazon.awscdk.services.cloudwatch.Dashboard;
import software.amazon.awscdk.services.cloudwatch.GraphWidget;
import software.amazon.awscdk.services.cloudwatch.IMetric;
import software.amazon.awscdk.services.cloudwatch.Metric;
import software.amazon.awscdk.services.cloudwatch.TreatMissingData;
import software.amazon.awscdk.services.cloudwatch.actions.Ec2Action;
import software.amazon.awscdk.services.cloudwatch.actions.Ec2InstanceAction;
import software.amazon.awscdk.services.cloudwatch.actions.SnsAction;
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
 *
 * <p>TEMPORARY (phase 1 of the 2026-08-02 export-migration rollout, see ComputeStack): reverted
 * to taking Compute's Instance directly again so this deploy doesn't touch the still-imported
 * export. Switch back to the SSM parameter in phase 2, once nothing imports it.
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

        alarms.threshold(config.resourceName("ec2-cpu-high"), cpuMetric,
            80, 3, ComparisonOperator.GREATER_THAN_THRESHOLD,
            "EC2 CPU above 80% for 3 consecutive 5-minute periods");
        alarms.threshold(config.resourceName("ec2-memory-high"), memoryMetric,
            85, 3, ComparisonOperator.GREATER_THAN_THRESHOLD,
            "EC2 memory above 85% for 3 consecutive 5-minute periods");
        alarms.threshold(config.resourceName("ec2-disk-high"), diskMetric,
            85, 3, ComparisonOperator.GREATER_THAN_THRESHOLD,
            "EC2 root volume above 85% used for 3 consecutive 5-minute periods");

        // This app is a single EC2 instance with no ASG, so a host-level hardware fault (not just
        // an app crash - systemd's Restart=on-failure already covers that case) would otherwise
        // mean downtime until someone manually intervenes. AWS's own auto-recovery migrates the
        // instance to new hardware, preserving instance ID/EIP association/EBS volumes, when the
        // *system* status check fails twice in a row (2 x 1-minute periods is the AWS-documented
        // threshold for this specific check - not the same cadence as the other alarms above).
        // Goes through AlarmFactory's SNS notify as well, not just this construct's dedicated
        // Ec2Action, so an actual recovery event still shows up as an ops notification.
        IMetric systemStatusCheckMetric = Metric.Builder.create()
            .namespace("AWS/EC2")
            .metricName("StatusCheckFailed_System")
            .dimensionsMap(Map.of("InstanceId", instanceId))
            .statistic("Maximum")
            .period(Duration.minutes(1))
            .build();
        Alarm recoveryAlarm = Alarm.Builder.create(this, "SystemStatusCheckFailedAlarm")
            .alarmName(config.resourceName("ec2-system-status-check-failed"))
            .metric(systemStatusCheckMetric)
            .threshold(0)
            .evaluationPeriods(2)
            .comparisonOperator(ComparisonOperator.GREATER_THAN_THRESHOLD)
            .treatMissingData(TreatMissingData.NOT_BREACHING)
            .alarmDescription("EC2 system status check failed twice in a row - AWS auto-recovers "
                + "the instance to new underlying hardware")
            .build();
        recoveryAlarm.addAlarmAction(new Ec2Action(Ec2InstanceAction.RECOVER));
        recoveryAlarm.addAlarmAction(new SnsAction(alarmTopic));

        alarms.threshold(config.resourceName("rds-cpu-high"), database.metricCPUUtilization(),
            80, 3, ComparisonOperator.GREATER_THAN_THRESHOLD, "RDS CPU above 80%");
        alarms.threshold(config.resourceName("rds-free-storage-low"), database.metricFreeStorageSpace(),
            2_000_000_000, 1, ComparisonOperator.LESS_THAN_THRESHOLD, "RDS free storage below 2GB");
        alarms.threshold(config.resourceName("rds-freeable-memory-low"), database.metricFreeableMemory(),
            256_000_000, 3, ComparisonOperator.LESS_THAN_THRESHOLD, "RDS freeable memory below 256MB");
        alarms.threshold(config.resourceName("rds-connections-high"), database.metricDatabaseConnections(),
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

        alarms.threshold(config.resourceName("redis-cpu-high"), redisCpuMetric,
            80, 3, ComparisonOperator.GREATER_THAN_THRESHOLD, "Redis engine CPU above 80%");
        alarms.threshold(config.resourceName("redis-evictions-high"), redisEvictionsMetric,
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
