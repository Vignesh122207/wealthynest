import { X } from "lucide-react";

export function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 shrink-0">
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label} filter`} className="ml-0.5 text-indigo-500/60 hover:text-indigo-500 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
