import {z} from "zod";

// Native number inputs yield "" (not undefined) when left blank, which z.coerce.number()
// turns into 0 — silently failing .positive()/.min() checks on fields that are genuinely
// optional (e.g. leaving "EMI Amount" blank). Treat "" as "not provided" before coercing.
export const blankToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

export const createAccountSchema = z.object({
  accountType:    z.enum(["CASH_WALLET", "BANK_ACCOUNT", "EMERGENCY_FUND", "CREDIT_CARD", "LOAN", "INVESTMENT"]),
  name:           z.string().min(1, "Name is required").max(100),
  // API responses carry `null` for these when unset (not `undefined`), and z.string().optional()
  // only accepts undefined — without the same blankToUndef preprocessing the numeric optional
  // fields already get, editing any account whose accountNumber/loanEndDate is null fails
  // validation silently (no field is rendered to show the error against in edit mode).
  bankName:       z.preprocess(blankToUndef, z.string().max(100).optional()),
  accountNumber:  z.preprocess(blankToUndef, z.string().max(20).optional()),
  openingBalance: z.coerce.number().min(0, "Balance must be 0 or more"),
  lowBalanceThreshold: z.preprocess(blankToUndef, z.coerce.number().min(0).optional()),
  creditLimit:    z.preprocess(blankToUndef, z.coerce.number().positive().optional()),
  statementDay:   z.preprocess(blankToUndef, z.coerce.number().min(1).max(28).optional()),
  paymentDueDay:  z.preprocess(blankToUndef, z.coerce.number().min(1).max(28).optional()),
  apr:            z.preprocess(blankToUndef, z.coerce.number().min(0).max(100).optional()),
  // Loan fields (openingBalance = current outstanding, bankName = lender, apr = interest rate)
  loanType:        z.preprocess(blankToUndef, z.enum(["HOME_LOAN","CAR_LOAN","PERSONAL_LOAN","EDUCATION_LOAN","GOLD_LOAN","BUSINESS_LOAN","OTHER"]).optional()),
  principalAmount: z.preprocess(blankToUndef, z.coerce.number().positive().optional()),
  emiAmount:       z.preprocess(blankToUndef, z.coerce.number().positive().optional()),
  emiDay:          z.preprocess(blankToUndef, z.coerce.number().min(1).max(28).optional()),
  autopayAccountId: z.preprocess(blankToUndef, z.string().optional()),
  loanEndDate:     z.preprocess(blankToUndef, z.string().optional()),
}).superRefine((data, ctx) => {
  // loanType stays optional in the shape above (every other account type leaves it undefined),
  // but is required specifically when creating/editing a Loan — the auto-generated name and the
  // Net Worth liability breakdown both depend on it being set.
  if (data.accountType === "LOAN" && !data.loanType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["loanType"], message: "Loan type is required" });
  }
});

export const LOAN_TYPE_OPTIONS = [
  { value: "HOME_LOAN",      label: "Home Loan" },
  { value: "CAR_LOAN",       label: "Car Loan" },
  { value: "PERSONAL_LOAN",  label: "Personal Loan" },
  { value: "EDUCATION_LOAN", label: "Education Loan" },
  { value: "GOLD_LOAN",      label: "Gold Loan" },
  { value: "BUSINESS_LOAN",  label: "Business Loan" },
  { value: "OTHER",          label: "Other" },
];

export const LOAN_TYPE_LABELS: Record<string, string> =
  Object.fromEntries(LOAN_TYPE_OPTIONS.map(o => [o.value, o.label]));

export type CreateAccountForm = z.infer<typeof createAccountSchema>;
