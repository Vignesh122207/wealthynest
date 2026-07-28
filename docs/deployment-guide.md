# Deployment Guide

See `architecture-diagram.md` for the full picture and `secrets-management-guide.md` for the
credential list referenced throughout this guide.

## One-time setup (do this before the first `git push` triggers anything)

### 1. AWS account and CDK bootstrap

```bash
# From a machine with real (admin-level) AWS credentials for the target account - not CI.
cd infrastructure
npm install -g aws-cdk
export CDK_DEFAULT_ACCOUNT=<your-account-id>
export CDK_DEFAULT_REGION=ap-south-1
cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION
```

This creates the `cdk-hnb659fds-*` roles that `InfraDeployRole` (see below) is only ever allowed
to assume — CI can't do this step itself, by design (it needs broader permissions than anything
CI should hold).

### 2. First `cdk deploy`

```bash
mvn -pl infrastructure clean install
cd infrastructure
cdk deploy --all
```

Note the outputs — `wealthynest-prod-cicd`'s `BackendDeployRoleArn`/`InfraDeployRoleArn`,
`wealthynest-prod-outputs`'s `AppServerPublicIp`/`BackupBucketName`. You'll need them next.

### 3. GitHub repository configuration

**Settings → Secrets and variables → Actions → Variables** (not secrets — these aren't sensitive):

| Variable | Value |
|---|---|
| `AWS_BACKEND_DEPLOY_ROLE_ARN` | `BackendDeployRoleArn` output |
| `AWS_INFRA_DEPLOY_ROLE_ARN` | `InfraDeployRoleArn` output |
| `AWS_APP_INSTANCE_ID` | The EC2 instance ID (`aws ec2 describe-instances` filtered by the `Name` tag, or the AWS Console) |
| `AWS_BACKUP_BUCKET_NAME` | `BackupBucketName` output |
| `AWS_API_DOMAIN` | `api.wealthynest.in` |

**Settings → Secrets and variables → Actions → Secrets** (Vercel deploy only — everything AWS-side
uses OIDC, no AWS keys ever go here):

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | Vercel account settings → Tokens |
| `VERCEL_ORG_ID` | `wealthynest-web/.vercel/project.json` after `vercel link`, or Vercel project settings |
| `VERCEL_PROJECT_ID` | Same place |

If this Vercel project already has its **Git integration** connected to this repo (auto-deploy on
push), disconnect it (Vercel dashboard → Project → Settings → Git) before relying on
`frontend.yml` — otherwise every push deploys twice.

### 4. DNS (Cloudflare)

- `wealthynest.in` → Vercel (however Vercel's own docs say to point it — CNAME/A per their
  current instructions).
- `api.wealthynest.in` → **A record** → the `AppServerPublicIp` output, **proxied (orange
  cloud)**. DNS-only (grey cloud) would work but loses the WAF/DDoS protection and exposes the
  origin IP directly — see `architecture-diagram.md`.
- SSL/TLS mode: **Full (strict)**.

### 5. TLS: Cloudflare Origin CA certificate

Nginx needs a real cert, not the temporary self-signed one `bootstrap-ec2.sh` generates so it can
at least start:

1. Cloudflare dashboard → SSL/TLS → Origin Server → **Create Certificate** (RSA 2048, hostnames
   `api.wealthynest.in`, 15-year validity is fine — Cloudflare, not a public CA, validates it).
2. Connect over SSM Session Manager (`aws ssm start-session --target <instance-id>`) and place the
   two files:
   ```bash
   sudo tee /etc/nginx/ssl/cloudflare-origin.pem   # paste the certificate
   sudo tee /etc/nginx/ssl/cloudflare-origin.key   # paste the private key
   sudo chmod 600 /etc/nginx/ssl/cloudflare-origin.key
   sudo nginx -t && sudo systemctl reload nginx
   ```

### 6. Populate the placeholder secrets

Five of the eight Secrets Manager entries are provisioned empty (`REPLACE_ME_POST_DEPLOY`) because
the real values either come from an external system or need a specific byte length CDK
auto-generation can't safely guarantee. See `secrets-management-guide.md` for the exact
`aws secretsmanager put-secret-value` command for each one.

### 7. First backend deploy

Push to `main` with a change under `wealthynest-api/**` (or trigger `backend.yml` manually via
`workflow_dispatch` if you add that trigger) — `backend.yml` builds, uploads, and runs
`deploy-backend.sh` over SSM, which writes `/opt/wealthynest/current.env` from the secrets/params
above and starts the systemd service for the first time.

## Redis TLS — known gap, deliberately not closed here

`RedisReplicationGroupConstruct` has `transitEncryptionEnabled(false)`. ElastiCache requires
transit encryption before it will accept an AUTH token at all, and `wealthynest-api`'s
`application.yml` has no `spring.data.redis.ssl.*` configuration today — only a plain-TCP
`REDIS_PASSWORD`, matching local dev. Enabling transit encryption on the infrastructure side
without a corresponding one-line Spring config change would silently break every Redis connection
in production. This infrastructure work was scoped to not touch backend code, so: the fix is a
real but small backend PR (`spring.data.redis.ssl.enabled=true` plus re-enabling
`transitEncryptionEnabled`/`authToken` in `RedisReplicationGroupConstruct`), tracked as a
follow-up rather than done silently here. Until then, network isolation (private-isolated subnet +
security-group allowlist of exactly the app server) is the access control on Redis.

## Ongoing deploys

Push to `main`:
- Changes under `wealthynest-web/**` → `frontend.yml` → Vercel.
- Changes under `wealthynest-api/**` → `backend.yml` → build, test, package, upload to S3, deploy
  via SSM, external health check, then `playwright.yml`'s post-deploy smoke checks; a smoke
  failure triggers an automatic rollback (see `rollback-guide.md`).
- Changes under `infrastructure/**` → `infra.yml` → `mvn verify`, `cdk synth`, `cdk deploy --all`
  (PRs get `cdk diff` instead of deploy).

Nothing needs to be triggered by hand for a normal change.
