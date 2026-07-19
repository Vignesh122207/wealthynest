"use client";

import {useState} from "react";
import {AlertTriangle, ArrowRight, Check, FileText, Plus, Trash2, Upload, X} from "lucide-react";
import {toast} from "sonner";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {Button} from "@/components/ui/Button";
import {cn} from "@/lib/utils";
import {useConfirmCasImport, usePreviewCas} from "../hooks/useCasImport";
import type {CasConfirmRow, CasParsedHolding, CasPreview} from "../types/casimport.types";

type Step = "upload" | "password" | "review" | "result";

interface EditableHolding {
  rowIndex:        number;
  included:        boolean;
  schemeName:      string;
  folioNumber:     string;
  units:           string;
  nav:             string;
  currentValue:    string;
  investedAmount:  string;
  costWasDetected: boolean;
  valid:           boolean;
  error?:          string;
}

function toEditable(h: CasParsedHolding): EditableHolding {
  return {
    rowIndex: h.rowIndex,
    included: h.valid,
    schemeName: h.schemeName,
    folioNumber: h.folioNumber ?? "",
    units: h.units != null ? String(h.units) : "",
    nav: h.nav != null ? String(h.nav) : "",
    currentValue: h.currentValue != null ? String(h.currentValue) : "",
    investedAmount: h.investedAmount != null ? String(h.investedAmount) : "",
    costWasDetected: h.investedAmount != null,
    valid: h.valid,
    error: h.error,
  };
}

let manualRowSeq = -1;
function blankRow(): EditableHolding {
  return {
    rowIndex: manualRowSeq--, included: true, schemeName: "", folioNumber: "",
    units: "", nav: "", currentValue: "", investedAmount: "",
    costWasDetected: false, valid: true,
  };
}

// Uploads a CAMS/KFintech CAS PDF, extracts fund holdings, and lets the user review/edit every
// row before anything is saved — same "never silently commit an uncertain parse" shape as
// ImportStatementModal, since CAS layouts vary enough across RTAs/years that some rows will
// need a manual fix (or a manually-added row for a scheme the parser missed entirely).
export function ImportCasModal({ onClose }: { onClose: () => void }) {
  const { mutate: preview, isPending: previewing } = usePreviewCas();
  const { mutate: confirmImport, isPending: confirming } = useConfirmCasImport();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<EditableHolding[]>([]);
  const [result, setResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);

  const runPreview = (f: File, pw?: string) => {
    preview({ file: f, password: pw }, {
      onSuccess: (data: CasPreview) => {
        if (data.needsPassword) {
          if (pw) toast.error("Incorrect password. Please try again.");
          setStep("password");
        } else {
          setRows(data.holdings.map(toEditable));
          setStep("review");
        }
      },
      onError: () => toast.error("Could not read that PDF. Make sure it's a CAMS/KFintech Consolidated Account Statement."),
    });
  };

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setPassword("");
    if (f) runPreview(f);
  };
  const handlePasswordSubmit = () => { if (file) runPreview(file, password); };

  const updateRow = (idx: number, patch: Partial<EditableHolding>) =>
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const removeRow = (idx: number) => setRows(rs => rs.filter((_, i) => i !== idx));
  const addManualRow = () => setRows(rs => [...rs, blankRow()]);

  const rowIsComplete = (r: EditableHolding) =>
    r.schemeName.trim().length > 0 && Number(r.units) > 0 && Number(r.nav) > 0 && Number(r.currentValue) > 0;

  const includedRows = rows.filter(r => r.included);
  const readyCount = includedRows.filter(rowIsComplete).length;
  const canConfirm = includedRows.length > 0 && readyCount === includedRows.length;

  const handleConfirm = () => {
    const confirmRows: CasConfirmRow[] = includedRows.map(r => ({
      schemeName: r.schemeName.trim(),
      folioNumber: r.folioNumber.trim() || undefined,
      units: Number(r.units),
      nav: Number(r.nav),
      currentValue: Number(r.currentValue),
      investedAmount: r.investedAmount ? Number(r.investedAmount) : undefined,
    }));
    confirmImport(confirmRows, {
      onSuccess: (res) => { setResult(res); setStep("result"); },
      onError: () => toast.error("Import failed. Please try again."),
    });
  };

  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-3xl">
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
        <div className="h-1.5 bg-gradient-to-r from-rose-500 to-pink-600" />
        <div className="p-5">
          <FormModalHeader icon={Upload} tone="red" title="Import from CAS" onClose={onClose} />

          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground -mt-3">
                Upload the free Consolidated Account Statement PDF from CAMS, KFintech, or MFCentral —
                it covers every mutual fund you hold, across all AMCs. You&apos;ll review every holding
                before anything is saved, and CAS layouts vary enough that a row or two may need a
                quick manual fix.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 h-32 rounded-xl border-2 border-dashed border-border hover:border-rose-500/50 cursor-pointer transition-colors">
                <FileText className="w-6 h-6 text-muted-foreground/60" />
                <span className="text-sm text-muted-foreground">{file ? file.name : "Click to choose your CAS PDF"}</span>
                <input type="file" accept=".pdf,application/pdf" className="hidden"
                  data-testid="import-cas-file-input"
                  onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />
              </label>
              {previewing && <p className="text-xs text-muted-foreground text-center">Reading PDF…</p>}
            </div>
          )}

          {step === "password" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground -mt-3">
                This CAS PDF is password-protected — usually your PAN and date of birth combined
                (check the email it arrived in for the exact format). Enter it to continue.
              </p>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="CAS PDF password" autoFocus data-testid="import-cas-password-input"
                className="w-full h-9 px-3 rounded-lg bg-muted/60 border border-border text-sm text-foreground" />
              <div className="flex gap-2">
                <Button variant="gradient" onClick={handlePasswordSubmit} loading={previewing} disabled={!password}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 shadow-rose-500/25">
                  <ArrowRight className="w-4 h-4" /> Unlock
                </Button>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 -mt-3">
                <p className="text-xs text-muted-foreground">
                  {includedRows.length} of {rows.length} holding{rows.length !== 1 ? "s" : ""} selected
                  {readyCount < includedRows.length && (
                    <span className="text-amber-500"> · {includedRows.length - readyCount} need{includedRows.length - readyCount === 1 ? "s" : ""} a fix before import</span>
                  )}
                </p>
                <button type="button" onClick={addManualRow} data-testid="import-cas-add-row"
                  className="flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Add missed scheme
                </button>
              </div>

              <div className="border border-border rounded-xl max-h-[26rem] overflow-y-auto divide-y divide-border/50">
                {rows.map((r, i) => (
                  <div key={r.rowIndex} className={cn("p-3 space-y-2", !r.included && "opacity-50")}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={r.included} onChange={() => updateRow(i, { included: !r.included })}
                        title="Include in import" data-testid={`import-cas-checkbox-${r.rowIndex}`}
                        className="mt-1.5 shrink-0 accent-rose-500" />
                      <input value={r.schemeName} onChange={e => updateRow(i, { schemeName: e.target.value })}
                        placeholder="Scheme name" data-testid={`import-cas-scheme-${r.rowIndex}`}
                        className="flex-1 min-w-0 h-8 px-2 rounded-lg bg-muted/60 border border-border text-xs text-foreground" />
                      <button type="button" onClick={() => removeRow(i)} title="Remove row" data-testid={`import-cas-remove-${r.rowIndex}`}
                        className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pl-6">
                      <LabeledInput label="Units" value={r.units} testId={`import-cas-units-${r.rowIndex}`} onChange={v => {
                        const nav = Number(r.nav);
                        updateRow(i, { units: v, currentValue: nav > 0 && Number(v) > 0 ? String(Number(v) * nav) : r.currentValue });
                      }} />
                      <LabeledInput label="NAV" value={r.nav} testId={`import-cas-nav-${r.rowIndex}`} onChange={v => {
                        const units = Number(r.units);
                        updateRow(i, { nav: v, currentValue: units > 0 && Number(v) > 0 ? String(units * Number(v)) : r.currentValue });
                      }} />
                      <LabeledInput label="Current value" value={r.currentValue} testId={`import-cas-value-${r.rowIndex}`}
                        onChange={v => updateRow(i, { currentValue: v })} />
                      <LabeledInput label="Invested (optional)" value={r.investedAmount} testId={`import-cas-invested-${r.rowIndex}`}
                        onChange={v => updateRow(i, { investedAmount: v })} />
                    </div>
                    <div className="pl-6 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                      <input value={r.folioNumber} onChange={e => updateRow(i, { folioNumber: e.target.value })}
                        placeholder="Folio no. (optional)"
                        className="h-6 px-1.5 rounded bg-transparent border border-border/60 text-[11px] w-32" />
                      {!r.costWasDetected && r.investedAmount === "" && (
                        <span className="text-amber-500">Cost not found in the PDF — defaults to current value (0 gain) unless you fill it in</span>
                      )}
                      {r.error && <span className="text-red-500">{r.error}</span>}
                      {!rowIsComplete(r) && r.included && !r.error && (
                        <span className="text-amber-500">Scheme name, units, NAV, and current value are all required</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="gradient" onClick={handleConfirm} loading={confirming} disabled={!canConfirm}
                  data-testid="import-cas-confirm"
                  className="flex-1 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 shadow-rose-500/25">
                  <Check className="w-4 h-4" /> Import {includedRows.length} holding{includedRows.length !== 1 ? "s" : ""}
                </Button>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
              </div>
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-sm text-foreground">{result.created} holding{result.created !== 1 ? "s" : ""} imported.</p>
              </div>
              {result.failed > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> {result.failed} holding{result.failed !== 1 ? "s" : ""} failed
                  </p>
                  {result.errors.map((e, i) => <p key={i} className="text-[11px] text-muted-foreground pl-5">{e}</p>)}
                </div>
              )}
              <Button variant="gradient" onClick={onClose} data-testid="import-cas-close-result"
                className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 shadow-rose-500/25">
                <X className="w-4 h-4" /> Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </TransactionModalOverlay>
  );
}

function LabeledInput({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-muted-foreground/70 mb-0.5">{label}</span>
      <input type="number" step="any" value={value} onChange={e => onChange(e.target.value)} data-testid={testId}
        className="w-full h-7 px-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground" />
    </label>
  );
}
