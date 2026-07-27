package com.wealthynest.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Direct unit tests against every @ExceptionHandler branch — cheaper and more exhaustive than
 * relying on incidental coverage from individual controller @WebMvcTest classes, and guarantees
 * the rarer branches (DisabledException/LockedException, DataIntegrityViolationException, the
 * generic 500 fallback) are actually exercised rather than assumed covered.
 */
@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

    @Mock private HttpServletRequest request;

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @BeforeEach
    void stubRequestUri() {
        lenient().when(request.getRequestURI()).thenReturn("/api/v1/test");
    }

    @Test
    @DisplayName("ResourceNotFoundException -> 404 NOT_FOUND")
    void handlesNotFound() {
        var res = handler.handleNotFound(new ResourceNotFoundException("User", "id", "abc"), request);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(res.getBody().getError()).isEqualTo("NOT_FOUND");
    }

    @Test
    @DisplayName("BusinessException -> the exception's own status and code")
    void handlesBusinessException() {
        var res = handler.handleBusiness(new BusinessException("nope", HttpStatus.CONFLICT, "CUSTOM_CODE"), request);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(res.getBody().getError()).isEqualTo("CUSTOM_CODE");
    }

    @Test
    @DisplayName("AccessDeniedException -> 403 FORBIDDEN")
    void handlesAccessDenied() {
        var res = handler.handleAccessDenied(new AccessDeniedException("nope"), request);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(res.getBody().getError()).isEqualTo("FORBIDDEN");
    }

    @Test
    @DisplayName("MethodArgumentNotValidException -> 422 with fieldErrors map")
    void handlesMethodArgumentNotValid() {
        BindingResult bindingResult = mock(BindingResult.class);
        FieldError fieldError = new FieldError("obj", "name", "must not be blank");
        when(bindingResult.getFieldErrors()).thenReturn(List.of(fieldError));
        MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
        when(ex.getBindingResult()).thenReturn(bindingResult);

        var res = handler.handleValidation(ex, request);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(res.getBody().getFieldErrors()).containsEntry("name", "must not be blank");
    }

    @Test
    @DisplayName("MethodArgumentNotValidException with a null default message -> falls back to \"Invalid value\"")
    void handlesMethodArgumentNotValid_nullMessageFallsBack() {
        BindingResult bindingResult = mock(BindingResult.class);
        FieldError fieldError = new FieldError("obj", "name", null, false, null, null, null);
        when(bindingResult.getFieldErrors()).thenReturn(List.of(fieldError));
        MethodArgumentNotValidException ex = mock(MethodArgumentNotValidException.class);
        when(ex.getBindingResult()).thenReturn(bindingResult);

        var res = handler.handleValidation(ex, request);

        assertThat(res.getBody().getFieldErrors()).containsEntry("name", "Invalid value");
    }

    @Test
    @DisplayName("HandlerMethodValidationException -> 422 with fieldErrors map keyed by parameter name")
    void handlesHandlerMethodValidation() {
        HandlerMethodValidationException ex = mock(HandlerMethodValidationException.class);
        var paramResult = mock(org.springframework.validation.method.ParameterValidationResult.class);
        org.springframework.core.MethodParameter methodParameter = mock(org.springframework.core.MethodParameter.class);
        when(methodParameter.getParameterName()).thenReturn("email");
        when(paramResult.getMethodParameter()).thenReturn(methodParameter);
        org.springframework.context.MessageSourceResolvable resolvable =
                mock(org.springframework.context.MessageSourceResolvable.class);
        when(resolvable.getDefaultMessage()).thenReturn("Invalid email address");
        when(paramResult.getResolvableErrors()).thenReturn(List.of(resolvable));
        when(ex.getParameterValidationResults()).thenReturn(List.of(paramResult));

        var res = handler.handleHandlerMethodValidation(ex, request);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(res.getBody().getFieldErrors()).containsEntry("email", "Invalid email address");
    }

    @Test
    @DisplayName("HandlerMethodValidationException with no resolvable errors -> falls back to \"Invalid value\"")
    void handlesHandlerMethodValidation_emptyResolvableErrors() {
        HandlerMethodValidationException ex = mock(HandlerMethodValidationException.class);
        var paramResult = mock(org.springframework.validation.method.ParameterValidationResult.class);
        org.springframework.core.MethodParameter methodParameter = mock(org.springframework.core.MethodParameter.class);
        when(methodParameter.getParameterName()).thenReturn("pin");
        when(paramResult.getMethodParameter()).thenReturn(methodParameter);
        when(paramResult.getResolvableErrors()).thenReturn(List.of());
        when(ex.getParameterValidationResults()).thenReturn(List.of(paramResult));

        var res = handler.handleHandlerMethodValidation(ex, request);

        assertThat(res.getBody().getFieldErrors()).containsEntry("pin", "Invalid value");
    }

    @Test
    @DisplayName("HttpRequestMethodNotSupportedException -> 405 METHOD_NOT_ALLOWED")
    void handlesMethodNotSupported() {
        var res = handler.handleMethodNotSupported(new HttpRequestMethodNotSupportedException("POST"), request);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
    }

    @Test
    @DisplayName("ConstraintViolationException -> 422 with fieldErrors keyed by property path")
    void handlesConstraintViolation() {
        @SuppressWarnings("unchecked")
        ConstraintViolation<Object> violation = mock(ConstraintViolation.class);
        jakarta.validation.Path path = mock(jakarta.validation.Path.class);
        when(path.toString()).thenReturn("amount");
        when(violation.getPropertyPath()).thenReturn(path);
        when(violation.getMessage()).thenReturn("must be positive");

        var res = handler.handleConstraintViolation(new ConstraintViolationException(Set.of(violation)), request);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(res.getBody().getFieldErrors()).containsEntry("amount", "must be positive");
    }

    @Test
    @DisplayName("BadCredentialsException -> 401 INVALID_CREDENTIALS, generic message (no user enumeration)")
    void handlesBadCredentials() {
        var res = handler.handleBadCredentials(request);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(res.getBody().getMessage()).isEqualTo("Invalid email or password");
    }

    @Test
    @DisplayName("DisabledException -> 403 ACCOUNT_INACTIVE")
    void handlesDisabledAccount() {
        var res = handler.handleAccountStatus(request);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(res.getBody().getError()).isEqualTo("ACCOUNT_INACTIVE");
    }

    @Test
    @DisplayName("MethodArgumentTypeMismatchException -> 400 INVALID_PARAMETER naming the bad parameter")
    void handlesTypeMismatch() {
        MethodArgumentTypeMismatchException ex = mock(MethodArgumentTypeMismatchException.class);
        when(ex.getName()).thenReturn("id");

        var res = handler.handleTypeMismatch(ex, request);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(res.getBody().getMessage()).contains("'id'");
    }

    @Test
    @DisplayName("MissingServletRequestParameterException -> 400 MISSING_PARAMETER naming the missing parameter")
    void handlesMissingParameter() {
        var res = handler.handleMissingParameter(
                new MissingServletRequestParameterException("categoryId", "UUID"), request);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(res.getBody().getMessage()).contains("'categoryId'");
    }

    @Test
    @DisplayName("HttpMessageNotReadableException -> 400 MALFORMED_REQUEST")
    void handlesMalformedBody() {
        var res = handler.handleMalformedBody(request);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(res.getBody().getError()).isEqualTo("MALFORMED_REQUEST");
    }

    @Test
    @DisplayName("DataIntegrityViolationException -> 409 DATA_CONFLICT, no raw DB detail leaked in message")
    void handlesDataIntegrityViolation() {
        var res = handler.handleDataIntegrityViolation(
                new DataIntegrityViolationException("duplicate key value violates unique constraint"), request);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(res.getBody().getMessage()).isEqualTo("This conflicts with existing data");
    }

    @Test
    @DisplayName("Unhandled exception -> 500 INTERNAL_ERROR, generic message (no stack trace leaked)")
    void handlesGeneralException() {
        var res = handler.handleGeneral(new RuntimeException("something exploded"), request);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(res.getBody().getMessage()).isEqualTo("An unexpected error occurred");
    }
}
