import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useRegisterNativePush } from "./useNativePush";
import { notificationsApi } from "../api/notifications.api";
import { isNativePlatform, registerForPush, addPushTapListener } from "../utils/nativePush";
import { toast } from "sonner";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("../api/notifications.api", () => ({
  notificationsApi: { registerDeviceToken: vi.fn() },
}));
vi.mock("../utils/nativePush", () => ({
  isNativePlatform: vi.fn(() => false),
  registerForPush: vi.fn(),
  addPushTapListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const mockedIsNativePlatform = vi.mocked(isNativePlatform);
const mockedRegisterForPush = vi.mocked(registerForPush);
const mockedAddPushTapListener = vi.mocked(addPushTapListener);
const mockedRegisterDeviceToken = vi.mocked(notificationsApi.registerDeviceToken);

beforeEach(() => {
  vi.clearAllMocks();
  mockedAddPushTapListener.mockReturnValue(Promise.resolve({ remove: vi.fn() }));
});

describe("useRegisterNativePush", () => {
  it("does nothing on a non-native platform", async () => {
    mockedIsNativePlatform.mockReturnValue(false);
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useRegisterNativePush(true), { wrapper: Wrapper });

    await new Promise((r) => process.nextTick(r));
    expect(mockedRegisterForPush).not.toHaveBeenCalled();
  });

  it("does nothing while unauthenticated", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useRegisterNativePush(false), { wrapper: Wrapper });

    await new Promise((r) => process.nextTick(r));
    expect(mockedRegisterForPush).not.toHaveBeenCalled();
  });

  it("registers the device token with the backend once a token is obtained", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedRegisterForPush.mockResolvedValue("tok-abc");
    mockedRegisterDeviceToken.mockResolvedValue(undefined);
    const { Wrapper } = createQueryClientWrapper();

    renderHook(() => useRegisterNativePush(true), { wrapper: Wrapper });

    await waitFor(() => expect(mockedRegisterDeviceToken).toHaveBeenCalledWith("tok-abc"));
  });

  it("skips the backend call when permission was denied (null token)", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedRegisterForPush.mockResolvedValue(null);
    const { Wrapper } = createQueryClientWrapper();

    renderHook(() => useRegisterNativePush(true), { wrapper: Wrapper });

    await waitFor(() => expect(mockedRegisterForPush).toHaveBeenCalled());
    await new Promise((r) => process.nextTick(r));
    expect(mockedRegisterDeviceToken).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows an error toast when registration itself fails", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedRegisterForPush.mockRejectedValue(new Error("registration failed"));
    const { Wrapper } = createQueryClientWrapper();

    renderHook(() => useRegisterNativePush(true), { wrapper: Wrapper });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't enable push notifications"));
  });

  it("navigates to /notifications when a push notification is tapped", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedRegisterForPush.mockResolvedValue("tok-abc");
    mockedRegisterDeviceToken.mockResolvedValue(undefined);
    let tapHandler: (() => void) | undefined;
    mockedAddPushTapListener.mockImplementation((handler) => {
      tapHandler = handler as never;
      return Promise.resolve({ remove: vi.fn() });
    });
    const { Wrapper } = createQueryClientWrapper();

    renderHook(() => useRegisterNativePush(true), { wrapper: Wrapper });

    await waitFor(() => expect(mockedAddPushTapListener).toHaveBeenCalled());
    tapHandler?.();
    expect(pushMock).toHaveBeenCalledWith("/notifications");
  });

  it("only registers once across re-renders while authenticated", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedRegisterForPush.mockResolvedValue("tok-abc");
    mockedRegisterDeviceToken.mockResolvedValue(undefined);
    const { Wrapper } = createQueryClientWrapper();

    const { rerender } = renderHook(({ auth }) => useRegisterNativePush(auth), {
      wrapper: Wrapper,
      initialProps: { auth: true },
    });
    await waitFor(() => expect(mockedRegisterForPush).toHaveBeenCalledTimes(1));

    rerender({ auth: true });
    await new Promise((r) => process.nextTick(r));
    expect(mockedRegisterForPush).toHaveBeenCalledTimes(1);
  });
});
