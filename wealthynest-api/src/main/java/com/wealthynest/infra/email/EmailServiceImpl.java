package com.wealthynest.infra.email;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    // The brand ribbon-W mark (RibbonWMark, tone="mono", in BrandMark.tsx), rasterized to PNG and
    // sent as a CID inline attachment rather than a remote <img src> or raw <svg> — Outlook desktop
    // doesn't render SVG at all, and a remote-hosted image depends on frontendUrl being publicly
    // reachable, which it isn't in local/dev. See scripts that regenerate this asset if the glyph
    // in BrandMark.tsx ever changes: wealthynest-web/public/icons/favicon.svg has the same geometry.
    private static final String LOGO_CID = "logo-mark";
    private static final ClassPathResource LOGO_RESOURCE = new ClassPathResource("email/logo-mark.png");

    // Matches the web app's `new Date().getFullYear()` footer/copyright convention (see
    // AuthBrandPanel consumers, PublicNav, the landing page) instead of a literal year that goes
    // stale every January — pinned to IST since that's the app's stated audience/timezone.
    private static int currentYear() {
        return java.time.Year.now(java.time.ZoneId.of("Asia/Kolkata")).getValue();
    }

    private final JavaMailSender mailSender;

    @Value("${wealthynest.mail.from}")
    private String fromAddress;

    @Value("${wealthynest.mail.frontend-url}")
    private String frontendUrl;

    @Override
    @Async
    public void sendPasswordResetEmail(String toEmail, String userName, String resetLink) {
        sendEmail(toEmail, "Reset your WealthyNest password",
                buildResetHtml(userName, resetLink));
    }

    @Override
    @Async
    public void sendVerificationEmail(String toEmail, String userName, String verifyLink) {
        sendEmail(toEmail, "Verify your WealthyNest email",
                buildVerificationHtml(userName, verifyLink));
    }

    @Override
    @Async
    public void sendAccountExistsEmail(String toEmail, String userName) {
        sendEmail(toEmail, "You already have a WealthyNest account",
                buildAccountExistsHtml(userName, frontendUrl + "/login", frontendUrl + "/forgot-password"));
    }

    @Override
    @Async
    public void sendNewSignInEmail(String toEmail, String userName, String ipAddress, String userAgent, java.time.Instant when) {
        String formattedWhen = java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a 'IST'")
                .withZone(java.time.ZoneId.of("Asia/Kolkata")).format(when);
        sendEmail(toEmail, "New sign-in to your WealthyNest account",
                buildNewSignInHtml(userName, formattedWhen, ipAddress, userAgent, frontendUrl + "/settings/security"));
    }

    private void sendEmail(String to, String subject, String html) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            helper.addInline(LOGO_CID, LOGO_RESOURCE, "image/png");
            mailSender.send(message);
            log.info("Email sent to {} — subject: {}", to, subject);
        } catch (MessagingException | MailException e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage(), e);
        }
    }

    private String buildResetHtml(String name, String link) {
        String firstName = name != null && !name.isBlank() ? name.split(" ")[0] : "there";
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1"/>
              <title>Reset your password</title>
            </head>
            <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
                <tr><td align="center">
                  <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <tr>
                      <td style="background:linear-gradient(135deg,#27272a 0%%,#c2703d 100%%);padding:36px 40px;text-align:center;">
                        <table cellpadding="0" cellspacing="0" align="center">
                          <tr>
                            <td style="background:rgba(255,255,255,0.15);border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                              <img src="cid:logo-mark" width="26" height="26" alt="WealthyNest" style="display:inline-block;vertical-align:middle;" />
                            </td>
                            <td style="padding-left:10px;vertical-align:middle;">
                              <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">WealthyNest</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px 40px 32px;">
                        <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">Hi %s,</p>
                        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                          We received a request to reset your WealthyNest password.
                          Click the button below to choose a new password. This link expires in <strong style="color:#1e293b;">15 minutes</strong>.
                        </p>
                        <table cellpadding="0" cellspacing="0" width="100%%">
                          <tr>
                            <td align="center" style="padding:8px 0 32px;">
                              <a href="%s" style="display:inline-block;background:linear-gradient(135deg,#27272a,#c2703d);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
                                Reset Password
                              </a>
                            </td>
                          </tr>
                        </table>
                        <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;border:1px solid #e2e8f0;margin-bottom:24px;">
                          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Or copy this link</p>
                          <p style="margin:0;font-size:12px;color:#c2703d;word-break:break-all;">%s</p>
                        </div>
                        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                          If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
                        <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">© %d WealthyNest · Built with ♥ for Indian families</p>
                        <p style="margin:0;font-size:12px;color:#cbd5e1;">noreply@wealthynest.in · Do not reply to this email</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(firstName, link, link, currentYear());
    }

    private String buildVerificationHtml(String name, String link) {
        String firstName = name != null && !name.isBlank() ? name.split(" ")[0] : "there";
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1"/>
              <title>Verify your email</title>
            </head>
            <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
                <tr><td align="center">
                  <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <tr>
                      <td style="background:linear-gradient(135deg,#27272a 0%%,#c2703d 100%%);padding:36px 40px;text-align:center;">
                        <table cellpadding="0" cellspacing="0" align="center">
                          <tr>
                            <td style="background:rgba(255,255,255,0.15);border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                              <img src="cid:logo-mark" width="26" height="26" alt="WealthyNest" style="display:inline-block;vertical-align:middle;" />
                            </td>
                            <td style="padding-left:10px;vertical-align:middle;">
                              <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">WealthyNest</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px 40px 32px;">
                        <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">Welcome, %s!</p>
                        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                          Thanks for signing up for WealthyNest. Please verify your email address to activate your account.
                          This link expires in <strong style="color:#1e293b;">24 hours</strong>.
                        </p>
                        <table cellpadding="0" cellspacing="0" width="100%%">
                          <tr>
                            <td align="center" style="padding:8px 0 32px;">
                              <a href="%s" style="display:inline-block;background:linear-gradient(135deg,#27272a,#c2703d);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
                                Verify Email Address
                              </a>
                            </td>
                          </tr>
                        </table>
                        <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;border:1px solid #e2e8f0;margin-bottom:24px;">
                          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Or copy this link</p>
                          <p style="margin:0;font-size:12px;color:#c2703d;word-break:break-all;">%s</p>
                        </div>
                        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                          If you did not create a WealthyNest account, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
                        <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">© %d WealthyNest · Built with ♥ for Indian families</p>
                        <p style="margin:0;font-size:12px;color:#cbd5e1;">noreply@wealthynest.in · Do not reply to this email</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(firstName, link, link, currentYear());
    }

    private String buildAccountExistsHtml(String name, String loginLink, String resetLink) {
        String firstName = name != null && !name.isBlank() ? name.split(" ")[0] : "there";
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1"/>
              <title>You already have an account</title>
            </head>
            <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
                <tr><td align="center">
                  <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <tr>
                      <td style="background:linear-gradient(135deg,#27272a 0%%,#c2703d 100%%);padding:36px 40px;text-align:center;">
                        <table cellpadding="0" cellspacing="0" align="center">
                          <tr>
                            <td style="background:rgba(255,255,255,0.15);border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                              <img src="cid:logo-mark" width="26" height="26" alt="WealthyNest" style="display:inline-block;vertical-align:middle;" />
                            </td>
                            <td style="padding-left:10px;vertical-align:middle;">
                              <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">WealthyNest</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px 40px 32px;">
                        <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">Hi %s,</p>
                        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                          Someone just tried to create a WealthyNest account with this email address — but you
                          already have one. If that was you, sign in below. If you've forgotten your password,
                          you can reset it instead.
                        </p>
                        <table cellpadding="0" cellspacing="0" width="100%%">
                          <tr>
                            <td align="center" style="padding:8px 0 16px;">
                              <a href="%s" style="display:inline-block;background:linear-gradient(135deg,#27272a,#c2703d);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
                                Sign In
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 0 32px;">
                              <a href="%s" style="color:#c2703d;font-size:13px;text-decoration:underline;">
                                Forgot your password?
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                          If this wasn't you, no action is needed — your account is safe and no changes were made.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
                        <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">© %d WealthyNest · Built with ♥ for Indian families</p>
                        <p style="margin:0;font-size:12px;color:#cbd5e1;">noreply@wealthynest.in · Do not reply to this email</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(firstName, loginLink, resetLink, currentYear());
    }

    private String buildNewSignInHtml(String name, String when, String ipAddress, String userAgent, String securityLink) {
        String firstName = name != null && !name.isBlank() ? name.split(" ")[0] : "there";
        String ip = ipAddress != null && !ipAddress.isBlank() ? ipAddress : "Unknown";
        String device = userAgent != null && !userAgent.isBlank() ? userAgent : "Unknown device";
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1"/>
              <title>New sign-in to your account</title>
            </head>
            <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
              <table width="100%%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
                <tr><td align="center">
                  <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <tr>
                      <td style="background:linear-gradient(135deg,#27272a 0%%,#c2703d 100%%);padding:36px 40px;text-align:center;">
                        <table cellpadding="0" cellspacing="0" align="center">
                          <tr>
                            <td style="background:rgba(255,255,255,0.15);border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                              <img src="cid:logo-mark" width="26" height="26" alt="WealthyNest" style="display:inline-block;vertical-align:middle;" />
                            </td>
                            <td style="padding-left:10px;vertical-align:middle;">
                              <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">WealthyNest</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px 40px 32px;">
                        <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">Hi %s,</p>
                        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                          Your WealthyNest account was just signed into. If this was you, no action is needed.
                        </p>
                        <table cellpadding="0" cellspacing="0" width="100%%" style="background:#f8fafc;border-radius:12px;margin-bottom:24px;">
                          <tr>
                            <td style="padding:18px 20px;">
                              <p style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong style="color:#1e293b;">When:</strong> %s</p>
                              <p style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong style="color:#1e293b;">IP address:</strong> %s</p>
                              <p style="margin:0;font-size:13px;color:#64748b;"><strong style="color:#1e293b;">Device:</strong> %s</p>
                            </td>
                          </tr>
                        </table>
                        <table cellpadding="0" cellspacing="0" width="100%%">
                          <tr>
                            <td align="center" style="padding:8px 0 24px;">
                              <a href="%s" style="display:inline-block;background:linear-gradient(135deg,#27272a,#c2703d);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
                                Review account security
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                          If this wasn't you, sign out of that session from Security settings and change your password
                          right away.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
                        <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">© %d WealthyNest · Built with ♥ for Indian families</p>
                        <p style="margin:0;font-size:12px;color:#cbd5e1;">noreply@wealthynest.in · Do not reply to this email</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(firstName, when, ip, device, securityLink, currentYear());
    }
}
