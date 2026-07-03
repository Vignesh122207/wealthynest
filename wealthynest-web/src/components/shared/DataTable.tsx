"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageMeta } from "@/types/api.types";

interface Column<T> {
  key:        string;
  header:     string;
  render:     (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data:        T[];
  columns:     Column<T>[];
  meta?:       PageMeta;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  className?:  string;
  rowKey:      (row: T) => string;
}

export function DataTable<T>({ data, columns, meta, onNextPage, onPrevPage, className, rowKey }: DataTableProps<T>) {
  return (
    <div className={cn("bg-slate-900/60 border border-slate-800/60 rounded-2xl overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800/60">
              {columns.map((col) => (
                <th key={col.key} className={cn("px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider", col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {data.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-800/20 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-5 py-3.5", col.className)}>{col.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800/60">
          <p className="text-xs text-slate-500">Page {meta.page + 1} of {meta.totalPages} · {meta.totalElements} total</p>
          <div className="flex items-center gap-1">
            <button onClick={onPrevPage} disabled={meta.first}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={onNextPage} disabled={meta.last}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
