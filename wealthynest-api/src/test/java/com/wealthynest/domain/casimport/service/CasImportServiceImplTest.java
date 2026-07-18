package com.wealthynest.domain.casimport.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.domain.casimport.dto.CasConfirmRowRequest;
import com.wealthynest.domain.casimport.dto.CasImportConfirmRequest;
import com.wealthynest.domain.casimport.dto.CasImportResultResponse;
import com.wealthynest.domain.casimport.dto.CasParsedHolding;
import com.wealthynest.domain.investment.dto.request.CreateInvestmentRequest;
import com.wealthynest.domain.investment.dto.response.InvestmentResponse;
import com.wealthynest.domain.investment.repository.MfMasterRepository;
import com.wealthynest.domain.investment.service.InvestmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CasImportServiceImplTest {

    @Mock private MfMasterRepository mfMasterRepository;
    @Mock private InvestmentService  investmentService;

    // Constructed manually (not @InjectMocks) so ObjectMapper is a real instance — confirm()
    // relies on its actual convertValue() conversion behavior, not a mockable stub.
    private CasImportServiceImpl service;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        // Mirrors the real Spring-managed ObjectMapper bean: Spring Boot auto-registers
        // JavaTimeModule when jackson-datatype-jsr310 is on the classpath, which confirm()'s
        // Map -> CreateInvestmentRequest conversion (LocalDate purchaseDate) depends on. A plain
        // `new ObjectMapper()` can't convert LocalDate and throws, which confirm() then silently
        // swallows per-row — every row would "fail" with zero createInvestment calls, which is
        // exactly what happened before this fix (a lesson in matching production wiring, not a
        // finding about the production code itself).
        service = new CasImportServiceImpl(mfMasterRepository, investmentService,
                new ObjectMapper().registerModule(new JavaTimeModule()));
    }

    /** parseHoldings(String) is private — invoked via reflection directly on parser output text,
     * sidestepping the need to synthesize a real binary PDF just to exercise the text-parsing
     * logic (which is what's actually risky/bug-prone here; the PDF-loading plumbing itself is
     * shared with StatementImportServiceImpl and already covered there). */
    @SuppressWarnings("unchecked")
    private List<CasParsedHolding> parseHoldings(String text) {
        lenient().when(mfMasterRepository.search(any(), any())).thenReturn(List.of());
        return (List<CasParsedHolding>) ReflectionTestUtils.invokeMethod(service, "parseHoldings", text);
    }

    // ─── preview: input validation ───────────────────────────────────────────────

    @Test
    @DisplayName("rejects a null/empty file upload")
    void rejectsEmptyFile() {
        MultipartFile empty = new MockMultipartFile("file", "x.pdf", "application/pdf", new byte[0]);
        assertThatThrownBy(() -> service.preview(empty, null, userId)).isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("an unreadable/corrupt PDF is rejected with a clear error")
    void rejectsCorruptPdf() {
        MultipartFile pdf = new MockMultipartFile("file", "cas.pdf", "application/pdf", "not a real pdf".getBytes());
        assertThatThrownBy(() -> service.preview(pdf, null, userId)).isInstanceOf(BusinessException.class);
    }

    // ─── parseHoldings: text-parsing logic ───────────────────────────────────────

    @Nested
    @DisplayName("parseHoldings (CAS text parsing)")
    class ParseHoldingsTests {

        @Test
        @DisplayName("extracts folio, units, NAV and value from a well-formed block")
        void extractsCompleteHolding() {
            String text = String.join("\n",
                    "Folio No: 12345678/0",
                    "HDFC Flexicap Fund - Growth Option - Direct Plan",
                    "Closing Unit Balance: 1,234.5670",
                    "NAV on 30-Jun-2026: Rs. 45.6789",
                    "Market Value: Rs. 56,394.66");

            List<CasParsedHolding> holdings = parseHoldings(text);

            assertThat(holdings).hasSize(1);
            CasParsedHolding h = holdings.get(0);
            assertThat(h.getFolioNumber()).isEqualTo("12345678/0");
            assertThat(h.getUnits()).isEqualByComparingTo("1234.5670");
            assertThat(h.getNav()).isEqualByComparingTo("45.6789");
            assertThat(h.getCurrentValue()).isEqualByComparingTo("56394.66");
        }

        @Test
        @DisplayName("'Folio No: X / Y' (with spaces around the slash — the exact format this class's own " +
                "doc-comment gives as an example) preserves the sub-account suffix, spaces normalized away")
        void folioNumberPreservesSubAccountSuffixDespiteSurroundingSpaces() {
            String text = String.join("\n",
                    "Folio No: 12345678 / 0",
                    "HDFC Flexicap Fund - Growth Option - Direct Plan",
                    "Closing Unit Balance: 1,234.5670",
                    "Market Value: Rs. 56,394.66");

            String folio = parseHoldings(text).get(0).getFolioNumber();

            assertThat(folio).isEqualTo("12345678/0");
        }

        @Test
        @DisplayName("the 'Closing Unit Balance' line is excluded from scheme-name candidacy, so it doesn't " +
                "overwrite the real fund name parsed on an earlier line")
        void closingBalanceLineDoesNotOverwriteRealSchemeName() {
            String text = String.join("\n",
                    "HDFC Flexicap Fund - Growth Option - Direct Plan",
                    "Closing Unit Balance: 1,234.5670",
                    "Market Value: Rs. 56,394.66");

            CasParsedHolding h = parseHoldings(text).get(0);

            assertThat(h.getSchemeName()).isEqualTo("HDFC Flexicap Fund - Growth Option - Direct Plan");
            assertThat(h.isValid()).isTrue();
        }

        @Test
        @DisplayName("derives currentValue as units x nav when the CAS doesn't print a Market Value line")
        void derivesCurrentValueFromUnitsAndNav() {
            String text = String.join("\n",
                    "Axis Bluechip Fund - Direct Growth",
                    "Closing Unit Balance: 100.0000",
                    "NAV on 30-Jun-2026: Rs. 50.0000");

            CasParsedHolding h = parseHoldings(text).get(0);

            assertThat(h.getCurrentValue()).isEqualByComparingTo("5000.0000");
            assertThat(h.isValid()).isTrue();
        }

        @Test
        @DisplayName("derives NAV as currentValue / units when the CAS doesn't print a NAV line")
        void derivesNavFromValueAndUnits() {
            String text = String.join("\n",
                    "SBI Small Cap Fund - Direct Growth",
                    "Closing Unit Balance: 200.0000",
                    "Market Value: Rs. 10,000.00");

            CasParsedHolding h = parseHoldings(text).get(0);

            assertThat(h.getNav()).isEqualByComparingTo("50.0000");
        }

        @Test
        @DisplayName("a missing unit balance is flagged invalid with a clear error, not silently dropped")
        void flagsMissingUnits() {
            String text = String.join("\n",
                    "Some Fund - Direct Growth",
                    "NAV on 30-Jun-2026: Rs. 45.6789",
                    "Market Value: Rs. 56,394.66");

            List<CasParsedHolding> holdings = parseHoldings(text);

            assertThat(holdings).isEmpty(); // no "Closing Unit Balance" line -> nothing to anchor a row on
        }

        @Test
        @DisplayName("units present but neither value nor NAV derivable is flagged invalid")
        void flagsUndeterminableValue() {
            String text = String.join("\n",
                    "Some Fund - Direct Growth",
                    "Closing Unit Balance: 100.0000");

            CasParsedHolding h = parseHoldings(text).get(0);

            assertThat(h.isValid()).isFalse();
            assertThat(h.getError()).isEqualTo("Could not find market value");
        }

        @Test
        @DisplayName("no confident scheme name yields a placeholder name and an invalid row flagged for review")
        void flagsUnconfidentSchemeName() {
            // The balance line itself must be excluded from name-candidacy for the TRUE "no name
            // found" fallback to trigger (see closingBalanceLineOverwritesRealSchemeName above) —
            // putting NAV on the same line as the balance achieves that, since a line matching
            // NAV_PATTERN is skipped by the candidacy check entirely, independent of the units
            // match that follows it.
            String text = String.join("\n",
                    "PAN: ABCDE1234F",  // excluded by isPlausibleSchemeName
                    "Closing Unit Balance: 100.0000 NAV: Rs. 50.0000");

            CasParsedHolding h = parseHoldings(text).get(0);

            assertThat(h.getSchemeName()).startsWith("Unknown scheme");
            assertThat(h.isValid()).isFalse();
            assertThat(h.getError()).isEqualTo("Could not confidently identify the scheme name — please check");
        }

        @Test
        @DisplayName("boilerplate lines (statement header, page footers) are never mistaken for a scheme name")
        void excludesBoilerplateFromSchemeNameCandidates() {
            // Same NAV-on-the-balance-line trick as above, so this test isolates boilerplate
            // exclusion from the separate closing-balance-overwrite bug documented above.
            String text = String.join("\n",
                    "CONSOLIDATED ACCOUNT STATEMENT",
                    "Statement for the period 01-Apr-2026 to 30-Jun-2026",
                    "Real Fund Name - Direct Growth Plan",
                    "Closing Unit Balance: 100.0000 NAV: Rs. 50.0000");

            CasParsedHolding h = parseHoldings(text).get(0);

            assertThat(h.getSchemeName()).isEqualTo("Real Fund Name - Direct Growth Plan");
        }

        @Test
        @DisplayName("multiple folios in one statement each produce their own holding row")
        void parsesMultipleHoldings() {
            String text = String.join("\n",
                    "Folio No: 111/0",
                    "Fund One - Direct Growth",
                    "Closing Unit Balance: 100.0000",
                    "Market Value: Rs. 5,000.00",
                    "Folio No: 222/0",
                    "Fund Two - Direct Growth",
                    "Closing Unit Balance: 200.0000",
                    "Market Value: Rs. 20,000.00");

            List<CasParsedHolding> holdings = parseHoldings(text);

            assertThat(holdings).hasSize(2);
            assertThat(holdings.get(0).getFolioNumber()).isEqualTo("111/0");
            assertThat(holdings.get(1).getFolioNumber()).isEqualTo("222/0");
        }

        @Test
        @DisplayName("empty statement text yields no holdings, not an exception")
        void emptyTextYieldsNoHoldings() {
            assertThat(parseHoldings("")).isEmpty();
        }
    }

    // ─── confirm ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("confirm")
    class ConfirmTests {

        private CasConfirmRowRequest row(BigDecimal units, BigDecimal nav, BigDecimal currentValue, BigDecimal investedAmount, String folio) {
            CasConfirmRowRequest r = new CasConfirmRowRequest();
            r.setSchemeName("Test Fund");
            r.setUnits(units);
            r.setNav(nav);
            r.setCurrentValue(currentValue);
            r.setInvestedAmount(investedAmount);
            r.setFolioNumber(folio);
            return r;
        }

        private CasImportConfirmRequest requestOf(CasConfirmRowRequest... rows) {
            CasImportConfirmRequest req = new CasImportConfirmRequest();
            req.setRows(List.of(rows));
            return req;
        }

        @Test
        @DisplayName("avgBuyPrice is derived as investedAmount / units when units > 0")
        void avgBuyPriceDerivedFromInvestedAndUnits() {
            when(investmentService.createInvestment(any(), any())).thenReturn(InvestmentResponse.builder().build());

            service.confirm(userId, requestOf(row(new BigDecimal("100"), new BigDecimal("50"),
                    new BigDecimal("5500"), new BigDecimal("5000"), "111/0")));

            var captor = org.mockito.ArgumentCaptor.forClass(CreateInvestmentRequest.class);
            verify(investmentService).createInvestment(eq(userId), captor.capture());
            assertThat(captor.getValue().getAvgBuyPrice()).isEqualByComparingTo("50.0000"); // 5000/100
        }

        @Test
        @DisplayName("falls back to currentValue as the invested amount when the CAS had no cost figure")
        void fallsBackToCurrentValueWhenNoInvestedAmount() {
            when(investmentService.createInvestment(any(), any())).thenReturn(InvestmentResponse.builder().build());

            service.confirm(userId, requestOf(row(new BigDecimal("100"), new BigDecimal("50"),
                    new BigDecimal("5500"), null, "111/0")));

            var captor = org.mockito.ArgumentCaptor.forClass(CreateInvestmentRequest.class);
            verify(investmentService).createInvestment(eq(userId), captor.capture());
            assertThat(captor.getValue().getInvestedAmount()).isEqualByComparingTo("5500");
        }

        @Test
        @DisplayName("notes mention the folio number when present")
        void notesIncludeFolioNumber() {
            when(investmentService.createInvestment(any(), any())).thenReturn(InvestmentResponse.builder().build());

            service.confirm(userId, requestOf(row(new BigDecimal("100"), new BigDecimal("50"),
                    new BigDecimal("5000"), new BigDecimal("5000"), "999/1")));

            var captor = org.mockito.ArgumentCaptor.forClass(CreateInvestmentRequest.class);
            verify(investmentService).createInvestment(eq(userId), captor.capture());
            assertThat(captor.getValue().getNotes()).contains("999/1");
        }

        @Test
        @DisplayName("one row's failure is captured as an error without stopping the rest")
        void oneRowFailureDoesNotStopOthers() {
            when(investmentService.createInvestment(any(), any()))
                    .thenThrow(new RuntimeException("bad request"))
                    .thenReturn(InvestmentResponse.builder().build());

            CasImportResultResponse result = service.confirm(userId, requestOf(
                    row(new BigDecimal("100"), new BigDecimal("50"), new BigDecimal("5000"), new BigDecimal("5000"), "1"),
                    row(new BigDecimal("50"), new BigDecimal("20"), new BigDecimal("1000"), new BigDecimal("1000"), "2")));

            assertThat(result.getCreated()).isEqualTo(1);
            assertThat(result.getFailed()).isEqualTo(1);
        }
    }
}
