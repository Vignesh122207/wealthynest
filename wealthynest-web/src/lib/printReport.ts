import {apiClient} from "@/lib/axios";
import {downloadBlob} from "@/lib/downloadFile";
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
  const res = await apiClient.get(url, { responseType: "blob" });
  await downloadBlob(new Blob([res.data]), filename);
}

export async function triggerLocalCsv(filename: string, header: string[], rows: string[][]) {
  const csv = [header.join(","), ...rows.map(r => r.map(escapeCsvField).join(","))].join("\n");
  await downloadBlob(new Blob([csv], { type: "text/csv" }), filename);
}
