"use client";

export function Toggle({ checked, onChange, disabled, testId }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
        checked ? "bg-primary" : "bg-muted-foreground/25"
      }`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform ${
        checked ? "translate-x-5" : "translate-x-0"
      }`} />
    </button>
  );
}
