import {forwardRef, type SelectHTMLAttributes, useId} from "react";
import {cn} from "@/lib/utils";
import type {SelectOption} from "@/types/common.types";

export interface SelectOptionGroup {
  label:   string;
  options: SelectOption[];
}

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?:       string;
  error?:       string;
  /** Flat list — mutually exclusive with `groups`. */
  options?:     SelectOption[];
  /** Renders as <optgroup> sections, in the order given — use instead of `options` to group choices. */
  groups?:      SelectOptionGroup[];
  placeholder?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, options, groups, placeholder, className, id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;
    return (
      <div className="space-y-1.5">
        {label && <label htmlFor={selectId} className="block text-sm font-medium text-muted-foreground">{label}</label>}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "w-full h-10 px-3 rounded-xl text-sm transition-all outline-none appearance-none",
            "bg-background border border-border text-foreground",
            "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {groups
            ? groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              ))
            : options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
        </select>
        {error && <p id={errorId} className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);
FormSelect.displayName = "FormSelect";
