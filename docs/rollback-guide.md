# Rollback Guide

## Backend (`wealthynest-api`)

Three layers, from fastest/automatic to manual:

### 1. Self-rollback inside `deploy-backend.sh` (automatic, ~2 minutes)

Every deploy writes the new release to `/opt/wealthynest/releases/<version>/`, flips the
`current` symlink, restarts the systemd service, then polls `http://127.0.0.1:8080/actuator/health`
for up to 2 minutes. If it never reports `"status":"UP"`, the script re-points `current` back to
the previous release and restarts again — no human or CI action needed. If that *also* fails to
become healthy, the script exits nonzero and leaves the instance in whatever state it's in for
manual inspection (see step 3).

### 2. Post-deploy smoke gate (automatic, ~2-3 minutes after step 1)

`backend.yml`'s `smoke` job calls `playwright.yml` against the live production URLs after the
deploy step reports success. If those checks fail — landing page, login page, or a rejected-login
round trip through the real backend — the `rollback` job fires automatically: it sends
`deploy-backend.sh --rollback` over SSM, which re-points `current` to the last version recorded in
`/opt/wealthynest/current-version` (written only after a release passes its own health check) and
restarts. The GitHub Actions run is marked failed either way — a rollback happening is not a green
build, it's a caught-and-corrected bad deploy.

### 3. Manual rollback

If you need to intervene directly (SSM Session Manager):

```bash
aws ssm start-session --target <instance-id>
sudo /opt/wealthynest/scripts/deploy-backend.sh --rollback
```

Or from a workstation with the right AWS credentials, without an interactive session:

```bash
aws ssm send-command \
  --instance-ids <instance-id> \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["/opt/wealthynest/scripts/deploy-backend.sh --rollback"]'
```

Rollback only has one version of history — the release *before* the one currently live. There's no
"go back 3 versions" without redeploying that specific commit through `backend.yml` again (push a
revert commit, or manually re-run the workflow against an older SHA).

### Checking what's actually running

```bash
readlink -f /opt/wealthynest/current   # -> /opt/wealthynest/releases/<version>
cat /opt/wealthynest/current-version   # last release that passed its health check
sudo systemctl status wealthynest-backend
sudo tail -f /var/log/wealthynest/app.log
```

## Frontend (`wealthynest-web`)

Vercel keeps every deployment. Dashboard → Project → Deployments → find the last good one →
**Promote to Production** — instant, no rebuild. No infrastructure-side action needed.

## Infrastructure (CDK)

CDK doesn't have a generic "rollback" command — a bad `cdk deploy` is fixed by deploying a
*corrected* state forward, same as application code:

```bash
git revert <bad-commit>          # or fix forward
git push origin main             # infra.yml deploys the corrected stacks
```

For a single misbehaving resource where you know the exact prior CloudFormation state, `cdk diff`
against the previous commit locally first to see exactly what would change, then deploy that
commit's `infrastructure/` tree. Avoid `cdk destroy` on stateful stacks
(`wealthynest-prod-database`, `wealthynest-prod-storage`) — both have `deletionProtection`/
`RemovalPolicy.RETAIN` specifically to make that a deliberate, hard-to-do-by-accident action; see
`disaster-recovery-guide.md` if you actually need to.
