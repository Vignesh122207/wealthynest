import { forwardRef, type InputHTMLAttributes, type FocusEvent } from "react";
import { cn } from "@/lib/utils";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?:  string;
}

const isNumericInput = (type?: string, inputMode?: string) =>
  type === "number" || inputMode === "decimal" || inputMode === "numeric";

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, hint, className, onFocus, type, inputMode, ...props }, ref) => {
    const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
      if (isNumericInput(type, inputMode)) e.target.select();
      onFocus?.(e);
    };

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-medium text-muted-foreground">{label}</label>
        )}
        <input
          ref={ref}
          type={type}
          inputMode={inputMode}
          onFocus={handleFocus}
          className={cn(
            "w-full h-10 px-3 rounded-xl text-sm transition-all outline-none",
            "bg-background border border-border text-foreground placeholder:text-muted-foreground",
            "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }
);
FormInput.displayName = "FormInput";
