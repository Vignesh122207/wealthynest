import {Client} from "pg";
import {env} from "../config/env";

// Every user this suite creates (global-setup's two fixture users, plus every ad-hoc
// provisionE2EUser() call across regression/visual/oauth specs) gets this domain — see
// provisionE2EUser and randomUser in test-data/factory.ts. Real users never sign up with it, so
// it's a safe, sufficient identifier for "this row belongs to a Playwright run."
const TEST_EMAIL_PATTERN = "%@wealthynest.test";

// Dividend suggestions have no per-user owner (see seedDividendCorporateAction's own comment) —
// nse_corporate_actions rows are market-data-shaped, not user data, so they're swept separately by
// the fixed `E2EDIV` symbol prefix dividend.spec.ts always generates.
const TEST_DIVIDEND_SYMBOL_PATTERN = "E2EDIV%";

const TEST_FAMILY_NAME_PATTERN = "E2E %";

export interface CleanupSummary {
  usersDeleted: number;
  dividendActionsDeleted: number;
  orphanedFamiliesDeleted: number;
}

// closeAccount (DELETE /users/me) is a soft delete — UserServiceImpl only flips is_active=false
// and revokes refresh tokens, it never removes a row. Every previous "cleanup" in this suite
// (global-teardown's per-fixture-user close, every spec's own afterAll close) has therefore only
// ever hidden test data, not removed it. This does a real hard delete instead, going straight to
// Postgres rather than through that soft-delete endpoint.
//
// Deletion order below is not arbitrary — it's the actual FK graph read live off this DB
// (information_schema.referential_constraints), not assumed from the migration files. Most
// user_id FKs cascade (budgets, categories, goals, debt_records, wallet_accounts, etc. — those
// come along for free when the `users` row goes). Seven tables reference users(id) with NO ACTION
// (no cascade), and investments.linked_account_id + account_transfers.{from,to}_account_id
// reference wallet_accounts with NO ACTION/RESTRICT — so those must be cleared explicitly, in
// dependency order, before the final `DELETE FROM users` fires its cascade:
//   investment_income_log → investments → assets → account_transfers → expenses → liabilities → vault_items
// (investment_income_log first because its own FK to investments is NO ACTION, not cascade).
export async function sweepE2ETestData(): Promise<CleanupSummary> {
  const client = new Client({
    host: env.db.host,
    port: env.db.port,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
  });
  await client.connect();

  try {
    await client.query("BEGIN");

    const { rows: userRows } = await client.query(
      "SELECT id FROM users WHERE email LIKE $1",
      [TEST_EMAIL_PATTERN]
    );
    const userIds = userRows.map((r) => r.id);

    if (userIds.length > 0) {
      await client.query("DELETE FROM investment_income_log WHERE user_id = ANY($1)", [userIds]);
      await client.query("DELETE FROM investments WHERE user_id = ANY($1)", [userIds]);
      await client.query("DELETE FROM assets WHERE user_id = ANY($1)", [userIds]);
      await client.query("DELETE FROM account_transfers WHERE user_id = ANY($1)", [userIds]);
      await client.query("DELETE FROM expenses WHERE user_id = ANY($1)", [userIds]);
      await client.query("DELETE FROM liabilities WHERE user_id = ANY($1)", [userIds]);
      await client.query("DELETE FROM vault_items WHERE user_id = ANY($1)", [userIds]);
      await client.query("DELETE FROM users WHERE id = ANY($1)", [userIds]);
    }

    const { rowCount: dividendActionsDeleted } = await client.query(
      "DELETE FROM nse_corporate_actions WHERE symbol LIKE $1",
      [TEST_DIVIDEND_SYMBOL_PATTERN]
    );

    // Best-effort within the same transaction: a family only remains after the block above if
    // every member was a test user (real accounts never join an "E2E ..."-named family), so this
    // should always be empty by now — but families.assets/liabilities/expenses FKs are NO ACTION,
    // so if a real row somehow still references one, let that one row fail loud rather than
    // silently swallow it.
    const { rowCount: orphanedFamiliesDeleted } = await client.query(
      "DELETE FROM families WHERE name LIKE $1",
      [TEST_FAMILY_NAME_PATTERN]
    );

    await client.query("COMMIT");

    return {
      usersDeleted: userIds.length,
      dividendActionsDeleted: dividendActionsDeleted ?? 0,
      orphanedFamiliesDeleted: orphanedFamiliesDeleted ?? 0,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}
