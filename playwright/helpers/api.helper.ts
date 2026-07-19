import axios, {type AxiosInstance} from "axios";
import {env} from "../config/env";

// Thin direct-to-API client for test setup/teardown (provisioning the E2E user, seeding a
// category the Expense/Budget forms need to have any option to pick) — deliberately bypasses the
// UI for things that aren't what a given test is actually verifying. Mirrors the shapes in
// wealthynest-web/src/features/*/api/*.api.ts and features/auth/types/auth.types.ts.

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: "ADMIN" | "FAMILY_ADMIN" | "MEMBER";
    familyId?: string;
    active: boolean;
    pinEnabled: boolean;
  };
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
}

function client(): AxiosInstance {
  return axios.create({ baseURL: env.apiUrl, headers: { "Content-Type": "application/json" } });
}

export const api = {
  async health(): Promise<boolean> {
    try {
      const res = await axios.get(`${env.apiUrl.replace(/\/api\/v1$/, "")}/actuator/health`, { timeout: 5000 });
      return res.data?.status === "UP";
    } catch {
      return false;
    }
  },

  async register(input: { fullName: string; email: string; password: string }): Promise<AuthResponse> {
    const { data } = await client().post("/auth/register", input);
    return data.data;
  },

  async login(input: { email: string; password: string; rememberMe?: boolean }): Promise<AuthResponse> {
    const { data } = await client().post("/auth/login", input);
    return data.data;
  },

  async createCategory(
    accessToken: string,
    input: { name: string; icon?: string; color?: string; type: "EXPENSE" | "INCOME" | "TRANSFER" }
  ): Promise<Category> {
    const { data } = await client().post("/categories", input, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  async getCategories(accessToken: string): Promise<Category[]> {
    const { data } = await client().get("/categories", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Direct account creation for test setup that isn't itself exercising the Accounts UI (e.g.
   * seeding one shared account a whole spec file's tests transact against) — skips the ~7 GET
   * requests a real `/accounts` page load fires, which matters given the API's 200 req/min general
   * rate limit once a regression file has more than a couple of tests. */
  async createAccount(accessToken: string, input: Record<string, unknown>): Promise<{ id: string; name: string }> {
    const { data } = await client().post("/accounts", input, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Joins a family directly by invite code — for specs (e.g. expense-split) that need a second
   * family member to exist but aren't themselves testing the join flow (see family.spec.ts for
   * that). Skips a whole extra UI login per member, which matters given the auth endpoint's
   * tight 10 req/min rate limit — a spec provisioning more than one extra member hits it fast if
   * each one also logs in through the UI just to click Join. */
  async joinFamily(accessToken: string, inviteCode: string): Promise<{ id: string; name: string }> {
    const { data } = await client().post("/families/join", { inviteCode }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Seeds an expense directly — used by specs (e.g. analytics) that need real spending history
   * to exist but aren't themselves testing the Add Expense flow. */
  async createExpense(accessToken: string, input: Record<string, unknown>): Promise<{ id: string }> {
    const { data } = await client().post("/expenses", input, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Seeds an income entry directly — same rationale as createExpense. */
  async createIncome(accessToken: string, input: Record<string, unknown>): Promise<{ id: string }> {
    const { data } = await client().post("/income", input, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Seeds a goal directly — used by specs (e.g. recurring-rules) that need an existing goal to
   * attach to but aren't themselves testing Goal creation. */
  async createGoal(accessToken: string, input: Record<string, unknown>): Promise<{ id: string; name: string }> {
    const { data } = await client().post("/goals", input, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** Closes (deactivates) a test-provisioned user's account directly — for one-off users a spec
   * provisions itself (outside global-setup/global-teardown's own cleanup), e.g. family.spec.ts's
   * second member. */
  async closeAccount(accessToken: string): Promise<void> {
    await client().delete("/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
  },

  /** Used to assert exact per-participant shareAmount values after a split (custom-amount UI
   * assertions would otherwise depend on parsing locale-formatted currency text) — see
   * expense-split.spec.ts. */
  async getMySplits(accessToken: string): Promise<{
    balances: { counterpartUserId: string; counterpartName: string; netAmount: number }[];
    pending: { id: string; participantUserId: string; shareAmount: number; status: "PENDING" | "SETTLED" }[];
  }> {
    const { data } = await client().get("/expense-splits/my-splits", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.data;
  },

  /** POST /expense-splits/{id}/settle (settle a single split) has no UI surface anywhere in the
   * app — SplitsCard.tsx only ever calls settle-with/{counterpartId} (settle every split with one
   * person at once). Called directly here so this endpoint has at least some coverage; see
   * expense-split.spec.ts's own comment on the finding. */
  async settleSplit(accessToken: string, id: string): Promise<void> {
    await client().post(`/expense-splits/${id}/settle`, {}, { headers: { Authorization: `Bearer ${accessToken}` } });
  },
};
