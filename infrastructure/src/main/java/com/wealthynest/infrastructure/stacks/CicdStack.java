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
 * sit in a GitHub secret. Two purpose-scoped roles, both trusted only for this exact repo:
 *
 * <ul>
 *   <li>{@code BackendDeployRole} (backend.yml) - trusted only for pushes to {@code main} (that
 *       workflow has no {@code pull_request} trigger). Upload a JAR to S3, trigger
 *       {@code deploy-backend.sh} on the app server over SSM Send Command. No EC2/SSH access,
 *       no Secrets Manager access (the instance reads its own secrets via its own role).</li>
 *   <li>{@code InfraDeployRole} (infra.yml) - trusted for both pushes to {@code main} and
 *       {@code pull_request} runs (infra.yml's {@code synth} job runs read-only {@code cdk
 *       synth}/{@code diff} on PRs targeting main, which needs its own OIDC trust pattern - see
 *       {@code githubInfraPrincipal} below). Only permission is {@code sts:AssumeRole} on this
 *       account's CDK bootstrap roles (the standard AWS-documented pattern for CDK CI/CD). It
 *       carries no direct resource permissions of its own - the bootstrap roles, created once by
 *       {@code cdk bootstrap}, are what actually provision resources.</li>
 * </ul>
 *
 * <p>Created last (depends on Compute's instance and Storage's bucket) so it can reference their
 * ARNs without risking the kind of cross-stack cycle documented on {@link DatabaseStack}.
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

        OpenIdConnectPrincipal githubPrincipal = new OpenIdConnectPrincipal(githubOidcProvider, Map.of(
            "StringEquals", Map.of("token.actions.githubusercontent.com:aud", "sts.amazonaws.com"),
            "StringLike", Map.of(
                "token.actions.githubusercontent.com:sub", "repo:" + config.githubRepo() + ":ref:refs/heads/main")
        ));

        // infra.yml's `synth` job also runs on `pull_request` (read-only cdk synth/diff, already
        // scoped to PRs targeting main by the workflow's own trigger) - GitHub's OIDC `sub` claim
        // for a pull_request event is "repo:<repo>:pull_request", not the push event's
        // "ref:refs/heads/main" form, so InfraDeployRole alone needs both patterns trusted.
        // BackendDeployRole stays on the narrower push-only principal - backend.yml has no
        // pull_request trigger.
        OpenIdConnectPrincipal githubInfraPrincipal = new OpenIdConnectPrincipal(githubOidcProvider, Map.of(
            "StringEquals", Map.of("token.actions.githubusercontent.com:aud", "sts.amazonaws.com"),
            "StringLike", Map.of(
                "token.actions.githubusercontent.com:sub", List.of(
                    "repo:" + config.githubRepo() + ":ref:refs/heads/main",
                    "repo:" + config.githubRepo() + ":pull_request"
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
