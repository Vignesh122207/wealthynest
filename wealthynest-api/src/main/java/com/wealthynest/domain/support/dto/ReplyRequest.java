package com.wealthynest.domain.support.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReplyRequest {
    @NotBlank @Size(min = 1, max = 5000)
    private String message;
}
