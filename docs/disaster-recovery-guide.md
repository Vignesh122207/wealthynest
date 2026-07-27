# Disaster Recovery Guide

Scope: total loss of the `ap-south-1` region, the AWS account, or something equivalently severe —
not single-component failures (see `recovery-guide.md` for those).

## Current posture, stated honestly

This is a **single-region, single-account, cost-optimized** deployment
(`natGatewayEnabled: false`, `rdsMultiAz: false`, one ElastiCache node) — matching the
"family/small-scale" positioning already documented in `PRODUCTION_PLAN.md` and
`GROWTH_STRATEGY.md`. There is no warm standby in a second region. A full region outage means
real downtime while infrastructure is rebuilt elsewhere, not an automatic failover. This is a
deliberate cost/complexity tradeoff, not an oversight — multi-region active/active would roughly
multiply the AWS bill and add meaningfully more operational surface for an app at this scale.

## What survives a region loss

| Data | Survives? | How |
|---|---|---|
| Application code, CDK infrastructure code | Yes | GitHub, not AWS. |
| Database backups | **No, not by default** | RDS automated backups and snapshots are regional. See "closing this gap" below. |
| S3 backup bucket contents | **No, not by default** | Same — regional unless cross-region replication is added. |
| Secrets Manager values | No | Regional; would need to be recreated (the auto-generated ones regenerate fine; the manual ones need re-entry from their original sources — Brevo, Google Cloud Console, Firebase). |

## Recovery Time / Recovery Point Objectives (current, honest numbers)

- **RPO (data loss window):** up to `rdsBackupRetentionDays` (default 7 days) worth of automated
  backups, if the region/account is recoverable at all. If the region itself is gone with no
  cross-region backup copy, RPO is "whenever the last manual export was" — see the gap below.
- **RTO (time to restore service):** hours, not minutes — `cdk bootstrap` + `cdk deploy --all` in a
  new region from scratch, `cdk bootstrap` for the new account/region if needed, DNS cutover
  (Cloudflare, no AWS dependency), then restoring RDS from whatever backup survived, then
  populating the manual secrets again. No pre-built runbook automation exists for this today — the
  steps below are the manual sequence, not a script.

## Full rebuild runbook (region or account loss)

1. **Confirm what's actually lost.** AWS service-wide outages are usually partial or time-bounded
   — check the AWS Health Dashboard before assuming a full rebuild is needed.
2. **New account/region, if the old one is truly gone:**
   ```bash
   export CDK_DEFAULT_ACCOUNT=<new-or-same-account>
   export CDK_DEFAULT_REGION=<new-region>
   cd infrastructure
   cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION
   cdk deploy --all
   ```
   Update `cdk.json`'s `region` (and `account`, if set explicitly) first if the target region
   changed permanently.
3. **Restore the database.** If a cross-region snapshot copy exists (see the gap below), restore
   from it. Otherwise, restore from the most recent same-region backup that survived, or from a
   manual `pg_dump` export if one exists outside AWS entirely.
4. **Re-populate the 5 manual secrets** (`secrets-management-guide.md`) — Google OAuth secret,
   SMTP credentials, Vault encryption key + hash pepper (from wherever they were backed up
   originally — **if they weren't backed up outside AWS, existing Vault data is permanently
   unreadable**; this is the sharpest edge in this whole plan, see below), FCM service account.
5. **Cloudflare DNS:** update `api.wealthynest.in`'s A record to the new Elastic IP. No AWS-side
   DNS dependency (Route53 isn't used) — this step has no AWS prerequisite and can happen in
   parallel with infrastructure rebuild.
6. **Redeploy the backend** (`backend.yml`, or manually via SSM) once the new instance and
   database are up.
7. **Vercel** needs no recovery action — it's a separate provider, unaffected by an AWS region
   loss. If Vercel itself is down, that's a separate, much rarer incident with its own status page.

## The sharpest edge: Vault encryption key durability

`VAULT_ENCRYPTION_KEY` and `VAULT_HASH_PEPPER` exist **only** in this account's Secrets Manager
today. If both the primary region/account AND whatever ad-hoc backup you keep of these two values
are lost simultaneously, every stored Vault item becomes permanently unrecoverable — not
theoretically, actually cryptographically unrecoverable, that's what the encryption is for.
**Action item, not yet done by this infrastructure work:** export these two secret values to a
durable, separate location (a password manager, a printed copy in a safe, a second cloud
provider) the moment they're populated. This is a process gap, not something CDK can close on its
own.

## Closing the regional-backup gap (recommended follow-up, not built here)

Two additions would meaningfully improve the RPO/RTO numbers above, deliberately not included in
this initial build to keep cost/scope matched to current app scale:

1. **Cross-region RDS snapshot copy** — a scheduled `aws rds copy-db-snapshot` (or AWS Backup with
   a cross-region copy rule) to a second region. Turns "region loss = last local backup" into
   "region loss = last cross-region copy," at the cost of cross-region data transfer + a second
   region's storage.
2. **S3 Cross-Region Replication** on the backup bucket, to a bucket in a second region — same
   tradeoff, smaller cost (S3 storage is cheap relative to RDS).

Both are additive CDK changes (a few more constructs) whenever the business decides the current
single-region RPO/RTO is no longer acceptable for the data at stake.
