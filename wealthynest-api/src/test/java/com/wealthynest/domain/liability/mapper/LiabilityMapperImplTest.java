package com.wealthynest.domain.liability.mapper;

import com.wealthynest.domain.liability.dto.request.CreateLiabilityRequest;
import com.wealthynest.domain.liability.entity.Liability;
import com.wealthynest.domain.liability.entity.LiabilityType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class LiabilityMapperImplTest {

    private final LiabilityMapper mapper = new LiabilityMapperImpl();

    @Test
    @DisplayName("toResponse(null) -> null")
    void toResponse_null_returnsNull() {
        assertThat(mapper.toResponse(null)).isNull();
    }

    @Test
    @DisplayName("toResponse maps all fields, including liabilityType via its expression")
    void toResponse_mapsAllFields() {
        Liability liability = Liability.builder()
                .name("Home Loan").liabilityType(LiabilityType.HOME_LOAN)
                .principalAmount(new BigDecimal("500000")).outstandingAmount(new BigDecimal("400000"))
                .interestRate(new BigDecimal("8.5")).lenderName("HDFC")
                .emiAmount(new BigDecimal("12000")).startDate(LocalDate.of(2024, 1, 1))
                .endDate(LocalDate.of(2044, 1, 1)).notes("Primary residence").active(true).build();
        ReflectionTestUtils.setField(liability, "id", UUID.randomUUID());

        var response = mapper.toResponse(liability);

        assertThat(response.getName()).isEqualTo("Home Loan");
        assertThat(response.getLiabilityType()).isEqualTo("HOME_LOAN");
        assertThat(response.getPrincipalAmount()).isEqualByComparingTo("500000");
        assertThat(response.getOutstandingAmount()).isEqualByComparingTo("400000");
        assertThat(response.getLenderName()).isEqualTo("HDFC");
        assertThat(response.isActive()).isTrue();
    }

    @Test
    @DisplayName("toResponseList(null) -> null")
    void toResponseList_null_returnsNull() {
        assertThat(mapper.toResponseList(null)).isNull();
    }

    @Test
    @DisplayName("toResponseList maps each element in order")
    void toResponseList_mapsEachElement() {
        Liability l1 = Liability.builder().name("Home Loan").liabilityType(LiabilityType.HOME_LOAN)
                .principalAmount(BigDecimal.TEN).outstandingAmount(BigDecimal.TEN).active(true).build();
        Liability l2 = Liability.builder().name("Car Loan").liabilityType(LiabilityType.CAR_LOAN)
                .principalAmount(BigDecimal.ONE).outstandingAmount(BigDecimal.ONE).active(true).build();

        List<com.wealthynest.domain.liability.dto.response.LiabilityResponse> responses =
                mapper.toResponseList(List.of(l1, l2));

        assertThat(responses).hasSize(2);
        assertThat(responses.get(0).getName()).isEqualTo("Home Loan");
        assertThat(responses.get(1).getName()).isEqualTo("Car Loan");
    }

    @Test
    @DisplayName("toEntity(null) -> null")
    void toEntity_null_returnsNull() {
        assertThat(mapper.toEntity(null)).isNull();
    }

    @Test
    @DisplayName("toEntity maps request fields and forces active=true regardless of input")
    void toEntity_mapsFieldsAndForcesActiveTrue() {
        CreateLiabilityRequest req = new CreateLiabilityRequest();
        ReflectionTestUtils.setField(req, "name", "Personal Loan");
        ReflectionTestUtils.setField(req, "liabilityType", LiabilityType.PERSONAL_LOAN);
        ReflectionTestUtils.setField(req, "principalAmount", new BigDecimal("100000"));
        ReflectionTestUtils.setField(req, "outstandingAmount", new BigDecimal("90000"));
        ReflectionTestUtils.setField(req, "lenderName", "ICICI");

        Liability entity = mapper.toEntity(req);

        assertThat(entity.getName()).isEqualTo("Personal Loan");
        assertThat(entity.getLiabilityType()).isEqualTo(LiabilityType.PERSONAL_LOAN);
        assertThat(entity.getPrincipalAmount()).isEqualByComparingTo("100000");
        assertThat(entity.isActive()).isTrue();
        assertThat(entity.getId()).isNull();
    }
}
