package com.wealthynest.infra.email;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
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
}
