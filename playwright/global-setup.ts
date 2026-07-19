import type {FullConfig} from "@playwright/test";
import {env, PROJECTS_TO_PROVISION, regressionStorageStatePathFor, storageStatePathFor} from "./config/env";
import {api} from "./helpers/api.helper";
import {e2eUserFileFor, regressionUserFileFor, setUpFixtureUser} from "./helpers/auth.helper";

async function waitForApiHealthy(retries = 10, delayMs = 3000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    if (await api.health()) return;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(
    `wealthynest-api at ${env.apiUrl} never reported healthy. Is 'docker compose up -d' running?`
  );
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await waitForApiHealthy();

  // Two separate users per project: one for tests/auth/ + tests/smoke/ (real UI logins, so it
  // needs to stay untouched by anything else), one for tests/regression/ (pre-authenticated via
  // storageState, creates/mutates real account/debt/budget data) — kept apart so those suites
  // never race on the same rows. "Per project" matters because some of what regressionUser/e2eUser
  // create is a backend singleton (Cash Wallet, Emergency Fund) — two projects sharing one user
  // means only the first project to reach that step can ever create it (see README's "chromium
  // only, on purpose"). PROJECTS_TO_PROVISION defaults to just "chromium" (today's behavior,
  // unchanged) — set E2E_PROJECTS to provision more before running against another project.
  // Provisioned here, once per project rather than per-worker: registering a fresh user per worker
  // was pushing auth-endpoint calls past the API's 10 req/min rate limit.
  for (const project of PROJECTS_TO_PROVISION) {
    await setUpFixtureUser(storageStatePathFor(project), e2eUserFileFor(project));
    await setUpFixtureUser(regressionStorageStatePathFor(project), regressionUserFileFor(project));
  }
}
