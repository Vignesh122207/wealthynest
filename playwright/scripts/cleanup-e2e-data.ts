import {sweepE2ETestData} from "../helpers/testDataCleanup.helper";

async function main(): Promise<void> {
  console.log("[cleanup-e2e-data] Sweeping @wealthynest.test users and their data...");
  const summary = await sweepE2ETestData();
  console.log(
    `[cleanup-e2e-data] Deleted ${summary.usersDeleted} test user(s), ` +
    `${summary.dividendActionsDeleted} test dividend row(s), ` +
    `${summary.orphanedFamiliesDeleted} orphaned test famil(y/ies).`
  );
}

main().catch((err) => {
  console.error("[cleanup-e2e-data] Failed:", err);
  process.exit(1);
});
