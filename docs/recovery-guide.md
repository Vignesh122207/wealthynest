# Recovery Guide

Operational recovery for single-component failures. For a full-region/account-loss scenario, see
`disaster-recovery-guide.md`.

## EC2 app server is unhealthy, unresponsive, or terminated

The instance holds no durable state of its own — the JAR, the env file, and the systemd unit are
all reproducible from S3/Secrets Manager/SSM on boot. Recovery is redeploying the compute layer,
not restoring a backup.

**Instance is up but the app is wedged:**
```bash
aws ssm start-session --target <instance-id>
sudo systemctl restart wealthynest-backend
sudo journalctl -u wealthynest-backend -n 200 --no-pager
```

**Instance itself is unhealthy (won't respond to SSM, failed status checks):**
```bash
cd infrastructure
cdk deploy wealthynest-production-compute
```
CDK's `Ec2AppServerConstruct` doesn't have a "replace this instance" button by itself, but
terminating the instance via the EC2 console and re-running `cdk deploy` on the compute stack
recreates it from the same UserData (re-runs `bootstrap-ec2.sh` fresh) and re-associates the same
Elastic IP — DNS doesn't need to change. After the instance is back, redeploy the backend
(`backend.yml`, or re-run `deploy-backend.sh` manually over SSM with the last known-good version)
since a fresh instance has no release deployed yet.

## RDS PostgreSQL is degraded or the data is wrong

**Instance-level issue (failover, degraded performance):** RDS handles Multi-AZ failover itself if
`rdsMultiAz` is enabled; on the cost-optimized single-AZ default, a hardware issue means waiting
for AWS to recover the instance or restoring from backup (below).

**Point-in-time restore** (accidental bad migration, bad data, etc.):
```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier wealthynest-production-postgres \
  --target-db-instance-identifier wealthynest-production-postgres-restored \
  --restore-time 2026-07-27T10:00:00Z
```
This creates a **new** instance — it does not overwrite the running one. Verify the restored data,
then either point the app at it (update the `/wealthynest/production/db-url` SSM parameter and the
DB credentials secret's target, or swap identifiers) or export/import just the needed rows.
`rdsBackupRetentionDays` (default 7) bounds how far back you can go.

**Restore from a specific automated or manual snapshot:**
```bash
aws rds describe-db-snapshots --db-instance-identifier wealthynest-production-postgres
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier wealthynest-production-postgres-restored \
  --db-snapshot-identifier <snapshot-id>
```

## ElastiCache Redis is degraded

Redis here holds only cache entries and rate-limit counters — nothing that isn't safe to lose.
Recovery is just replacing the resource, not restoring data:
```bash
cd infrastructure
cdk deploy wealthynest-production-database
```
If the replication group itself needs replacing (not just a node), delete it via the console/CLI
first — CDK will recreate it on the next deploy since it's declared in code. The app reconnects
automatically once `REDIS_HOST` (SSM parameter, updated by CDK on recreation) points at the new
endpoint and the service restarts.

## A deploy shipped a broken release

See `rollback-guide.md` — this is the common case and has three layers of automatic recovery
before any manual step is needed.

## Lost access to the EC2 instance entirely (SSM agent down, instance unreachable)

There's no SSH fallback by design (see the security review). If SSM Session Manager itself is the
thing that's broken (agent crashed, IAM role damaged), the recovery path is the same as "instance
is unhealthy" above — terminate and let CDK recreate it via `bootstrap-ec2.sh`, which reinstalls
and starts the SSM agent fresh via the `AmazonSSMManagedInstanceCore` managed policy.
