package com.wealthynest.infra.email;

public interface EmailService {
    void sendPasswordResetEmail(String toEmail, String userName, String resetLink);
    void sendVerificationEmail(String toEmail, String userName, String verifyLink);
    /** Sent instead of a verification email when someone attempts to register an address that
     * already has an account — see AuthServiceImpl#register for why the caller-facing response is
     * identical either way (no email-enumeration signal). */
    void sendAccountExistsEmail(String toEmail, String userName);

    /** Fired only on a genuine new credential-based session (password login, Google login) — not
     * on refresh/pin-login/passkey unlock, which are the same already-recognized device
     * continuing an existing session, not a new sign-in. See AuthServiceImpl#login and
     * #signInWithGooglePayload for the two call sites. */
    void sendNewSignInEmail(String toEmail, String userName, String ipAddress, String userAgent, java.time.Instant when);
}
