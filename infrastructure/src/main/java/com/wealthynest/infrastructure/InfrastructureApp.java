package com.wealthynest.infrastructure;

import com.wealthynest.infrastructure.config.AppConfig;
import com.wealthynest.infrastructure.config.AppSecrets;
import com.wealthynest.infrastructure.config.ConfigLoader;
import com.wealthynest.infrastructure.stacks.CicdStack;
import com.wealthynest.infrastructure.stacks.ComputeStack;
import com.wealthynest.infrastructure.stacks.DatabaseStack;
import com.wealthynest.infrastructure.stacks.MonitoringStack;
import com.wealthynest.infrastructure.stacks.NetworkStack;
import com.wealthynest.infrastructure.stacks.OutputsStack;
import com.wealthynest.infrastructure.stacks.SecurityStack;
import com.wealthynest.infrastructure.stacks.StorageStack;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.Tags;

/**
 * Composition root. Stack order is a straight dependency chain - each stack only ever depends on
 * ones created before it, so CDK's automatic cross-stack-reference wiring (via CloudFormation
 * exports) is all the ordering this needs; no explicit {@code addDependency} calls required:
 *
 * <pre>
 * Network -&gt; Security -&gt; Storage -&gt; Database -&gt; Compute -&gt; Monitoring -&gt; Outputs -&gt; Cicd
 * </pre>
 *
 * {@code Cicd} is an 8th stack beyond the 7 originally scoped (Network, Compute, Database,
 * Security, Monitoring, Storage, Outputs) - GitHub Actions needs a way to authenticate to AWS
 * without long-lived access keys, which means IAM roles that reference Compute's instance and
 * Storage's bucket. Folding that into an existing stack would either overload Outputs' one job
 * (declaring CfnOutputs) or, worse, risk exactly the kind of cross-stack cycle documented on
 * {@link com.wealthynest.infrastructure.stacks.DatabaseStack} if placed anywhere upstream of
 * Compute/Storage. A small stack at the end of the chain, depending on everything and depended on
 * by nothing, was the only place that's both correctly named and provably acyclic.
 *
 * Database comes before Compute, and Compute (not Database) is the one that opens the RDS/Redis
 * security group ingress rule for its own security group — see the dependency-direction note on
 * {@link com.wealthynest.infrastructure.stacks.DatabaseStack} for why the naive reverse direction
 * is cyclic (RDS's {@code DatabaseInstance} unconditionally attaches its credentials secret to
 * itself, which makes SecurityStack depend on DatabaseStack; DatabaseStack depending back on
 * ComputeStack for its security group would close the loop). Storage comes before Compute because
 * the app server's IAM role needs read/write on the backup bucket.
 */
public final class InfrastructureApp {

    private InfrastructureApp() {
    }

    public static void main(String[] args) {
        App app = new App();
        AppConfig config = ConfigLoader.load(app);

        Environment environment = Environment.builder()
            .account(config.account())
            .region(config.region())
            .build();

        String stackPrefix = "wealthynest-" + config.envName();

        NetworkStack network = new NetworkStack(
            app, stackPrefix + "-network",
            stackProps(environment, "WealthyNest VPC, subnets, and routing"),
            config
        );

        SecurityStack security = new SecurityStack(
            app, stackPrefix + "-security",
            stackProps(environment, "WealthyNest KMS key and Secrets Manager credentials"),
            config
        );

        StorageStack storage = new StorageStack(
            app, stackPrefix + "-storage",
            stackProps(environment, "WealthyNest S3 backup bucket"),
            config, security.getDataKey()
        );

        AppSecrets secrets = new AppSecrets(
            security.getDatabaseCredentialsSecret(),
            security.getJwtSecret(),
            security.getGoogleOAuthClientSecret(),
            security.getSmtpCredentialsSecret(),
            security.getVaultEncryptionKeySecret(),
            security.getVaultHashPepperSecret(),
            security.getFcmServiceAccountSecret()
        );

        DatabaseStack database = new DatabaseStack(
            app, stackPrefix + "-database",
            stackProps(environment, "WealthyNest RDS PostgreSQL and ElastiCache Redis"),
            config, network.getVpc(), security.getDatabaseCredentialsSecret()
        );

        ComputeStack compute = new ComputeStack(
            app, stackPrefix + "-compute",
            stackProps(environment, "WealthyNest backend EC2 app server"),
            config, network.getVpc(), security.getDataKey(), storage.getBackupBucket(), secrets, database
        );

        new MonitoringStack(
            app, stackPrefix + "-monitoring",
            stackProps(environment, "WealthyNest dashboards, alarms, and log groups"),
            config, compute.getAppServer().getInstance(), database.getDatabase().getDatabaseInstance(),
            database.getCache().getReplicationGroup()
        );

        new OutputsStack(
            app, stackPrefix + "-outputs",
            stackProps(environment, "WealthyNest deployment outputs"),
            config,
            compute.getAppServer().getPublicIp(),
            database.getDatabase().getDatabaseInstance(),
            database.getCache().getPrimaryEndpointAddress(),
            database.getCache().getPrimaryEndpointPort(),
            storage.getBackupBucket(),
            secrets
        );

        new CicdStack(
            app, stackPrefix + "-cicd",
            stackProps(environment, "WealthyNest GitHub Actions OIDC deploy roles"),
            config, compute.getAppServer().getInstance(), storage.getBackupBucket()
        );

        Tags.of(app).add("Project", "WealthyNest");
        Tags.of(app).add("Environment", config.envName());
        Tags.of(app).add("ManagedBy", "CDK");

        app.synth();
    }

    private static StackProps stackProps(Environment environment, String description) {
        return StackProps.builder()
            .env(environment)
            .description(description)
            .build();
    }
}
