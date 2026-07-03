package com.wealthynest.infra.email;

public interface EmailService {
    void sendPasswordResetEmail(String toEmail, String userName, String resetLink);
    void sendVerificationEmail(String toEmail, String userName, String verifyLink);
}
