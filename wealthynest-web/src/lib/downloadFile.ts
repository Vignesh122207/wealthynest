import {Capacitor} from "@capacitor/core";
import {Directory, Filesystem} from "@capacitor/filesystem";
import {Share} from "@capacitor/share";
import {toast} from "sonner";

/** Android's WebView (this app's Capacitor shell) never routes a blob: URL opened via a synthetic
 *  `<a download>` click through its DownloadListener — that only fires for real network responses
 *  with Content-Disposition, not in-renderer blob: navigations — so every export button using that
 *  pattern would silently do nothing inside the packaged app. Native platforms go through
 *  Filesystem+Share instead: Directory.Cache needs no storage permission, and handing the file to
 *  the OS share sheet (Save to Files, email, etc.) is the standard Capacitor substitute for a
 *  direct Downloads-folder write, which isn't available without extra permissions Play would flag
 *  for a finance app. Never throws — a native save/share failure is reported via toast instead, so
 *  callers can treat this the same as the web path (fire-and-forget). */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {href: url, download: filename});
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }

  try {
    const data = await blobToBase64(blob);
    const {uri} = await Filesystem.writeFile({path: filename, data, directory: Directory.Cache});
    await Share.share({url: uri, title: filename});
  } catch {
    toast.error("Couldn't save the file on this device.");
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
