package com.wealthynest.domain.category.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class CategoryResponse {
    private UUID    id;
    private String  name;
    private String  icon;
    private String  color;
    private String  type;
    @JsonProperty("isSystem")
    private boolean system;
    private UUID    userId;
}
