# Security & Architecture Review

Self-review of the infrastructure in this PR, written the way I'd want a second engineer to check
my own work before it touches production. Findings are graded **Pass** (verified, not just
asserted), **Accepted tradeoff** (a deliberate choice with a documented reason), or **Follow-up**
(a real gap, not fixed here, with a clear reason why not and what closing it would take).

## Explicit checklist against the brief's Phase 5 asks

| Requirement | Status | Evidence |
|---|---|---|
| Least privilege IAM | **Pass** | Verified in the synthesized template, not just the code: the EC2 role's inline policy lists exactly 5 SSM parameters, 7 secrets, 2 S3 grants (scoped to specific prefixes/keys), and 1 KMS key — zero `Resource: "*"` for anything grant-able. The 2 GitHub OIDC roles are scoped to exactly `repo:<owner>/wealthynest:ref:refs/heads/main`, one to S3+SSM Run Command on one instance, the other to nothing but `sts:AssumeRole` on the CDK bootstrap roles. |
| HTTPS only | **Pass** | Nginx redirects 80→443; Cloudflare mode is Full (strict), not Flexible, so the edge-to-origin hop is real TLS too, not just client-to-edge. HSTS header set. |
| No public database | **Pass** | RDS and ElastiCache sit in `PRIVATE_ISOLATED` subnets with no route to an internet gateway at all — not just security-group-restricted. Confirmed this matters directly: it's *why* the post-deploy Playwright checks can't use the app's own DB-seeded `test:smoke` suite (see `playwright.yml`'s own comment) — a security-group-only restriction would have been bypassable with a temporary rule; a missing route table entry isn't. |
| No hardcoded secrets | **Pass** | Verified in the synthesized template: `MasterUserPassword` is a `{{resolve:secretsmanager:...}}` dynamic reference, not a literal string. The two CDK-generated secrets (`db-credentials`, `jwt-secret`) never appear as a `SecretString` property in any template — Secrets Manager generates them server-side. The 5 placeholder secrets deliberately hold a literal `REPLACE_ME_POST_DEPLOY` marker, not a real value — that's the documented, correct state until an operator populates them. |
| No security vulnerabilities | **Pass, with the two items below tracked explicitly** | See "Known gaps" — nothing found beyond the two documented, deliberate tradeoffs. |

## Findings by severity

### Fixed during this build (not shipped as latent bugs)

These were caught by the CDK synth/test loop before ever reaching a template, not found later —
listed here because they're the kind of thing a second reviewer should specifically re-check, not
because they're still open:

1. **Two real circular stack dependencies.** RDS's `DatabaseInstance` unconditionally calls
   `secret.attach(this)` on its credentials secret, and CDK's L2 "add an ingress rule to this
   security group" methods create the resulting resource in *whichever stack owns that security
   group*, not the caller's stack. Both are non-obvious CDK behaviors that silently make a
   "the other stack depends on you" edge look like "you depend on the other stack" in application
   code. Fixed via `Credentials.fromUsername(...)` (avoids the secret attachment entirely) and
   building `CfnSecurityGroupIngress` as top-level resources scoped to the correct stack. See
   `DatabaseStack`'s and `ComputeStack`'s own comments — I left the reasoning in place rather than
   just fixing it silently, since the same pitfall is easy to reintroduce on a future change.
2. **Missing IAM grant for the CloudWatch Agent's own config fetch.** `AmazonSSMManagedInstanceCore`
   covers Session Manager and Run Command, not reading an arbitrary custom SSM parameter — the
   agent's `fetch-config` call would have failed `AccessDenied` on every instance launch until an
   explicit `grantRead` was added. Caught by re-reading the bootstrap script against the actual
   granted permissions, not by a test (nothing in the CDK synth output would have flagged this on
   its own — worth being honest about a real detection gap, not just the fix).
3. **A `nginx -t && reload || restart` shellcheck finding that was a real bug**, not just style:
   if the config test itself failed, the `||` fallback would have restarted Nginx with a
   *known-bad* config, taking a working Nginx down instead of leaving it alone. Fixed to gate any
   reload/restart behind a passing test.

### Accepted tradeoffs (deliberate, documented, not oversights)

1. **ElastiCache transit encryption is disabled.** ElastiCache requires
   `TransitEncryptionEnabled=true` before it will accept an AUTH token, which means the client
   must speak TLS — and `wealthynest-api` has no Redis TLS configuration today. Enabling it here
   without a corresponding backend change would have silently broken every Redis connection in
   production. Compensating control: network isolation (private-isolated subnet + a security
   group that only trusts the app server's own SG). Tracked as a real follow-up in
   `deployment-guide.md`, not swept under a comment.
2. **No cross-region backup replication.** Single-region by design, matching the app's documented
   "family/small-scale" positioning — RDS backups and the S3 backup bucket are both regional.
   `disaster-recovery-guide.md` states the resulting RPO/RTO numbers honestly rather than
   implying a DR posture this build doesn't actually have, and names the two additive changes
   (cross-region snapshot copy, S3 CRR) that would close it.
3. **NAT Gateway disabled by default.** Correct for this topology (the app server is in a public
   subnet; RDS/ElastiCache need no outbound internet at all), not a blanket "NAT costs money"
   shortcut — the config flag exists and flips a real subnet group on if a future architecture
   change needs it.
4. **Frontend and backend deploy workflows can double-deploy if Vercel's own Git integration is
   also connected.** Called out directly in `frontend.yml`'s own header comment and
   `deployment-guide.md` — an easy one-time misconfiguration to avoid, not a design flaw.

### Follow-ups worth planning, not blocking

1. **No automated secret rotation.** `db-credentials`/`jwt-secret` could be rotated on a schedule
   via Secrets Manager's native rotation (a Lambda CDK could provision) — not done here since it
   adds real complexity (a rotation Lambda, VPC networking for it to reach RDS) for a first
   production cut. Manual rotation works today (`secrets-management-guide.md`).
2. **No WAF rules beyond Cloudflare's own.** Cloudflare proxied mode gives baseline DDoS/bot
   protection for free; AWS WAF on top (rate-based rules, managed rule groups) is a reasonable
   next step once real traffic patterns exist to tune it against — premature to guess at rules now.
3. **Single AZ for RDS and ElastiCache** (`rdsMultiAz: false`, 1 Redis node) — config-driven, one
   value flip away from Multi-AZ when the cost is justified by real usage. Correct default for
   the current scale per `PRODUCTION_PLAN.md`'s own positioning, not a durability gap being hidden.
4. **The 45 GitHub Actions minutes budget** for `backend.yml`'s full run (build + test + deploy +
   smoke) hasn't been measured against GitHub's free-tier minutes at real usage frequency — worth
   a look once deploys are happening several times a day rather than during initial setup.

## What I'd genuinely reconsider at 10x this app's current scale

Not recommendations for now — matching effort to actual scale is itself the right call today —
but worth having written down for whoever revisits this:

- Multi-AZ RDS becomes worth its cost once an outage actually costs more than the AZ premium.
- An Application Load Balancer in front of the EC2 instance (or a second instance behind it) once
  a single `t4g.small` is measurably the bottleneck, not preemptively.
- Cross-region DR once the data at stake justifies doubling infrastructure cost.
- Automated Secrets Manager rotation once manual rotation becomes an actual operational burden
  rather than a rare event.

None of these are "this build is unfinished" — they're "this build correctly matches current
scale, and here's the next lever when scale changes," which is the honest way to leave a
production-readiness review, not a checklist padded to look more thorough than the app needs.
