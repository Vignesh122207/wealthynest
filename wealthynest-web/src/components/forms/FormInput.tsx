import {forwardRef, type InputHTMLAttributes, useId} from "react";
import {cn} from "@/lib/utils";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?:  string;
  /** Overlaid inside the field's right edge (e.g. a show/hide-password toggle) — bumps the
   * input's right padding automatically so text never renders underneath it. */
  endAdornment?: React.ReactNode;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, hint, className, type, inputMode, id, endAdornment, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const messageId = `${inputId}-message`;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-muted-foreground">{label}</label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={type}
            inputMode={inputMode}
            aria-invalid={!!error || undefined}
            aria-describedby={error || hint ? messageId : undefined}
            className={cn(
              "w-full h-10 px-3 rounded-xl text-sm transition-all outline-none",
              "bg-background border border-border text-foreground placeholder:text-muted-foreground",
              "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
              endAdornment && "pr-10",
              className
            )}
            {...props}
          />
          {endAdornment && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">{endAdornment}</div>
          )}
        </div>
        {error && <p id={messageId} className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        {hint && !error && <p id={messageId} className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }
);
FormInput.displayName = "FormInput";
