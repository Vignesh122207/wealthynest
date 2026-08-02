package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.config.AppSecrets;
import com.wealthynest.infrastructure.constructs.Ec2AppServerConstruct;
import com.wealthynest.infrastructure.constructs.LogRetentionMapper;
import java.util.List;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.ec2.CfnSecurityGroupIngress;
import software.amazon.awscdk.services.ec2.ExecuteFileOptions;
import software.amazon.awscdk.services.ec2.ISecurityGroup;
import software.amazon.awscdk.services.ec2.IVpc;
import software.amazon.awscdk.services.ec2.S3DownloadOptions;
import software.amazon.awscdk.services.ec2.UserData;
import software.amazon.awscdk.services.kms.IKey;
import software.amazon.awscdk.services.logs.LogGroup;
import software.amazon.awscdk.services.logs.RetentionDays;
import software.amazon.awscdk.services.s3.Bucket;
import software.amazon.awscdk.services.s3.assets.Asset;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.constructs.Construct;

/**
 * The backend app server. Boots by downloading {@code scripts/bootstrap-ec2.sh} (uploaded as a
 * CDK asset, not inlined into UserData — keeps the actual install logic in one reviewable,
 * independently-runnable script instead of buried in a 16KB-limited UserData blob) and executing
 * it. Every application-data permission (which secrets, which bucket) is granted here, at the
 * stack that actually needs them — the instance role itself
 * ({@link Ec2AppServerConstruct}) only carries SSM + CloudWatch Agent policies.
 *
 * <p>Also opens RDS/Redis ingress for its own security group (rather than DatabaseStack opening
 * it) — see the dependency-direction note on {@link DatabaseStack} for why that's required to
 * avoid a cyclic stack dependency.
 */
public class ComputeStack extends Stack {

    // SSM parameter suffix (under AppConfig#namespace), eventually read by CicdStack/MonitoringStack
    // via an SSM dynamic reference instead of taking this stack's Instance object directly, so a
    // direct CDK cross-stack Ref stops putting the instance behind a CloudFormation export that
    // CloudFormation could later refuse to change while still imported elsewhere (see the
    // 2026-08-01 incident this is meant to fix). Published starting now (phase 1) so the value
    // exists in SSM before phase 2 switches CicdStack/MonitoringStack's reads over to it - see
    // those classes' own TEMPORARY notes for why they still take the Instance directly for now.
    public static final String APP_SERVER_INSTANCE_ID_PARAM = "app-server-instance-id";

    private final Ec2AppServerConstruct appServer;

    public ComputeStack(
        Construct scope,
        String id,
        StackProps props,
        AppConfig config,
        IVpc vpc,
        IKey dataKey,
        Bucket backupBucket,
        AppSecrets secrets,
        DatabaseStack database,
        ISecurityGroup secretsManagerEndpointSecurityGroup
    ) {
        super(scope, id, props);

        Asset bootstrapAsset = Asset.Builder.create(this, "BootstrapScriptAsset")
            .path("scripts/bootstrap-ec2.sh")
            .build();
        Asset nginxConfigAsset = Asset.Builder.create(this, "NginxConfigAsset")
            .path("nginx/api.wealthynest.in.conf")
            .build();
        Asset systemdUnitAsset = Asset.Builder.create(this, "SystemdUnitAsset")
            .path("systemd/wealthynest-backend.service")
            .build();

        UserData userData = UserData.forLinux();
        // Ubuntu Server AMIs (unlike Amazon Linux) don't ship the AWS CLI - addS3DownloadCommand()
        // below generates `aws s3 cp` calls that would otherwise fail with "command not found"
        // before bootstrap-ec2.sh is even downloaded.
        userData.addCommands("apt-get update -y", "apt-get install -y awscli");
        // bootstrap-ec2.sh's nginx and systemd steps look for these at these exact paths.
        userData.addS3DownloadCommand(S3DownloadOptions.builder()
            .bucket(nginxConfigAsset.getBucket())
            .bucketKey(nginxConfigAsset.getS3ObjectKey())
            .localFile("/tmp/wealthynest-nginx.conf")
            .build());
        userData.addS3DownloadCommand(S3DownloadOptions.builder()
            .bucket(systemdUnitAsset.getBucket())
            .bucketKey(systemdUnitAsset.getS3ObjectKey())
            .localFile("/tmp/wealthynest-backend.service")
            .build());
        String localScriptPath = userData.addS3DownloadCommand(S3DownloadOptions.builder()
            .bucket(bootstrapAsset.getBucket())
            .bucketKey(bootstrapAsset.getS3ObjectKey())
            .build());
        userData.addExecuteFileCommand(ExecuteFileOptions.builder()
            .filePath(localScriptPath)
            .arguments(config.envName() + " " + config.region())
            .build());

        this.appServer = new Ec2AppServerConstruct(this, "AppServer", new Ec2AppServerConstruct.Props(
            vpc,
            config.compute().instanceType(),
            config.compute().architecture(),
            config.compute().rootVolumeGb(),
            config.compute().cloudflareIpv4Ranges(),
            config.compute().cloudflareIpv6Ranges(),
            config.compute().adminCidrForSsm(),
            userData,
            dataKey,
            config.resourceName("app-server"),
            config.resourceName("sg-app")
        ));

        StringParameter.Builder.create(this, "AppServerInstanceIdParameter")
            .parameterName(config.namespace(APP_SERVER_INSTANCE_ID_PARAM))
            .description("EC2 instance ID of the backend app server - read via SSM dynamic "
                + "reference by CicdStack/MonitoringStack, deliberately not passed as a direct "
                + "CDK Ref (see APP_SERVER_INSTANCE_ID_PARAM's own comment)")
            .stringValue(appServer.getInstance().getInstanceId())
            .build();

        // Single-sources RATE_LIMIT_TRUSTED_PROXIES (deploy-backend.sh) from the same
        // cloudflareIpv4Ranges cdk.json already drives the security group and nginx's
        // set_real_ip_from with - one list, three enforcement points, instead of a third
        // hand-copied duplicate that could silently drift from the other two.
        StringParameter trustedProxiesParameter = StringParameter.Builder.create(this, "RateLimitTrustedProxiesParameter")
            .parameterName(config.namespace("rate-limit-trusted-proxies"))
            .description("Comma-joined Cloudflare IPv4 ranges for wealthynest-api's RATE_LIMIT_TRUSTED_PROXIES")
            .stringValue(String.join(",", config.compute().cloudflareIpv4Ranges()))
            .build();

        // CloudWatch Log Groups + the CloudWatch Agent's own config, both live here rather than
        // in MonitoringStack (despite reading like a "Monitoring" concern) - the instance role
        // needs read access to the config parameter below, and granting that from MonitoringStack
        // would make ComputeStack depend on MonitoringStack, which already depends on ComputeStack
        // (it takes this very instance, for the alarms it builds) - a cycle for the same reason
        // documented on DatabaseStack and this stack's ingress rules above. Keeping both here
        // also means they exist *before* this instance's UserData ever runs, instead of racing a
        // separately-deployed stack for it (see bootstrap-ec2.sh's own retry loop for the case
        // where IAM's eventual consistency still causes a first-attempt miss).
        RetentionDays logRetention = LogRetentionMapper.fromDays(config.monitoring().logRetentionDays());
        LogGroup appLogGroup = LogGroup.Builder.create(this, "AppLogGroup")
            .logGroupName(config.namespace("app"))
            .retention(logRetention)
            .build();
        LogGroup nginxLogGroup = LogGroup.Builder.create(this, "NginxLogGroup")
            .logGroupName(config.namespace("nginx"))
            .retention(logRetention)
            .build();
        LogGroup systemLogGroup = LogGroup.Builder.create(this, "SystemLogGroup")
            .logGroupName(config.namespace("system"))
            .retention(logRetention)
            .build();
        StringParameter cloudWatchAgentConfigParameter = StringParameter.Builder.create(this, "CloudWatchAgentConfig")
            .parameterName(config.namespace("cloudwatch-agent-config"))
            .description("CloudWatch Agent config (metrics + log tailing) for the backend app server")
            .stringValue(cloudWatchAgentConfigJson(
                appLogGroup.getLogGroupName(), nginxLogGroup.getLogGroupName(), systemLogGroup.getLogGroupName()))
            .build();

        bootstrapAsset.getBucket().grantRead(appServer.getRole(), bootstrapAsset.getS3ObjectKey());
        nginxConfigAsset.getBucket().grantRead(appServer.getRole(), nginxConfigAsset.getS3ObjectKey());
        systemdUnitAsset.getBucket().grantRead(appServer.getRole(), systemdUnitAsset.getS3ObjectKey());
        backupBucket.grantReadWrite(appServer.getRole());
        for (ISecret secret : secrets.all()) {
            secret.grantRead(appServer.getRole());
        }
        for (StringParameter parameter : List.of(
            database.getDbUrlParameter(), database.getRedisHostParameter(), database.getRedisPortParameter(),
            trustedProxiesParameter, cloudWatchAgentConfigParameter
        )) {
            parameter.grantRead(appServer.getRole());
        }

        // Deliberately the L1 CfnSecurityGroupIngress, not the more obvious
        // database.getDatabase().allowIngressFrom(appServer.getSecurityGroup(), ...). That L2
        // convenience method calls addIngressRule() *on the database's own SecurityGroup
        // construct*, which creates the resulting AWS::EC2::SecurityGroupIngress as a child of
        // that construct - i.e. still physically inside DatabaseStack - no matter which stack's
        // Java code happens to invoke it from. That would make DatabaseStack depend on
        // ComputeStack for the peer's security group ID, which combined with ComputeStack
        // already depending on DatabaseStack (the SSM parameter grants below) is a cycle.
        // Building the ingress rule as its own top-level resource, scoped to `this`
        // (ComputeStack), makes it a ComputeStack resource that merely references Database's
        // security group ID as an imported value - Compute -> Database, never the reverse.
        CfnSecurityGroupIngress.Builder.create(this, "DatabaseIngressFromAppServer")
            .groupId(database.getDatabase().getSecurityGroup().getSecurityGroupId())
            .sourceSecurityGroupId(appServer.getSecurityGroup().getSecurityGroupId())
            .ipProtocol("tcp")
            .fromPort(5432)
            .toPort(5432)
            .description("Backend app server to PostgreSQL")
            .build();
        CfnSecurityGroupIngress.Builder.create(this, "CacheIngressFromAppServer")
            .groupId(database.getCache().getSecurityGroup().getSecurityGroupId())
            .sourceSecurityGroupId(appServer.getSecurityGroup().getSecurityGroupId())
            .ipProtocol("tcp")
            .fromPort(6379)
            .toPort(6379)
            .description("Backend app server to Redis")
            .build();

        // Without this, DNS for secretsmanager.<region>.amazonaws.com resolves (VPC-wide, thanks
        // to the endpoint's PrivateDnsEnabled) to the interface endpoint's private IP even for
        // this public-subnet instance - but that endpoint's own security group (NetworkStack) only
        // ever had ingress opened for the DB rotation Lambda's SG, so the app server's traffic gets
        // silently dropped (long hang, no error) instead of an explicit reject. Same per-consumer
        // explicit-ingress pattern as DatabaseIngressFromRotationLambda in DatabaseStack.
        CfnSecurityGroupIngress.Builder.create(this, "SecretsManagerEndpointIngressFromAppServer")
            .groupId(secretsManagerEndpointSecurityGroup.getSecurityGroupId())
            .sourceSecurityGroupId(appServer.getSecurityGroup().getSecurityGroupId())
            .ipProtocol("tcp")
            .fromPort(443)
            .toPort(443)
            .description("Backend app server to the Secrets Manager VPC endpoint")
            .build();
    }

    private static String cloudWatchAgentConfigJson(String appLogGroupName, String nginxLogGroupName,
                                                      String systemLogGroupName) {
        return """
            {
              "agent": { "metrics_collection_interval": 60, "run_as_user": "root" },
              "metrics": {
                "namespace": "CWAgent",
                "append_dimensions": { "InstanceId": "${aws:InstanceId}" },
                "metrics_collected": {
                  "mem": { "measurement": ["mem_used_percent"] },
                  "disk": { "measurement": ["disk_used_percent"], "resources": ["/"] }
                }
              },
              "logs": {
                "logs_collected": {
                  "files": {
                    "collect_list": [
                      {
                        "file_path": "/var/log/wealthynest/app.log",
                        "log_group_name": "%s",
                        "log_stream_name": "{instance_id}"
                      },
                      {
                        "file_path": "/var/log/nginx/access.log",
                        "log_group_name": "%s",
                        "log_stream_name": "{instance_id}-access"
                      },
                      {
                        "file_path": "/var/log/nginx/error.log",
                        "log_group_name": "%s",
                        "log_stream_name": "{instance_id}-error"
                      },
                      {
                        "file_path": "/var/log/syslog",
                        "log_group_name": "%s",
                        "log_stream_name": "{instance_id}"
                      }
                    ]
                  }
                }
              }
            }
            """.formatted(appLogGroupName, nginxLogGroupName, nginxLogGroupName, systemLogGroupName);
    }

    public Ec2AppServerConstruct getAppServer() {
        return appServer;
    }
}
