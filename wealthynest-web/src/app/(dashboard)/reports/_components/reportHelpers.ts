import { apiClient } from "@/lib/axios";
import { toast } from "sonner";
import { escapeCsvField } from "@/lib/utils";

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

// Branded letterhead + print stylesheet shared by every report — matches the in-app indigo→violet
// identity (see .hero-gradient in globals.css) instead of a generic black-on-white print view,
// since a downloaded/printed report is the one artifact a user hands to someone outside the app.
export async function openPrintWindow(title: string, htmlBody: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { toast.error("Allow pop-ups to save as PDF."); return; }
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--brand-1:#4f46e5;--brand-2:#7c3aed}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#18181b;padding:0 40px 40px}
    .letterhead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:28px 0 18px;border-bottom:2px solid var(--brand-1);margin-bottom:26px}
    .brand{display:flex;align-items:center;gap:10px}
    .brand-mark{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--brand-1),var(--brand-2));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:15px;flex-shrink:0}
    .brand-name{font-size:16px;font-weight:800;letter-spacing:-.01em;color:#111}
    .brand-tag{font-size:10px;color:#8a8a95;letter-spacing:.05em;text-transform:uppercase;margin-top:1px}
    .letterhead-meta{text-align:right;font-size:11px;color:#8a8a95;line-height:1.5}
    h1{font-size:19px;font-weight:700;margin-bottom:3px;color:#111}
    .sub{color:#8a8a95;font-size:12px;margin-bottom:26px}
    table{width:100%;border-collapse:collapse;margin-bottom:26px}
    th{background:#eef2ff;color:var(--brand-1);text-align:left;padding:9px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid #e0e0fa}
    td{padding:8px 10px;border-bottom:1px solid #f1f1f4;font-size:12.5px}
    tr:last-child td{border-bottom:none}
    .section-title{font-size:12px;font-weight:700;margin:24px 0 10px;color:var(--brand-1);text-transform:uppercase;letter-spacing:.06em;padding-left:9px;border-left:3px solid var(--brand-1)}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:10px}
    .card{background:#fafaff;border:1px solid #e6e6f5;border-top:3px solid var(--brand-1);border-radius:10px;padding:14px 16px}
    .card-label{font-size:10.5px;color:#8a8a95;margin-bottom:5px;text-transform:uppercase;letter-spacing:.03em}
    .card-value{font-size:17px;font-weight:800}
    .positive{color:#0f7a3d} .negative{color:#b3261e}
    tfoot td{padding:10px;font-size:13px}
    .print-footer{margin-top:30px;padding-top:14px;border-top:1px solid #eee;font-size:10.5px;color:#aaa;display:flex;justify-content:space-between}
    .save-btn{margin-top:28px;padding:11px 26px;background:linear-gradient(135deg,var(--brand-1),var(--brand-2));color:#fff;border:none;border-radius:10px;font-size:13px;cursor:pointer;font-weight:700}
    @media print{body{padding:0 20px 20px}.letterhead{padding-top:0}.save-btn{display:none}}
  </style>
</head>
<body>
  <div class="letterhead">
    <div class="brand">
      <div class="brand-mark">W</div>
      <div>
        <div class="brand-name">WealthyNest</div>
        <div class="brand-tag">Personal Finance</div>
      </div>
    </div>
    <div class="letterhead-meta">Generated ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</div>
  </div>
  ${htmlBody}
  <div class="print-footer">
    <span>WealthyNest · Free forever · No ads</span>
    <span>Built for Indian families</span>
  </div>
  <button class="save-btn" onclick="window.print()">Save as PDF</button>
</body>
</html>`);
  win.document.close();
}
