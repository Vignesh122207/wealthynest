package com.wealthynest.infra.email;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailServiceImplTest {

    @Mock private JavaMailSender mailSender;

    @InjectMocks
    private EmailServiceImpl emailService;

    private MimeMessage newRealMimeMessage() {
        return new MimeMessage(Session.getDefaultInstance(new Properties()));
    }

    @Test
    void sendPasswordResetEmail_sendsWithSubjectAndFirstName() throws Exception {
        ReflectionTestUtils.setField(emailService, "fromAddress", "noreply@wealthynest.in");
        when(mailSender.createMimeMessage()).thenReturn(newRealMimeMessage());

        emailService.sendPasswordResetEmail("user@example.com", "Alice Smith", "https://app/reset?token=abc");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        MimeMessage sent = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(sent.getSubject()).isEqualTo("Reset your WealthyNest password");
        org.assertj.core.api.Assertions.assertThat(sent.getAllRecipients()[0].toString()).contains("user@example.com");
    }

    @Test
    void sendVerificationEmail_sendsWithSubject() throws Exception {
        ReflectionTestUtils.setField(emailService, "fromAddress", "noreply@wealthynest.in");
        when(mailSender.createMimeMessage()).thenReturn(newRealMimeMessage());

        emailService.sendVerificationEmail("user@example.com", "Bob", "https://app/verify?token=xyz");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().getSubject())
                .isEqualTo("Verify your WealthyNest email");
    }

    @Test
    void sendPasswordResetEmail_embedsBrandLogoAsCidInlineImage() throws Exception {
        ReflectionTestUtils.setField(emailService, "fromAddress", "noreply@wealthynest.in");
        when(mailSender.createMimeMessage()).thenReturn(newRealMimeMessage());

        emailService.sendPasswordResetEmail("user@example.com", "Alice", "https://app/reset?token=abc");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        MimeMessage sent = captor.getValue();

        // MimeMessageHelper wraps the message as multipart/mixed > [0] multipart/related >
        // [0] html text, [1] the addInline()'d logo — see EmailServiceImpl#sendEmail.
        jakarta.mail.internet.MimeMultipart mixed = (jakarta.mail.internet.MimeMultipart) sent.getContent();
        jakarta.mail.internet.MimeMultipart related =
                (jakarta.mail.internet.MimeMultipart) mixed.getBodyPart(0).getContent();

        org.assertj.core.api.Assertions.assertThat((String) related.getBodyPart(0).getContent())
                .contains("cid:logo-mark");

        jakarta.mail.internet.MimeBodyPart logoPart = (jakarta.mail.internet.MimeBodyPart) related.getBodyPart(1);
        org.assertj.core.api.Assertions.assertThat(logoPart.getHeader("Content-ID")[0]).contains("logo-mark");
        org.assertj.core.api.Assertions.assertThat(logoPart.getHeader("Content-Disposition")[0]).contains("inline");
    }

    @Test
    void nullOrBlankName_fallsBackToThere() throws Exception {
        ReflectionTestUtils.setField(emailService, "fromAddress", "noreply@wealthynest.in");
        when(mailSender.createMimeMessage()).thenReturn(newRealMimeMessage());

        emailService.sendPasswordResetEmail("user@example.com", null, "https://app/reset");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        Object content = captor.getValue().getContent();
        while (content instanceof jakarta.mail.internet.MimeMultipart mp) {
            content = mp.getBodyPart(0).getContent();
        }
        org.assertj.core.api.Assertions.assertThat((String) content).contains("Hi there,");
    }

    @Test
    void messagingExceptionDuringSend_isSwallowed_notPropagated() {
        ReflectionTestUtils.setField(emailService, "fromAddress", "noreply@wealthynest.in");
        when(mailSender.createMimeMessage()).thenReturn(newRealMimeMessage());
        // An unterminated quoted-string is invalid per RFC 822 and makes MimeMessageHelper#setTo
        // throw a checked AddressException (a MessagingException) — the exact failure mode this
        // catch block exists for.
        assertThatCode(() -> emailService.sendPasswordResetEmail("\"unterminated", "Alice", "https://app/reset"))
                .doesNotThrowAnyException();

        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void mailExceptionDuringSend_isSwallowed_notPropagated() {
        ReflectionTestUtils.setField(emailService, "fromAddress", "noreply@wealthynest.in");
        when(mailSender.createMimeMessage()).thenReturn(newRealMimeMessage());
        // mailSender.send() itself throws Spring's unchecked MailException (e.g. auth/connection
        // failure against the relay) — distinct from the checked MessagingException thrown while
        // building the message. Both must be swallowed here, not just the checked one.
        doThrow(new MailSendException("relay rejected message")).when(mailSender).send(any(MimeMessage.class));

        assertThatCode(() -> emailService.sendPasswordResetEmail("user@example.com", "Alice", "https://app/reset"))
                .doesNotThrowAnyException();

        verify(mailSender).send(any(MimeMessage.class));
    }
}
