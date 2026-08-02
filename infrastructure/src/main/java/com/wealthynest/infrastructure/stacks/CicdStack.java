package com.wealthynest.infrastructure.stacks;

import com.wealthynest.infrastructure.config.AppConfig;
import java.util.List;
import java.util.Map;
import software.amazon.awscdk.ArnComponents;
import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.ec2.Instance;
import software.amazon.awscdk.services.iam.Effect;
import software.amazon.awscdk.services.iam.OpenIdConnectPrincipal;
import software.amazon.awscdk.services.iam.OpenIdConnectProvider;
import software.amazon.awscdk.services.iam.PolicyStatement;
import software.amazon.awscdk.services.iam.Role;
import software.amazon.awscdk.services.s3.Bucket;
import software.constructs.Construct;

/**
 * GitHub Actions authenticates to AWS via OIDC federation - no long-lived IAM access keys ever
 * sit in a GitHub secret. Two purpose-scoped roles, both trusted only for this exact repo.
 *
 * <p><b>The OIDC {@code sub} claim's shape depends on whether the calling job specifies
 * {@code environment:}, not just its trigger event</b> - a subtlety easy to get wrong (this stack
 * did, until every push/PR touching {@code infrastructure/**} or {@code wealthynest-api/**} once
 * failed at the assume-role step with a generic "not authorized", regardless of a correct-looking
 * ref/pull_request condition). A plain push/pull_request job gets
 * {@code repo:<repo>:ref:refs/heads/<branch>} or {@code repo:<repo>:pull_request}; a job with
 * {@code environment: <name>} gets {@code repo:<repo>:environment:<name>} <i>instead</i>, not in
 * addition. Both {@code backend.yml} and {@code infra.yml} run their actual `deploy` step under
 * {@code environment: production} specifically so GitHub's environment protection rules
 * (required reviewers, wait timers) apply - so trust has to be granted for that claim shape too.
 *
 * <ul>
 *   <li>{@code BackendDeployRole} (backend.yml) - both jobs that assume this role
 *       ({@code deploy}, {@code rollback}) run under {@code environment: production}; the
 *       {@code build} job needs no AWS credentials at all. So this role only ever needs to trust
 *       the {@code environment:production} claim shape, never the ref-based one.</li>
 *   <li>{@code InfraDeployRole} (infra.yml) - trusted for three distinct claim shapes: `synth`
 *       runs on both push (`ref:refs/heads/main`) and `pull_request` (`pull_request`) with no
 *       `environment:`, while `deploy` runs under `environment: production` like backend.yml's
 *       jobs do. Only permission is {@code sts:AssumeRole} on this account's CDK bootstrap roles
 *       (the standard AWS-documented pattern for CDK CI/CD) - it carries no direct resource
 *       permissions of its own, the bootstrap roles (created once by {@code cdk bootstrap}) are
 *       what actually provision resources.</li>
 * </ul>
 *
 * <p>Created last (depends on Compute's instance and Storage's bucket) so it can reference their
 * ARNs without risking the kind of cross-stack cycle documented on {@link DatabaseStack}.
 *
 * <p>TEMPORARY (phase 1 of the 2026-08-02 export-migration rollout, see ComputeStack): reverted
 * to taking Compute's Instance directly again so this deploy doesn't touch the still-imported
 * export. Switch back to the SSM parameter in phase 2, once nothing imports it.
 */
public class CicdStack extends Stack {

    public CicdStack(
        Construct scope,
        String id,
        StackProps props,
        AppConfig config,
        Instance appInstance,
        Bucket backupBucket
    ) {
        super(scope, id, props);

        OpenIdConnectProvider githubOidcProvider = OpenIdConnectProvider.Builder.create(this, "GitHubOidcProvider")
            .url("https://token.actions.githubusercontent.com")
            .clientIds(List.of("sts.amazonaws.com"))
            .build();

        // backend.yml's `deploy`/`rollback` jobs (the only ones that assume this role) both run
        // under `environment: production` - see this class's own doc comment for why that changes
        // the OIDC sub claim shape entirely rather than adding to the ref-based one.
        OpenIdConnectPrincipal githubPrincipal = new OpenIdConnectPrincipal(githubOidcProvider, Map.of(
            "StringEquals", Map.of("token.actions.githubusercontent.com:aud", "sts.amazonaws.com"),
            "StringLike", Map.of(
                "token.actions.githubusercontent.com:sub", "repo:" + config.githubRepo() + ":environment:production")
        ));

        // InfraDeployRole is assumed by three different claim shapes across infra.yml's two jobs -
        // see this class's own doc comment for why each exists and why they can't be merged into
        // fewer patterns.
        OpenIdConnectPrincipal githubInfraPrincipal = new OpenIdConnectPrincipal(githubOidcProvider, Map.of(
            "StringEquals", Map.of("token.actions.githubusercontent.com:aud", "sts.amazonaws.com"),
            "StringLike", Map.of(
                "token.actions.githubusercontent.com:sub", List.of(
                    "repo:" + config.githubRepo() + ":ref:refs/heads/main",
                    "repo:" + config.githubRepo() + ":pull_request",
                    "repo:" + config.githubRepo() + ":environment:production"
                ))
        ));

        Role backendDeployRole = Role.Builder.create(this, "BackendDeployRole")
            .roleName(config.resourceName("gha-backend-deploy"))
            .description("Assumed by backend.yml via GitHub OIDC to ship a new backend release - "
                + "no long-lived AWS keys in GitHub secrets")
            .assumedBy(githubPrincipal)
            .maxSessionDuration(Duration.hours(1))
            .build();
        backupBucket.grantReadWrite(backendDeployRole, "backend-releases/*");
        backendDeployRole.addToPolicy(PolicyStatement.Builder.create()
            .effect(Effect.ALLOW)
            .actions(List.of("ssm:SendCommand"))
            .resources(List.of(
                formatArn(ArnComponents.builder()
                    .service("ec2").resource("instance").resourceName(appInstance.getInstanceId()).build()),
                "arn:%s:ssm:%s::document/AWS-RunShellScript".formatted(getPartition(), getRegion())
            ))
            .build());
        backendDeployRole.addToPolicy(PolicyStatement.Builder.create()
            .effect(Effect.ALLOW)
            // AWS does not support resource-level scoping for these two read APIs - both are
            // keyed by a command ID handed back from SendCommand, not a fixed resource ARN.
            .actions(List.of("ssm:GetCommandInvocation", "ssm:ListCommandInvocations"))
            .resources(List.of("*"))
            .build());

        Role infraDeployRole = Role.Builder.create(this, "InfraDeployRole")
            .roleName(config.resourceName("gha-infra-deploy"))
            .description("Assumed by infra.yml via GitHub OIDC - only permission is assuming this "
                + "account's CDK bootstrap roles")
            .assumedBy(githubInfraPrincipal)
            .maxSessionDuration(Duration.hours(1))
            .build();
        infraDeployRole.addToPolicy(PolicyStatement.Builder.create()
            .effect(Effect.ALLOW)
            .actions(List.of("sts:AssumeRole"))
            .resources(List.of(
                "arn:%s:iam::%s:role/cdk-hnb659fds-*-role-%s-%s"
                    .formatted(getPartition(), getAccount(), getAccount(), getRegion())
            ))
            .build());

        CfnOutput.Builder.create(this, "BackendDeployRoleArn")
            .value(backendDeployRole.getRoleArn())
            .description("Set as the AWS_BACKEND_DEPLOY_ROLE_ARN repo variable, used by backend.yml")
            .build();
        CfnOutput.Builder.create(this, "InfraDeployRoleArn")
            .value(infraDeployRole.getRoleArn())
            .description("Set as the AWS_INFRA_DEPLOY_ROLE_ARN repo variable, used by infra.yml")
            .build();
    }
}
