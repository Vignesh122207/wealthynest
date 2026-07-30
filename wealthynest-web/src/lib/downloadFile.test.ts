import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {Capacitor} from "@capacitor/core";
import {Filesystem} from "@capacitor/filesystem";
import {Share} from "@capacitor/share";
import {toast} from "sonner";
import {downloadBlob} from "./downloadFile";

vi.mock("@capacitor/core", () => ({
  Capacitor: {isNativePlatform: vi.fn()},
}));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {writeFile: vi.fn()},
  Directory: {Cache: "CACHE"},
}));
vi.mock("@capacitor/share", () => ({
  Share: {share: vi.fn()},
}));
vi.mock("sonner", () => ({toast: {error: vi.fn()}}));

const mockedIsNativePlatform = vi.mocked(Capacitor.isNativePlatform);
const mockedWriteFile = vi.mocked(Filesystem.writeFile);
const mockedShare = vi.mocked(Share.share);

describe("downloadBlob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("on web", () => {
    beforeEach(() => {
      mockedIsNativePlatform.mockReturnValue(false);
      global.URL.createObjectURL = vi.fn(() => "blob:mock");
      global.URL.revokeObjectURL = vi.fn();
      vi.spyOn(document.body, "appendChild").mockImplementation((n) => n);
      vi.spyOn(document.body, "removeChild").mockImplementation((n) => n);
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("triggers an anchor-click download instead of going through Filesystem/Share", async () => {
      await downloadBlob(new Blob(["data"]), "report.pdf");

      expect(mockedWriteFile).not.toHaveBeenCalled();
      expect(mockedShare).not.toHaveBeenCalled();
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
  });

  describe("on native (Capacitor WebView)", () => {
    beforeEach(() => {
      mockedIsNativePlatform.mockReturnValue(true);
    });

    it("writes the blob to the Cache directory and hands it to the OS share sheet", async () => {
      mockedWriteFile.mockResolvedValue({uri: "file:///cache/report.pdf"} as never);
      mockedShare.mockResolvedValue(undefined as never);

      await downloadBlob(new Blob(["data"]), "report.pdf");

      expect(mockedWriteFile).toHaveBeenCalledWith(
        expect.objectContaining({path: "report.pdf", directory: "CACHE"})
      );
      expect(mockedShare).toHaveBeenCalledWith(
        expect.objectContaining({url: "file:///cache/report.pdf", title: "report.pdf"})
      );
    });

    it("shows a toast instead of throwing when the native save/share fails", async () => {
      mockedWriteFile.mockRejectedValue(new Error("disk full"));

      await expect(downloadBlob(new Blob(["data"]), "report.pdf")).resolves.toBeUndefined();

      expect(toast.error).toHaveBeenCalledWith("Couldn't save the file on this device.");
    });
  });
});
