package com.wealthynest.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.*;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = EnumValidator.Validator.class)
@Documented
public @interface EnumValidator {
    Class<? extends Enum<?>> enumClass();
    String message() default "Invalid value. Must be one of the allowed values.";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<EnumValidator, String> {
        private Set<String> allowedValues;

        @Override
        public void initialize(EnumValidator annotation) {
            allowedValues = Arrays.stream(annotation.enumClass().getEnumConstants())
                    .map(Enum::name).collect(Collectors.toSet());
        }

        @Override
        public boolean isValid(String value, ConstraintValidatorContext ctx) {
            return value == null || allowedValues.contains(value.toUpperCase());
        }
    }
}
