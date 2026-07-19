package com.wealthynest.domain.asset.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.asset.dto.request.CreateAssetRequest;
import com.wealthynest.domain.asset.dto.response.AssetResponse;
import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.entity.AssetType;
import com.wealthynest.domain.asset.mapper.AssetMapper;
import com.wealthynest.domain.asset.repository.AssetRepository;
import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.entity.InvestmentType;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AssetServiceImplTest {

    @Mock private AssetRepository      assetRepository;
    @Mock private AssetMapper          assetMapper;
    @Mock private InvestmentRepository investmentRepository;

    @InjectMocks
    private AssetServiceImpl service;

    private final UUID userId  = UUID.randomUUID();
    private final UUID assetId = UUID.randomUUID();

    @BeforeEach
    void stubMapperPassthrough() {
        lenient().when(assetMapper.toEntity(any())).thenAnswer(inv -> Asset.builder().build());
        lenient().when(assetMapper.toResponse(any(Asset.class))).thenAnswer(inv -> {
            Asset a = inv.getArgument(0);
            return AssetResponse.builder().id(a.getId()).name(a.getName()).build();
        });
    }

    private Asset withId(Asset a) {
        ReflectionTestUtils.setField(a, "id", assetId);
        return a;
    }

    // ─── createAsset ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("createAsset sets userId/familyId on the mapped entity")
    void createAssetSetsOwnership() {
        UUID familyId = UUID.randomUUID();
        when(assetRepository.save(any(Asset.class))).thenAnswer(inv -> inv.getArgument(0));
        CreateAssetRequest req = mock(CreateAssetRequest.class);

        service.createAsset(userId, familyId, req);

        var captor = org.mockito.ArgumentCaptor.forClass(Asset.class);
        verify(assetRepository).save(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        assertThat(captor.getValue().getFamilyId()).isEqualTo(familyId);
    }

    // ─── updateAsset ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateAsset")
    class UpdateAssetTests {

        @Test
        @DisplayName("throws when not found or not owned")
        void throwsWhenNotFoundOrNotOwned() {
            when(assetRepository.findById(assetId)).thenReturn(Optional.empty());
            CreateAssetRequest req = mock(CreateAssetRequest.class);
            assertThatThrownBy(() -> service.updateAsset(assetId, userId, req)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException for another user's asset")
        void throwsWhenNotOwned() {
            Asset asset = withId(Asset.builder().userId(UUID.randomUUID()).build());
            when(assetRepository.findById(assetId)).thenReturn(Optional.of(asset));
            CreateAssetRequest req = mock(CreateAssetRequest.class);
            assertThatThrownBy(() -> service.updateAsset(assetId, userId, req)).isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("defaults asOfDate to today when the request omits it")
        void defaultsAsOfDateToToday() {
            Asset asset = withId(Asset.builder().userId(userId).build());
            when(assetRepository.findById(assetId)).thenReturn(Optional.of(asset));
            when(assetRepository.save(any(Asset.class))).thenAnswer(inv -> inv.getArgument(0));
            CreateAssetRequest req = mock(CreateAssetRequest.class);
            when(req.getAssetType()).thenReturn(AssetType.OTHER);
            when(req.getCurrentValue()).thenReturn(new BigDecimal("1000"));
            when(req.getAsOfDate()).thenReturn(null);

            service.updateAsset(assetId, userId, req);

            assertThat(asset.getAsOfDate()).isEqualTo(LocalDate.now());
        }

        @Test
        @DisplayName("uses the request's asOfDate when provided")
        void usesProvidedAsOfDate() {
            Asset asset = withId(Asset.builder().userId(userId).build());
            when(assetRepository.findById(assetId)).thenReturn(Optional.of(asset));
            when(assetRepository.save(any(Asset.class))).thenAnswer(inv -> inv.getArgument(0));
            LocalDate customDate = LocalDate.of(2025, 1, 1);
            CreateAssetRequest req = mock(CreateAssetRequest.class);
            when(req.getAssetType()).thenReturn(AssetType.OTHER);
            when(req.getCurrentValue()).thenReturn(new BigDecimal("1000"));
            when(req.getAsOfDate()).thenReturn(customDate);

            service.updateAsset(assetId, userId, req);

            assertThat(asset.getAsOfDate()).isEqualTo(customDate);
        }
    }

    // ─── deleteAsset ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("deleteAsset soft-deletes (active=false)")
    void deleteAssetSoftDeletes() {
        Asset asset = withId(Asset.builder().userId(userId).active(true).build());
        when(assetRepository.findById(assetId)).thenReturn(Optional.of(asset));

        service.deleteAsset(assetId, userId);

        assertThat(asset.isActive()).isFalse();
        verify(assetRepository, never()).delete(any());
    }

    // ─── getAssets ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAssets")
    class GetAssetsTests {

        @Test
        @DisplayName("excludes assets that are linked to an active investment (shown via the portfolio instead)")
        void excludesInvestmentLinkedAssets() {
            UUID linkedAssetId = UUID.randomUUID();
            UUID standaloneAssetId = UUID.randomUUID();
            Asset linked = Asset.builder().userId(userId).name("Linked").build();
            ReflectionTestUtils.setField(linked, "id", linkedAssetId);
            Asset standalone = Asset.builder().userId(userId).name("Standalone").build();
            ReflectionTestUtils.setField(standalone, "id", standaloneAssetId);
            when(assetRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(linked, standalone));

            Investment inv = Investment.builder().userId(userId).assetId(linkedAssetId)
                    .investmentType(InvestmentType.STOCK).investedAmount(BigDecimal.ZERO).currentValue(BigDecimal.ZERO).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));

            List<AssetResponse> result = service.getAssets(userId, null);

            assertThat(result).extracting(AssetResponse::getName).containsExactly("Standalone");
        }

        @Test
        @DisplayName("returns all assets unfiltered when no investments reference any of them")
        void returnsAllWhenNoInvestmentLinks() {
            Asset asset = Asset.builder().userId(userId).name("Real Estate").build();
            ReflectionTestUtils.setField(asset, "id", UUID.randomUUID());
            when(assetRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(asset));
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of());

            List<AssetResponse> result = service.getAssets(userId, null);

            assertThat(result).hasSize(1);
        }
    }

    // ─── net worth delegation ────────────────────────────────────────────────────

    @Test
    @DisplayName("getTotalNetWorth and getFamilyNetWorth delegate to the correct repository sums")
    void netWorthDelegation() {
        UUID familyId = UUID.randomUUID();
        when(assetRepository.sumCurrentValueByUser(userId)).thenReturn(new BigDecimal("50000"));
        when(assetRepository.sumCurrentValueByFamily(familyId)).thenReturn(new BigDecimal("150000"));

        assertThat(service.getTotalNetWorth(userId, null)).isEqualByComparingTo("50000");
        assertThat(service.getFamilyNetWorth(familyId)).isEqualByComparingTo("150000");
    }
}
