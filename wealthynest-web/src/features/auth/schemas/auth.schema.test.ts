import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth.schema";

describe("loginSchema", () => {
  it("accepts a valid email/password pair", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "anything" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "anything" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.email).toContain("Enter a valid email");
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.password).toContain("Password is required");
  });

  it("treats rememberMe as optional", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "x" });
    expect(result.success).toBe(true);
  });
});

describe("registerSchema", () => {
  const valid = {
    fullName: "Vignesh Arunachalam",
    email: "user@example.com",
    password: "Passw0rd1",
    confirmPassword: "Passw0rd1",
  };

  it("accepts a fully valid registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = registerSchema.safeParse({ ...valid, fullName: "V" });
    expect(result.success).toBe(false);
  });

  it("rejects a password missing an uppercase letter", () => {
    const result = registerSchema.safeParse({ ...valid, password: "passw0rd1", confirmPassword: "passw0rd1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain("Must contain an uppercase letter");
    }
  });

  it("rejects a password missing a lowercase letter", () => {
    const result = registerSchema.safeParse({ ...valid, password: "PASSW0RD1", confirmPassword: "PASSW0RD1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain("Must contain a lowercase letter");
    }
  });

  it("rejects a password missing a digit", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Passwordddd", confirmPassword: "Passwordddd" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain("Must contain a number");
    }
  });

  it("rejects a password shorter than 8 characters even if it satisfies every character class", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Aa1", confirmPassword: "Aa1" });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched password/confirmPassword, attaching the error to confirmPassword", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "Different1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain("Passwords do not match");
    }
  });

  it("rejects an empty confirmPassword with its own message, not a silent pass via an equally-empty password", () => {
    const result = registerSchema.safeParse({ fullName: "", email: "", password: "", confirmPassword: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain("Please confirm your password");
    }
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a strong matching password pair", () => {
    const result = resetPasswordSchema.safeParse({ newPassword: "Passw0rd1", confirmPassword: "Passw0rd1" });
    expect(result.success).toBe(true);
  });

  it("rejects a mismatched confirmation", () => {
    const result = resetPasswordSchema.safeParse({ newPassword: "Passw0rd1", confirmPassword: "Passw0rd2" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain("Passwords do not match");
    }
  });

  it("rejects an empty confirmPassword with its own message, not a silent pass via an equally-empty newPassword", () => {
    const result = resetPasswordSchema.safeParse({ newPassword: "", confirmPassword: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain("Please confirm your password");
    }
  });
});
