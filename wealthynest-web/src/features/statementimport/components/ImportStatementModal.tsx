"use client";

import { useState } from "react";
import { Upload, FileText, Check, X, AlertTriangle, ArrowRight, Tags } from "lucide-react";
import { toast } from "sonner";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import { FormModalHeader } from "@/components/transactions/FormModalHeader";
import { AccountPicker } from "@/components/transactions/AccountPicker";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { usePreviewStatement, useConfirmImport } from "../hooks/useStatementImport";
import type { ColumnMapping, ConfirmRow, ParsedRow, StatementPreview } from "../types/statementimport.types";

type Step = "upload" | "mapping" | "password" | "review" | "result";

interface EditableRow extends ParsedRow {
  included: boolean;
  categoryId: string;
  /** Marked for the next bulk "apply category to selected" action — independent of `included`,
   * since which rows to import and which rows to categorize together are different decisions. */
  selected: boolean;
}

export function ImportStatementModal({ onClose, bankAccounts, cashAccounts, initialAccountId }: {
  onClose: () => void;
  bankAccounts: { id: string; name: string; bankName?: string; currentBalance: number; primary?: boolean }[];
  cashAccounts: { id: string; name: string; currentBalance: number }[];
  /** Preselects the account when opened from that account's own card (e.g. AccountCard's "Import statement" action) — still changeable, just saves the reselect. */
  initialAccountId?: string;
}) {
  const { fmtExact } = useAmountFormatter();
  const { data: categories = [] } = useCategories("EXPENSE");
  const { mutate: preview, isPending: previewing } = usePreviewStatement();
  const { mutate: confirmImport, isPending: confirming } = useConfirmImport();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState(initialAccountId ?? "");
  const [previewData, setPreviewData] = useState<StatementPreview | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);

  const runPreview = (f: File, m?: ColumnMapping, pw?: string) => {
    preview({ file: f, mapping: m, password: pw }, {
      onSuccess: (data) => {
        setPreviewData(data);
        if (data.needsPassword) {
          if (pw) toast.error("Incorrect password. Please try again.");
          setStep("password");
        } else if (data.needsMapping) {
          setStep("mapping");
        } else {
          setRows(data.rows.map(r => ({ ...r, included: r.valid, categoryId: r.suggestedCategoryId ?? "", selected: false })));
          setStep("review");
        }
      },
      onError: () => toast.error("Could not read that file. Please check it's a valid CSV or PDF export."),
    });
  };

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setPassword("");
    if (f) runPreview(f);
  };

  const handleMappingSubmit = () => { if (file) runPreview(file, mapping); };
  const handlePasswordSubmit = () => { if (file) runPreview(file, undefined, password); };

  const toggleRow = (idx: number) => setRows(rs => rs.map((r, i) => i === idx ? { ...r, included: !r.included } : r));
  const setRowCategory = (idx: number, categoryId: string) => setRows(rs => rs.map((r, i) => i === idx ? { ...r, categoryId } : r));
  const toggleSelected = (idx: number) => setRows(rs => rs.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  const selectAllIncluded = () => setRows(rs => rs.map(r => ({ ...r, included: r.valid })));
  const deselectAllIncluded = () => setRows(rs => rs.map(r => ({ ...r, included: false })));
  const clearBulkSelection = () => setRows(rs => rs.map(r => ({ ...r, selected: false })));
  const applyCategoryToSelected = (categoryId: string) =>
    setRows(rs => rs.map(r => r.selected ? { ...r, categoryId, selected: false } : r));

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }));
  const includedCount = rows.filter(r => r.included).length;
  const selectedForBulkCount = rows.filter(r => r.selected).length;
  const uncategorizedIncludedCount = rows.filter(r => r.included && r.type === "DEBIT" && !r.categoryId).length;
  const canConfirm = !!accountId && includedCount > 0;

  const handleConfirm = () => {
    const confirmRows: ConfirmRow[] = rows.filter(r => r.included).map(r => ({
      date: r.date!, description: r.description ?? undefined, amount: r.amount!,
      type: r.type!, categoryId: r.type === "DEBIT" ? (r.categoryId || undefined) : undefined,
    }));
    confirmImport({ accountId, rows: confirmRows }, {
      onSuccess: (res) => { setResult(res); setStep("result"); },
      onError: () => toast.error("Import failed. Please try again."),
    });
  };

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-3xl">
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
        <div className="h-1.5 bg-gradient-to-r from-cyan-500 to-blue-600" />
        <div className="p-5">
          <FormModalHeader icon={Upload} tone="cyan" title="Import Bank Statement" onClose={onClose} />

          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground -mt-3">
                Upload a CSV or PDF statement from your bank or UPI app. You&apos;ll review every row before anything is saved.
              </p>
              <AccountPicker label="Import into account" bankAccounts={bankAccounts} cashAccounts={cashAccounts}
                value={accountId} onChange={setAccountId} />
              <label className="flex flex-col items-center justify-center gap-2 h-32 rounded-xl border-2 border-dashed border-border hover:border-cyan-500/50 cursor-pointer transition-colors">
                <FileText className="w-6 h-6 text-muted-foreground/60" />
                <span className="text-sm text-muted-foreground">{file ? file.name : "Click to choose a CSV or PDF file"}</span>
                <input type="file" accept=".csv,text/csv,.pdf,application/pdf" className="hidden"
                  onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />
              </label>
              {previewing && <p className="text-xs text-muted-foreground text-center">Reading file…</p>}
            </div>
          )}

          {step === "password" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground -mt-3">
                This PDF is password-protected. Enter the password (often your date of birth or PAN) to continue.
              </p>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="PDF password" autoFocus
                className="w-full h-9 px-3 rounded-lg bg-muted/60 border border-border text-sm text-foreground" />
              <div className="flex gap-2">
                <Button variant="gradient" onClick={handlePasswordSubmit} loading={previewing} disabled={!password}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/25">
                  <ArrowRight className="w-4 h-4" /> Unlock
                </Button>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
              </div>
            </div>
          )}

          {step === "mapping" && previewData && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground -mt-3">
                Couldn&apos;t auto-detect your bank&apos;s column layout — match them below.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ColumnSelect label="Date column" headers={previewData.headers}
                  value={mapping.dateColumn} onChange={v => setMapping(m => ({ ...m, dateColumn: v }))} />
                <ColumnSelect label="Description column" headers={previewData.headers}
                  value={mapping.descriptionColumn} onChange={v => setMapping(m => ({ ...m, descriptionColumn: v }))} />
                <ColumnSelect label="Debit / withdrawal column" headers={previewData.headers}
                  value={mapping.debitColumn} onChange={v => setMapping(m => ({ ...m, debitColumn: v }))} />
                <ColumnSelect label="Credit / deposit column" headers={previewData.headers}
                  value={mapping.creditColumn} onChange={v => setMapping(m => ({ ...m, creditColumn: v }))} />
                <ColumnSelect label="— or a single amount column" headers={previewData.headers}
                  value={mapping.amountColumn} onChange={v => setMapping(m => ({ ...m, amountColumn: v }))} />
              </div>
              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="bg-muted/60">{previewData.headers.map(h => <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody>
                    {previewData.sampleRows.map((row, i) => (
                      <tr key={i} className="border-t border-border/50">
                        {row.map((c, j) => <td key={j} className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button variant="gradient" onClick={handleMappingSubmit} loading={previewing}
                  disabled={mapping.dateColumn == null || mapping.descriptionColumn == null || (mapping.amountColumn == null && (mapping.debitColumn == null || mapping.creditColumn == null))}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/25">
                  <ArrowRight className="w-4 h-4" /> Continue
                </Button>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 -mt-3">
                <p className="text-xs text-muted-foreground">
                  {includedCount} of {rows.length} row{rows.length !== 1 ? "s" : ""} selected.{" "}
                  Uncategorized expenses import as <span className="font-medium text-foreground">Other</span>.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={selectAllIncluded}
                    className="text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors">
                    Select all
                  </button>
                  <span className="text-border">·</span>
                  <button type="button" onClick={deselectAllIncluded}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    Deselect all
                  </button>
                </div>
              </div>

              {selectedForBulkCount === 0 && uncategorizedIncludedCount > 0 && (
                <p className="text-[11px] text-muted-foreground/70 -mt-1">
                  Tip: click an uncategorized row (e.g. a few from the same merchant) to select it, then apply one category to all selected at once.
                </p>
              )}

              {selectedForBulkCount > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 animate-scale-in">
                  <Tags className="w-3.5 h-3.5 text-indigo-500 shrink-0 ml-1" />
                  <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 shrink-0 whitespace-nowrap">
                    {selectedForBulkCount} selected
                  </span>
                  <div className="flex-1 min-w-0">
                    <CategoryPicker compact categories={categoryOptions} value=""
                      placeholder="Apply category to selected…" onChange={applyCategoryToSelected} />
                  </div>
                  <button type="button" onClick={clearBulkSelection}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="border border-border rounded-xl max-h-96 overflow-y-auto divide-y divide-border/50">
                {rows.map((r, i) => {
                  const bulkSelectable = r.type === "DEBIT" && r.valid && !r.categoryId;
                  return (
                  <div key={r.rowIndex}
                    className={cn("flex items-center gap-2 px-3 py-2 transition-colors",
                      !r.valid && "opacity-60",
                      r.selected && "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/30")}>
                    <input type="checkbox" checked={r.included} disabled={!r.valid} title="Include in import"
                      onChange={() => toggleRow(i)} className="shrink-0 accent-indigo-500" />
                    <div className={cn("flex-1 min-w-0", bulkSelectable && "cursor-pointer")}
                      onClick={bulkSelectable ? () => toggleSelected(i) : undefined}
                      title={bulkSelectable ? "Select for bulk categorize" : undefined}>
                      <p className="text-xs text-foreground truncate">{r.description || "—"}</p>
                      <p className="text-[11px] text-muted-foreground/70">
                        {r.date ?? "?"} {r.error && <span className="text-red-500">· {r.error}</span>}
                      </p>
                    </div>
                    {r.type === "DEBIT" && r.valid && (
                      <div className="w-36 shrink-0">
                        <CategoryPicker compact categories={categoryOptions} value={r.categoryId}
                          placeholder="Uncategorized" onChange={id => setRowCategory(i, id)} />
                      </div>
                    )}
                    <span className={cn("text-xs font-semibold tabular-nums shrink-0 w-20 text-right",
                      r.type === "CREDIT" ? "text-emerald-500" : "text-red-500")}>
                      {r.amount != null ? `${r.type === "CREDIT" ? "+" : "−"}${fmtExact(r.amount)}` : "—"}
                    </span>
                  </div>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <Button variant="gradient" onClick={handleConfirm} loading={confirming} disabled={!canConfirm}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/25">
                    <Check className="w-4 h-4" /> Import {includedCount} transaction{includedCount !== 1 ? "s" : ""}
                  </Button>
                  <Button variant="secondary" onClick={onClose}>Cancel</Button>
                </div>
                {uncategorizedIncludedCount > 0 && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    {uncategorizedIncludedCount} row{uncategorizedIncludedCount !== 1 ? "s" : ""} will import as &quot;Other&quot;
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-sm text-foreground">{result.created} transaction{result.created !== 1 ? "s" : ""} imported.</p>
              </div>
              {result.failed > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> {result.failed} row{result.failed !== 1 ? "s" : ""} failed
                  </p>
                  {result.errors.map((e, i) => <p key={i} className="text-[11px] text-muted-foreground pl-5">{e}</p>)}
                </div>
              )}
              <Button variant="gradient" onClick={onClose}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/25">
                <X className="w-4 h-4" /> Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </TransactionModalOverlay>
  );
}

function ColumnSelect({ label, headers, value, onChange }: {
  label: string; headers: string[]; value?: number; onChange: (v: number | undefined) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <select value={value ?? ""} onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="w-full h-9 px-2 rounded-lg bg-muted/60 border border-border text-xs text-foreground">
        <option value="">—</option>
        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
      </select>
    </div>
  );
}
