import { describe, it, expect, vi, beforeEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import {
  isNativePlatform, registerForPush, addPushForegroundListener, addPushTapListener,
  getLastRegisteredPushToken,
} from "./nativePush";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));
vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    requestPermissions: vi.fn(),
    register: vi.fn(),
    addListener: vi.fn(),
  },
}));

const mockedIsNativePlatform = vi.mocked(Capacitor.isNativePlatform);
const mockedRequestPermissions = vi.mocked(PushNotifications.requestPermissions);
const mockedRegister = vi.mocked(PushNotifications.register);
const mockedAddListener = vi.mocked(PushNotifications.addListener);

const flushMicrotasks = () => new Promise((resolve) => process.nextTick(resolve));

let registrationHandler: ((token: { value: string }) => void) | undefined;
let registrationErrorHandler: ((error: { error: string }) => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  registrationHandler = undefined;
  registrationErrorHandler = undefined;
  mockedAddListener.mockImplementation(((event: string, handler: never) => {
    if (event === "registration") registrationHandler = handler as never;
    if (event === "registrationError") registrationErrorHandler = handler as never;
    return Promise.resolve({ remove: vi.fn() });
  }) as never);
});

describe("isNativePlatform", () => {
  it("delegates to Capacitor.isNativePlatform", () => {
    mockedIsNativePlatform.mockReturnValue(true);
    expect(isNativePlatform()).toBe(true);
  });
});

describe("registerForPush", () => {
  it("resolves null without requesting permission on a non-native platform", async () => {
    mockedIsNativePlatform.mockReturnValue(false);
    expect(await registerForPush()).toBeNull();
    expect(mockedRequestPermissions).not.toHaveBeenCalled();
  });

  it("resolves null when permission is denied", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedRequestPermissions.mockResolvedValue({ receive: "denied" });
    expect(await registerForPush()).toBeNull();
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it("resolves the token once the registration listener fires", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedRequestPermissions.mockResolvedValue({ receive: "granted" });
    mockedRegister.mockResolvedValue(undefined);

    const promise = registerForPush();
    await flushMicrotasks();
    registrationHandler?.({ value: "tok-abc" });

    expect(await promise).toBe("tok-abc");
    expect(mockedRegister).toHaveBeenCalled();
    expect(getLastRegisteredPushToken()).toBe("tok-abc");
  });

  it("rejects when the registrationError listener fires", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedRequestPermissions.mockResolvedValue({ receive: "granted" });
    mockedRegister.mockResolvedValue(undefined);

    const promise = registerForPush();
    await flushMicrotasks();
    registrationErrorHandler?.({ error: "boom" });

    await expect(promise).rejects.toThrow("boom");
  });
});

describe("addPushForegroundListener / addPushTapListener", () => {
  it("skip subscribing on a non-native platform", async () => {
    mockedIsNativePlatform.mockReturnValue(false);
    await addPushForegroundListener(vi.fn());
    await addPushTapListener(vi.fn());
    expect(mockedAddListener).not.toHaveBeenCalled();
  });

  it("subscribe to the underlying plugin events on native", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    await addPushForegroundListener(vi.fn());
    await addPushTapListener(vi.fn());
    expect(mockedAddListener).toHaveBeenCalledWith("pushNotificationReceived", expect.any(Function));
    expect(mockedAddListener).toHaveBeenCalledWith("pushNotificationActionPerformed", expect.any(Function));
  });
});
