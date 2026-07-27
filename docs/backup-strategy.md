# Backup Strategy

## RDS PostgreSQL

- **Automated backups**: enabled, `rdsBackupRetentionDays` = 7 days (`cdk.json`, configurable).
  Continuous, point-in-time restore to any second within that window.
- **Final snapshot on deletion**: `RemovalPolicy.SNAPSHOT` (when `rdsDeletionProtection` is
  disabled) or `RemovalPolicy.RETAIN` (when enabled, the production default) — either way, a
  `cdk destroy`/stack deletion cannot silently take the database with it. See `PostgresDatabaseConstruct`.
- **Deletion protection**: enabled by default (`rdsDeletionProtection: true`) — a second, explicit
  guard against an accidental `cdk destroy` or console deletion, independent of the removal policy
  above.
- **Encryption**: storage encrypted with a dedicated customer-managed KMS key
  (`DatabaseStack`'s own key, not shared with S3 — see that stack's own comment for why), key
  rotation enabled.
- **What's not covered**: cross-region copy of these backups. See `disaster-recovery-guide.md`'s
  "closing the regional-backup gap" section — a deliberate scope decision for this initial build,
  not an oversight.

## S3 backup bucket (`StorageStack`)

Two different things live in the same bucket, under different prefixes:

- **`backend-releases/<version>/`** — each backend deploy's JAR + the `deploy-backend.sh` version
  that shipped it. Not really a "backup" in the traditional sense — it's the deploy artifact
  trail, useful for confirming exactly what was running at a given time.
- **Anything else placed there manually** (e.g. `pg_dump` exports, if you set up a scheduled job
  for one) — the bucket is ready for this today, no dedicated dump automation is wired up yet.

Bucket configuration:
- **Versioning**: enabled — an overwritten or deleted object is recoverable.
- **Encryption**: SSE-KMS, `SecurityStack`'s CMK, bucket key enabled (reduces per-request KMS
  cost).
- **Public access**: fully blocked (`BLOCK_ALL`), TLS-only bucket policy (`enforceSsl`).
- **Lifecycle**: objects transition to Glacier after `backupBucketGlacierTransitionDays` (default
  30) and expire after `backupBucketExpirationDays` (default 365); noncurrent (overwritten)
  versions expire after `backupBucketNoncurrentExpirationDays` (default 30) so old release
  artifacts don't accumulate indefinitely.
- **Removal policy**: `RETAIN` — the bucket itself survives a stack deletion.

## ElastiCache Redis

**Deliberately not backed up.** It holds cache entries and rate-limit counters — data that's
either regenerable from PostgreSQL on a cache miss or safe to reset (rate-limit windows). Treating
it as durable would be the wrong instinct for what it's actually for.

## Secrets Manager

AWS-managed durability for whatever's stored, but **the values themselves have no backup outside
this AWS account** unless you make one. See `disaster-recovery-guide.md`'s note on
`VAULT_ENCRYPTION_KEY`/`VAULT_HASH_PEPPER` specifically — those two are the ones where losing the
only copy has irreversible consequences (existing Vault data becomes unreadable), not just
"regenerate and move on."

## What to actually check periodically

- [ ] RDS automated backups are running (`aws rds describe-db-instances --query
      'DBInstances[].BackupRetentionPeriod'` should read 7, not 0).
- [ ] The S3 lifecycle rule is actually transitioning objects (check the bucket's Lifecycle tab
      after 30+ days of real usage).
- [ ] `VAULT_ENCRYPTION_KEY`/`VAULT_HASH_PEPPER` have a durable copy outside AWS Secrets Manager —
      this is a process check, not something CloudWatch can alarm on.
- [ ] CloudWatch alarms (`wealthynest-rds-free-storage-low` etc.) are actually reaching the
      subscribed email — confirm the SNS subscription was confirmed (check the inbox for the
      confirmation email from the first `cdk deploy`, easy to miss).
