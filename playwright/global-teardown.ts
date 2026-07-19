import fs from "fs";
import axios from "axios";
import {env, PROJECTS_TO_PROVISION} from "./config/env";
import {api} from "./helpers/api.helper";
import {
    type E2EUserFixtureData,
    e2eUserFileFor,
    readE2EUser,
    readRegressionUser,
    regressionUserFileFor,
} from "./helpers/auth.helper";

// Best-effort: re-authenticates as each user global-setup provisioned (their original tokens may
// have expired over the course of the run) and closes the account, which cascades away every
// account/expense/income/transfer/budget/goal/investment/category/debt the suite created. A
// failure here shouldn't fail the run — leftover E2E test rows in a local/CI DB are harmless
// clutter, not a reason to report the suite red after the actual tests already passed or failed.
async function cleanUp(filePath: string, read: () => E2EUserFixtureData): Promise<void> {
  if (!fs.existsSync(filePath)) return;
  try {
    const user = read();
    const auth = await api.login({ email: user.email, password: user.password });
    await axios.delete(`${env.apiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
  } catch (err) {
    console.warn(`[global-teardown] Could not clean up test user at ${filePath} (non-fatal):`, (err as Error).message);
  } finally {
    fs.rmSync(filePath, { force: true });
  }
}

export default async function globalTeardown(): Promise<void> {
  for (const project of PROJECTS_TO_PROVISION) {
    await cleanUp(e2eUserFileFor(project), () => readE2EUser(project));
    await cleanUp(regressionUserFileFor(project), () => readRegressionUser(project));
  }
}
