import {ChevronLeft, ChevronRight} from "lucide-react";

export function PaginationBar({ page, totalPages, totalElements, pageSize, onPage }: {
  page: number; totalPages: number; totalElements: number; pageSize: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const start = page * pageSize + 1;
  const end   = Math.min((page + 1) * pageSize, totalElements);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-xs text-muted-foreground">{start}–{end} of {totalElements}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(0)} disabled={page === 0}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground text-xs font-medium px-2">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 0}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={() => onPage(totalPages - 1)} disabled={page >= totalPages - 1}
          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground text-xs font-medium px-2">»</button>
      </div>
    </div>
  );
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50];
