import fs from "fs";
import {PROJECTS_TO_PROVISION} from "./config/env";
import {
    e2eUserFileFor,
    regressionUserFileFor,
} from "./helpers/auth.helper";
import {sweepE2ETestData} from "./helpers/testDataCleanup.helper";

export default async function globalTeardown(): Promise<void> {
  // The per-fixture-user files just mark which storageState/JSON pair to remove locally — actual
  // row deletion for every @wealthynest.test user (the two provisioned per project here, plus
  // every ad-hoc provisionE2EUser() an individual spec created and — if that spec crashed before
  // its own afterAll/finally ran — never cleaned up) is now a single real hard-delete sweep below.
  // See sweepE2ETestData's own comment for why a hard delete replaced the old closeAccount-based
  // approach: closeAccount only sets is_active=false, it never removes a row.
  for (const project of PROJECTS_TO_PROVISION) {
    fs.rmSync(e2eUserFileFor(project), { force: true });
    fs.rmSync(regressionUserFileFor(project), { force: true });
  }

  try {
    const summary = await sweepE2ETestData();
    console.log(
      `[global-teardown] Hard-deleted ${summary.usersDeleted} test user(s), ` +
      `${summary.dividendActionsDeleted} test dividend row(s), ` +
      `${summary.orphanedFamiliesDeleted} orphaned test famil(y/ies).`
    );
  } catch (err) {
    // Best-effort, same as before: a failed sweep shouldn't fail the run — leftover E2E rows are
    // harmless clutter, not a reason to report the suite red after the actual tests already
    // passed or failed. `npm run cleanup:e2e` (scripts/cleanup-e2e-data.ts) reruns this sweep
    // standalone if a run's teardown ever fails to complete it.
    console.warn("[global-teardown] Test data sweep failed (non-fatal):", (err as Error).message);
  }
}
