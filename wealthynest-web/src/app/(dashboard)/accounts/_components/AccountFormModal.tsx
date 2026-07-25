"use client";

import {Archive, ChevronDown, X} from "lucide-react";
import {Controller, type UseFormReturn} from "react-hook-form";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {AccountPicker} from "@/components/transactions/AccountPicker";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {FormSelect} from "@/components/forms/FormSelect";
import {BankNameInput} from "@/features/accounts/components/BankNameInput";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import {type CreateAccountForm, LOAN_TYPE_LABELS, LOAN_TYPE_OPTIONS} from "@/features/accounts/schemas/account.schema";
import {INDIAN_BANKS, STOCK_BROKERS} from "@/lib/constants";
import {cn, formatCurrency} from "@/lib/utils";
import {useSidebarOffsetClass} from "@/hooks/useSidebarOffsetClass";
import type {AccountType, WalletAccount} from "@/features/accounts/types/account.types";

type ModalType = "none" | "create" | "addMoney" | "addExpense" | "transfer" | "edit" | "import";

interface AccountFormModalProps {
  modal: Extract<ModalType, "create" | "edit">;
  editAccount: WalletAccount | null;
  createForm: UseFormReturn<CreateAccountForm>;
  accounts: WalletAccount[];
  bankInput: string;
  setBankInput: (v: string) => void;
  showCCDetails: boolean;
  setShowCCDetails: (updater: (v: boolean) => boolean) => void;
  actualBalance: string;
  setActualBalance: (v: string) => void;
  currSymbol: string;
  creating: boolean;
  updating: boolean;
  adjusting: boolean;
  onClose: () => void;
  onArchive: () => void;
  onSubmit: (v: CreateAccountForm) => void;
}

// Its own bespoke chrome (unlike Income/Expense/Transfer, which use the shared form components
// used elsewhere in the app) — pulled out of the Accounts page purely to cut its size. All the
// per-type derived state (isCCForm, isLoanForm, etc.) is recomputed here from `createForm` and
// `editAccount` rather than threaded in as separate props, since both are already passed down.
export function AccountFormModal({
  modal, editAccount, createForm, accounts, bankInput, setBankInput, showCCDetails, setShowCCDetails,
  actualBalance, setActualBalance, currSymbol, creating, updating, adjusting, onClose, onArchive, onSubmit,
}: AccountFormModalProps) {
  const watchedType = createForm.watch("accountType");
  const activeType  = modal === "create" ? watchedType : (editAccount?.accountType ?? watchedType);
  const isCCForm     = activeType === "CREDIT_CARD";
  const isBankForm   = activeType === "BANK_ACCOUNT";
  const isLoanForm   = activeType === "LOAN";
  const isInvForm    = activeType === "INVESTMENT";
  const isSimpleType = activeType === "CASH_WALLET" || activeType === "EMERGENCY_FUND";

  // Balance-reconciliation preview for the Edit form's "Actual balance" field.
  const editBalanceTarget     = parseFloat(actualBalance);
  const editBalanceCurrent    = editAccount?.currentBalance ?? 0;
  const editBalanceDiff       = editBalanceTarget - editBalanceCurrent;
  const editBalanceIsPositive = editBalanceDiff > 0;
  // For a liability, a higher outstanding is bad (an unlogged charge) and a lower one is good
  // (an unlogged payment) — the inverse of what "positive diff" means for an asset.
  const editBalanceGoodDirection = isCCForm || isLoanForm ? !editBalanceIsPositive : editBalanceIsPositive;
  const editBalanceAdjustLabel = isCCForm || isLoanForm
    ? (editBalanceIsPositive ? "Expense adjustment" : "Payment adjustment")
    : (editBalanceIsPositive ? "Income adjustment" : "Expense adjustment");

  const creditLimitField = createForm.register("creditLimit");
  const sidebarOffset = useSidebarOffsetClass();

  return (
    <div data-testid="modal-overlay-backdrop" className={cn("fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4", sidebarOffset)} onClick={onClose}>
      {/* Same rounded-3xl / gradient-bar / p-5 chrome as ExpenseForm and the other shared
          transaction forms, so creating/editing an account matches the rest of the app. */}
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="h-1.5" style={{ background: `linear-gradient(to right, ${ACCOUNT_TYPE_META[activeType].hex}, ${ACCOUNT_TYPE_META[activeType].hex}99)` }} />
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <PremiumIcon icon={ACCOUNT_TYPE_META[activeType].icon} hex={ACCOUNT_TYPE_META[activeType].hex} size="md" className="w-10 h-10" />
            <h3 className="font-semibold text-foreground text-base flex-1 truncate">
              {modal === "edit"
                ? (isCCForm ? "Edit Card" : "Edit Account")
                : "New Account"}
            </h3>
            {modal === "edit" && editAccount && (
              <div className="relative group shrink-0">
                <button type="button" onClick={onArchive}
                  aria-label="Archive"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-amber-500 hover:bg-amber-500/10 transition-all">
                  <Archive className="w-4 h-4" />
                </button>
                <span className="pointer-events-none absolute top-full right-0 mt-1.5 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 translate-y-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 z-10">
                  Archive
                </span>
              </div>
            )}
            <button type="button" onClick={onClose} aria-label="Close"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={createForm.handleSubmit(onSubmit)} className="space-y-4">
            {modal === "create" && (
              <div className="grid grid-cols-3 gap-2">
                {(["CASH_WALLET", "BANK_ACCOUNT", "EMERGENCY_FUND", "CREDIT_CARD", "LOAN", "INVESTMENT"] as AccountType[]).map(t => {
                  const m = ACCOUNT_TYPE_META[t];
                  const Icon = m.icon;
                  const singleton    = t === "CASH_WALLET" || t === "EMERGENCY_FUND";
                  const alreadyExists = singleton && accounts.some(a => a.accountType === t);
                  const selected = watchedType === t && !alreadyExists;
                  return (
                    <button key={t} type="button" data-testid={`account-type-${t}`} disabled={alreadyExists}
                      onClick={() => {
                        // Full reset (not setValue) — clears every type-specific field
                        // (apr, creditLimit, loanType, etc.) left over from whichever type
                        // was selected before, so it can't silently ride along on submit.
                        createForm.reset({
                          accountType: t,
                          name: t === "CASH_WALLET" ? "Cash Wallet" : t === "EMERGENCY_FUND" ? "Emergency Fund"
                            : t === "INVESTMENT" ? "Investment Account" : t === "CREDIT_CARD" ? "Credit Card" : t === "LOAN" ? "Loan" : "",
                          openingBalance: createForm.getValues("openingBalance"),
                        });
                        setBankInput("");
                      }}
                      style={selected ? { backgroundColor: m.hex + "14", borderColor: m.hex } : undefined}
                      className={cn("flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-[11px] font-semibold transition-all",
                        alreadyExists ? "opacity-40 cursor-not-allowed bg-muted border-border text-muted-foreground"
                          : selected ? "shadow-sm" : "border-border bg-muted/40 text-muted-foreground hover:border-border/80 hover:bg-muted/70")}>
                      {alreadyExists
                        ? <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"><Icon className="w-4 h-4" strokeWidth={1.75} /></div>
                        : <PremiumIcon icon={Icon} hex={m.hex} size="xs" className="w-8 h-8" />}
                      <span style={selected ? { color: m.hex } : undefined}>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {(isCCForm || isBankForm || isLoanForm || isInvForm) && (
              <BankNameInput
                label={isCCForm ? "Card Issuer (Bank)" : isLoanForm ? "Lender (Bank / NBFC)" : isInvForm ? "Broker / Platform" : "Bank Name"}
                suggestions={isInvForm ? STOCK_BROKERS : INDIAN_BANKS}
                value={bankInput}
                onChange={v => { setBankInput(v);
                  if (isBankForm) createForm.setValue("name", v || "Bank Account");
                  if (isInvForm)  createForm.setValue("name", v || "Investment Account");
                  if (isCCForm)   createForm.setValue("name", v ? `${v} Card` : "");
                  if (isLoanForm) {
                    const label = LOAN_TYPE_LABELS[createForm.getValues("loanType") ?? ""];
                    createForm.setValue("name", label ? `${v} ${label}`.trim() : (v || "Loan"));
                  } }} />
            )}

            {isLoanForm && (
              <FormSelect label="Loan Type" options={LOAN_TYPE_OPTIONS} placeholder="Select loan type"
                error={createForm.formState.errors.loanType?.message}
                value={createForm.watch("loanType") ?? ""}
                onChange={e => {
                  const v = e.target.value as CreateAccountForm["loanType"];
                  createForm.setValue("loanType", v);
                  const label = LOAN_TYPE_LABELS[v ?? ""];
                  createForm.setValue("name", label ? `${bankInput} ${label}`.trim() : (bankInput || "Loan"));
                }} />
            )}

            {/* Name — only Cash Wallet / Emergency Fund keep a free-text name, and only on
                edit. Every other type is auto-named from its bank/broker (+ loan type),
                matching what the card actually displays, so there's nothing to duplicate. */}
            {isSimpleType && modal === "edit" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Account Name</label>
                <input {...createForm.register("name")}
                  placeholder="e.g. HDFC Savings"
                  className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                {createForm.formState.errors.name && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.name.message}</p>}
              </div>
            )}

            {isCCForm && (
              /* Card number + limit on same row for credit cards */
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                    Last 4 digits <span className="text-muted-foreground/60">(optional)</span>
                  </label>
                  <input {...createForm.register("accountNumber")} placeholder="e.g. 4567" maxLength={4}
                    className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Credit Limit</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50">{currSymbol}</span>
                    <input type="text" inputMode="decimal" placeholder="e.g. 100000" {...creditLimitField}
                      onChange={e => { e.target.value = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); creditLimitField.onChange(e); }}
                      className="w-full h-10 pl-6 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                  </div>
                </div>
              </div>
            )}

            {isBankForm && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                  Account Number <span className="text-muted-foreground/60">(last 4 digits, optional)</span>
                </label>
                <input {...createForm.register("accountNumber")} placeholder="e.g. 4567"
                  className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
              </div>
            )}

            {/* Balance: opening balance on create; reconcile-against-actual on edit — editing
                the balance and the account's other details happen in one Save, instead of a
                separate "Adjust Balance" flow. */}
            {modal === "create" ? (
              <BigAmountInput
                label={isCCForm || isLoanForm ? "Current Outstanding Balance" : "Opening Balance"}
                colorClass="text-foreground"
                inputProps={createForm.register("openingBalance")}
                error={createForm.formState.errors.openingBalance?.message}
                testId="account-opening-balance-input" />
            ) : (
              <div className="space-y-2">
                <BigAmountInput
                  label={isCCForm || isLoanForm ? "Actual Outstanding" : "Actual Balance"}
                  colorClass="text-foreground"
                  inputProps={{
                    value: actualBalance,
                    onChange: e => setActualBalance(e.target.value),
                  }}
                  testId="account-actual-balance-input" />
                <p className="text-[11px] text-muted-foreground/70 text-center">
                  Prefilled from the app — change it to match your {isCCForm || isLoanForm ? "statement" : "bank"} if they&apos;ve drifted apart.
                </p>
                {actualBalance !== "" && !isNaN(editBalanceTarget) && editBalanceDiff !== 0 && (
                  <div className={cn("rounded-xl px-3 py-2 text-sm flex items-center justify-between",
                    editBalanceGoodDirection ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500 dark:text-red-400")}>
                    <span>{editBalanceAdjustLabel}</span>
                    <span className="font-semibold tabular-nums">{editBalanceIsPositive ? "+" : "−"}{formatCurrency(Math.abs(editBalanceDiff))}</span>
                  </div>
                )}
              </div>
            )}

            {!isCCForm && !isLoanForm && (
              <FormCurrencyInput label="Low Balance Alert (optional)"
                placeholder="e.g. 1000 — get notified below this"
                {...createForm.register("lowBalanceThreshold")}
                error={createForm.formState.errors.lowBalanceThreshold?.message} />
            )}

            {isCCForm && (
              <>
                <button type="button" onClick={() => setShowCCDetails(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 hover:underline transition-colors w-fit">
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showCCDetails && "rotate-180")} />
                  {showCCDetails ? "Hide billing cycle" : "Set billing cycle (statement & due dates)"}
                </button>
                {showCCDetails && (
                  <div className="space-y-3 pl-3 border-l-2 border-indigo-500/20">
                    <p className="text-[11px] text-muted-foreground/80">
                      Used to calculate your next statement date and payment due date.
                    </p>
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-0.5 font-medium">Statement Day</label>
                        <p className="text-xs text-muted-foreground/60 mb-1.5">Day of month (1–28)</p>
                        <input type="number" min={1} max={28} placeholder="e.g. 15"
                          {...createForm.register("statementDay")}
                          className={cn("w-full h-10 px-3 rounded-xl text-sm bg-background border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all",
                            createForm.formState.errors.statementDay ? "border-red-500/60" : "border-border")} />
                        {createForm.formState.errors.statementDay && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.statementDay.message}</p>}
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-0.5 font-medium">Due Day</label>
                        <p className="text-xs text-muted-foreground/60 mb-1.5">Day of month (1–28)</p>
                        <input type="number" min={1} max={28} placeholder="e.g. 5"
                          {...createForm.register("paymentDueDay")}
                          className={cn("w-full h-10 px-3 rounded-xl text-sm bg-background border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all",
                            createForm.formState.errors.paymentDueDay ? "border-red-500/60" : "border-border")} />
                        {createForm.formState.errors.paymentDueDay && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.paymentDueDay.message}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {isLoanForm && (
              <div className="space-y-3 pl-3 border-l-2 border-rose-500/20">
                <div className="grid grid-cols-2 gap-3">
                  <FormCurrencyInput label="Original Loan Amount" placeholder="Defaults to outstanding"
                    {...createForm.register("principalAmount")}
                    error={createForm.formState.errors.principalAmount?.message} />
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                      Interest Rate (% p.a.) <span className="text-muted-foreground/60">(optional)</span>
                    </label>
                    <input type="number" step="0.01" min={0} max={100} placeholder="e.g. 8.5"
                      {...createForm.register("apr")}
                      className={cn("w-full h-10 px-3 rounded-xl text-sm bg-background border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all",
                        createForm.formState.errors.apr ? "border-red-500/60" : "border-border")} />
                    {createForm.formState.errors.apr && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.apr.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormCurrencyInput label="EMI Amount" placeholder="e.g. 25000"
                    {...createForm.register("emiAmount")}
                    error={createForm.formState.errors.emiAmount?.message} />
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5 font-medium">EMI Day (1–28) <span className="text-muted-foreground/60">(optional)</span></label>
                    <input type="number" min={1} max={28} placeholder="e.g. 5"
                      {...createForm.register("emiDay")}
                      className={cn("w-full h-10 px-3 rounded-xl text-sm bg-background border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all",
                        createForm.formState.errors.emiDay ? "border-red-500/60" : "border-border")} />
                    {createForm.formState.errors.emiDay && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.emiDay.message}</p>}
                  </div>
                </div>
                <Controller control={createForm.control} name="autopayAccountId" render={({ field }) => (
                  <AccountPicker label="Auto-pay EMI from (optional)" placeholder="Manual payments only" allowClear
                    cashAccounts={accounts.filter(a => a.accountType === "CASH_WALLET" && !a.archived)}
                    bankAccounts={accounts.filter(a => a.accountType === "BANK_ACCOUNT" && !a.archived)}
                    emergencyFundAccounts={accounts.filter(a => a.accountType === "EMERGENCY_FUND" && !a.archived)}
                    creditAccounts={[]}
                    value={field.value ?? ""} onChange={field.onChange} />
                )} />
                <p className="text-[11px] text-muted-foreground/80">
                  With auto-pay, the EMI is debited monthly on the EMI day — interest is logged as an
                  expense and the principal reduces your outstanding automatically.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="submit" data-testid="account-form-submit" disabled={creating || updating || adjusting}
                className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
                {creating || updating || adjusting ? "Saving…" : modal === "edit" ? "Save Changes" : "Create Account"}
              </button>
              <button type="button" onClick={onClose}
                className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
