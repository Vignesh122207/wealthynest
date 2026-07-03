import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SelectOption { value: string; label: string; }

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?:       string;
  error?:       string;
  options:      SelectOption[];
  placeholder?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
      <select
        ref={ref}
        className={cn(
          "w-full h-10 px-3 rounded-xl text-sm transition-all outline-none appearance-none",
          "bg-slate-800 border border-slate-700/60 text-slate-100",
          "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
          className
        )}
        {...props}
      >
        {placeholder && <option value="" style={{ backgroundColor: "#1e293b", color: "#f1f5f9" }}>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ backgroundColor: "#1e293b", color: "#f1f5f9" }}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
);
FormSelect.displayName = "FormSelect";
