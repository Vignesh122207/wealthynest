package com.wealthynest.domain.asset.dto.request;

import com.wealthynest.domain.asset.entity.AssetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
public class CreateAssetRequest {
    @NotBlank @Size(max = 100) private String name;
    @NotNull private AssetType assetType;
    @NotNull @PositiveOrZero private BigDecimal currentValue;
    @Size(max = 100) private String institution;
    @Size(max = 50)  private String accountNumber;
    private String notes;
    private LocalDate asOfDate;
}
