package com.wealthynest.domain.support.dto;

import com.wealthynest.domain.support.entity.SupportTicket;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateTicketRequest {
    @NotBlank @Size(min = 5, max = 200)
    private String subject;

    @NotNull
    private SupportTicket.Category category;

    @NotBlank @Size(min = 10, max = 5000)
    private String description;
}
