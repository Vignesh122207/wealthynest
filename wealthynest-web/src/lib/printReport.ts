import {apiClient} from "@/lib/axios";
import {escapeCsvField} from "@/lib/utils";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getYears() {
  const y = new Date().getFullYear();
  return [y, y - 1, y - 2];
}

export async function downloadCsv(url: string, filename: string) {
  const res  = await apiClient.get(url, { responseType: "blob" });
  const href = URL.createObjectURL(new Blob([res.data]));
  const a    = document.createElement("a");
  a.href = href; a.download = filename; a.click();
  // Defer revoke so browser has time to initiate the download
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

export function triggerLocalCsv(filename: string, header: string[], rows: string[][]) {
  const csv  = [header.join(","), ...rows.map(r => r.map(escapeCsvField).join(","))].join("\n");
  const href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a    = document.createElement("a");
  a.href = href; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}
