"use client";
import { useState } from "react";

export function usePagination(initialSize = 20) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(initialSize);
  return {
    page, size,
    setPage,
    setSize: (s: number) => { setSize(s); setPage(0); },
    reset:   () => setPage(0),
    next:    () => setPage((p) => p + 1),
    prev:    () => setPage((p) => Math.max(0, p - 1)),
  };
}
