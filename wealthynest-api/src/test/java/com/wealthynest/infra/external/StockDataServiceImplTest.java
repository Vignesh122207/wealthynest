package com.wealthynest.infra.external;

import com.wealthynest.domain.investment.entity.NseCorporateAction;
import com.wealthynest.domain.investment.entity.StockMaster;
import com.wealthynest.domain.investment.entity.StockPriceCache;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import com.wealthynest.domain.investment.repository.NseCorporateActionRepository;
import com.wealthynest.domain.investment.repository.StockMasterRepository;
import com.wealthynest.domain.investment.repository.StockPriceCacheRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("unchecked")
class StockDataServiceImplTest {

    @Mock private StockMasterRepository        stockMasterRepository;
    @Mock private StockPriceCacheRepository    stockPriceCacheRepository;
    @Mock private InvestmentRepository         investmentRepository;
    @Mock private NseCorporateActionRepository corpActionRepository;

    private RestClient nseClient;
    private RestClient.RequestHeadersSpec<?> headersSpec;
    private RestClient.ResponseSpec responseSpec;
    private StockDataServiceImpl service;

    @BeforeEach
    void setUp() {
        // RETURNS_DEEP_STUBS can't reliably deep-stub RequestHeadersSpec.header(String, String...)
        // (self-referential generic + varargs) — it silently returns null mid-chain. Wiring the
        // fluent chain by hand avoids that and gives every test the same get().uri(...).header(...)
        // .retrieve() path regardless of which uri()/header() overload the production code calls.
        nseClient = mock(RestClient.class);
        RestClient.RequestHeadersUriSpec<?> uriSpec = mock(RestClient.RequestHeadersUriSpec.class);
        headersSpec = mock(RestClient.RequestHeadersSpec.class);
        responseSpec = mock(RestClient.ResponseSpec.class);
        lenient().when(nseClient.get()).thenReturn((RestClient.RequestHeadersUriSpec) uriSpec);
        lenient().when(uriSpec.uri(anyString())).thenReturn((RestClient.RequestHeadersSpec) headersSpec);
        lenient().when(uriSpec.uri(anyString(), any(Object[].class))).thenReturn((RestClient.RequestHeadersSpec) headersSpec);
        lenient().when(headersSpec.header(anyString(), any(String[].class))).thenReturn((RestClient.RequestHeadersSpec) headersSpec);
        lenient().when(headersSpec.retrieve()).thenReturn(responseSpec);

        service = new StockDataServiceImpl(stockMasterRepository, stockPriceCacheRepository,
                investmentRepository, corpActionRepository, nseClient);
    }

    private byte[] zipOf(String entryName, String content) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            zos.putNextEntry(new ZipEntry(entryName));
            zos.write(content.getBytes());
            zos.closeEntry();
        }
        return baos.toByteArray();
    }

    // ─── refreshNSEMaster ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("refreshNSEMaster")
    class RefreshNseMasterTests {

        @Test
        @DisplayName("returns 0 when the CSV response is empty")
        void returnsZeroOnEmptyCsv() {
            when(responseSpec.body(String.class)).thenReturn("");

            assertThat(service.refreshNSEMaster()).isEqualTo(0);
            verifyNoInteractions(stockMasterRepository);
        }

        @Test
        @DisplayName("upserts new symbols and updates existing ones from the equity CSV")
        void upsertsFromCsv() {
            String csv = "SYMBOL,NAME OF COMPANY,SERIES,DATE OF LISTING,PAID UP VALUE,MARKET LOT,ISIN NUMBER,FACE VALUE\n"
                    + "TCS,Tata Consultancy Services Ltd,EQ,01-01-2000,1,1,INE467B01029,1\n"
                    + "INFY,Infosys Ltd,EQ,01-01-2000,1,1,INE009A01021,1\n";
            when(responseSpec.body(String.class)).thenReturn(csv);
            StockMaster existingTcs = StockMaster.builder().symbol("TCS").companyName("Old Name").exchange("NSE").build();
            when(stockMasterRepository.findBySymbolAndExchange("TCS", "NSE")).thenReturn(Optional.of(existingTcs));
            when(stockMasterRepository.findBySymbolAndExchange("INFY", "NSE")).thenReturn(Optional.empty());

            int saved = service.refreshNSEMaster();

            assertThat(saved).isEqualTo(2);
            verify(stockMasterRepository).save(existingTcs);
            assertThat(existingTcs.getCompanyName()).isEqualTo("Tata Consultancy Services Ltd");
            ArgumentCaptor<StockMaster> newCaptor = ArgumentCaptor.forClass(StockMaster.class);
            verify(stockMasterRepository, times(2)).save(newCaptor.capture());
            assertThat(newCaptor.getAllValues()).extracting(StockMaster::getSymbol).contains("INFY");
        }

        @Test
        @DisplayName("returns 0 when the request throws")
        void returnsZeroOnException() {
            when(responseSpec.body(String.class)).thenThrow(new RuntimeException("NSE unreachable"));

            assertThat(service.refreshNSEMaster()).isEqualTo(0);
        }
    }

    // ─── updateEODPrices ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateEODPrices")
    class UpdateEodPricesTests {

        @Test
        @DisplayName("returns 0 when the bhavcopy zip is null or too small")
        void returnsZeroWhenZipTooSmall() {
            when(responseSpec.body(byte[].class)).thenReturn(new byte[10]);

            assertThat(service.updateEODPrices(LocalDate.of(2025, 1, 15))).isEqualTo(0);
        }

        @Test
        @DisplayName("parses EQ-series rows, computes day change against the existing cache, and syncs investments")
        void parsesAndUpdatesCache() throws Exception {
            String csv = "TckrSymb,SctySrs,ClsPric,ISIN\n"
                    + "TCS,EQ,3500.50,INE467B01029\n"
                    + "TCSPP,BE,100.00,INE999X99999\n" // non-EQ series -> skipped
                    + "INFY,EQ,1800.00,INE009A01021\n";
            byte[] zip = zipOf("bhavcopy.csv", csv);
            // Pad to pass the >=1000 byte size guard
            byte[] padded = java.util.Arrays.copyOf(zip, Math.max(zip.length, 1100));
            when(responseSpec.body(byte[].class)).thenReturn(padded);
            when(stockMasterRepository.findAltSymbolsByIsin(any(), any())).thenReturn(List.of());
            StockPriceCache existingTcs = StockPriceCache.builder().symbol("TCS").exchange("NSE")
                    .currentPrice(new java.math.BigDecimal("3400.00")).build();
            when(stockPriceCacheRepository.findAll()).thenReturn(List.of(existingTcs));
            when(investmentRepository.syncStockCurrentValuesFromCache()).thenReturn(5);

            int count = service.updateEODPrices(LocalDate.of(2025, 1, 15));

            assertThat(count).isEqualTo(2); // TCS + INFY, TCSPP (BE series) excluded
            ArgumentCaptor<List<StockPriceCache>> captor = ArgumentCaptor.forClass(List.class);
            verify(stockPriceCacheRepository).saveAll(captor.capture());
            StockPriceCache tcsSaved = captor.getValue().stream()
                    .filter(c -> c.getSymbol().equals("TCS")).findFirst().orElseThrow();
            assertThat(tcsSaved.getCurrentPrice()).isEqualByComparingTo("3500.50");
            assertThat(tcsSaved.getPreviousClose()).isEqualByComparingTo("3400.00");
            assertThat(tcsSaved.getDayChange()).isEqualByComparingTo("100.50");
            verify(investmentRepository).syncStockCurrentValuesFromCache();
        }

        @Test
        @DisplayName("returns 0 when the bhavcopy zip has no recognisable header columns")
        void returnsZeroWhenHeaderUnrecognised() throws Exception {
            String csv = "SOME,OTHER,HEADER\nfoo,bar,baz\n";
            byte[] zip = zipOf("bhavcopy.csv", csv);
            byte[] padded = java.util.Arrays.copyOf(zip, Math.max(zip.length, 1100));
            when(responseSpec.body(byte[].class)).thenReturn(padded);

            assertThat(service.updateEODPrices(LocalDate.of(2025, 1, 15))).isEqualTo(0);
            verify(stockPriceCacheRepository, never()).saveAll(any());
        }

        @Test
        @DisplayName("returns 0 when the request throws")
        void returnsZeroOnException() {
            when(responseSpec.body(byte[].class)).thenThrow(new RuntimeException("timeout"));

            assertThat(service.updateEODPrices(LocalDate.of(2025, 1, 15))).isEqualTo(0);
        }
    }

    // ─── refreshCorporateActions ────────────────────────────────────────────────

    @Nested
    @DisplayName("refreshCorporateActions")
    class RefreshCorporateActionsTests {

        @Test
        @DisplayName("returns 0 when the response is HTML (session-gated) instead of CSV")
        void returnsZeroOnHtmlResponse() {
            when(responseSpec.body(String.class)).thenReturn("<html>blocked</html>");

            assertThat(service.refreshCorporateActions()).isEqualTo(0);
        }

        @Test
        @DisplayName("parses dividend rows, extracts the per-share amount, and dedups against existing rows")
        void parsesAndDedupsDividendRows() {
            String csv = "Symbol,Ex-Date,Purpose\n"
                    + "TCS,15-Jan-2025,Annual Dividend- Rs 10 Per Share\n"
                    + "INFY,20-Jan-2025,Bonus Issue\n" // not a dividend -> skipped
                    + "WIPRO,25-Jan-2025,Interim Dividend- Rs.5.50 Per Share\n";
            when(responseSpec.body(String.class)).thenReturn(csv);
            when(corpActionRepository.existsBySymbolAndActionTypeAndExDate("TCS", "DIVIDEND", LocalDate.of(2025, 1, 15)))
                    .thenReturn(false);
            when(corpActionRepository.existsBySymbolAndActionTypeAndExDate("WIPRO", "DIVIDEND", LocalDate.of(2025, 1, 25)))
                    .thenReturn(true); // already exists -> skipped

            int count = service.refreshCorporateActions();

            assertThat(count).isEqualTo(1);
            ArgumentCaptor<NseCorporateAction> captor = ArgumentCaptor.forClass(NseCorporateAction.class);
            verify(corpActionRepository, times(1)).save(captor.capture());
            assertThat(captor.getValue().getSymbol()).isEqualTo("TCS");
            assertThat(captor.getValue().getDividendPerShare()).isEqualByComparingTo("10");
        }

        @Test
        @DisplayName("returns 0 when the request throws")
        void returnsZeroOnException() {
            when(responseSpec.body(String.class)).thenThrow(new RuntimeException("blocked"));

            assertThat(service.refreshCorporateActions()).isEqualTo(0);
        }
    }

    // ─── refreshDailyCorporateActions ───────────────────────────────────────────

    @Nested
    @DisplayName("refreshDailyCorporateActions")
    class RefreshDailyCorporateActionsTests {

        @Test
        @DisplayName("parses the symbol-first daily CA format")
        void parsesSymbolFirstFormat() {
            String csv = "Symbol,Ex Date,Purpose,Record Date\n"
                    + "TCS,15-01-2025,Dividend- Rs 8 Per Share,16-01-2025\n";
            when(responseSpec.body(String.class)).thenReturn(csv);
            when(corpActionRepository.existsBySymbolAndActionTypeAndExDate(any(), any(), any())).thenReturn(false);

            int count = service.refreshDailyCorporateActions(LocalDate.of(2025, 1, 15));

            assertThat(count).isEqualTo(1);
            ArgumentCaptor<NseCorporateAction> captor = ArgumentCaptor.forClass(NseCorporateAction.class);
            verify(corpActionRepository).save(captor.capture());
            assertThat(captor.getValue().getSymbol()).isEqualTo("TCS");
            assertThat(captor.getValue().getDividendPerShare()).isEqualByComparingTo("8");
        }

        @Test
        @DisplayName("parses the company-name-first daily CA format")
        void parsesCompanyNameFirstFormat() {
            String csv = "\"Company Name\",\"Symbol\",\"Ex Date\",\"Purpose\",\"Record Date\"\n"
                    + "\"Tata Consultancy Services\",\"TCS\",\"15-01-2025\",\"Dividend- Rs 8 Per Share\",\"16-01-2025\"\n";
            when(responseSpec.body(String.class)).thenReturn(csv);
            when(corpActionRepository.existsBySymbolAndActionTypeAndExDate(any(), any(), any())).thenReturn(false);

            int count = service.refreshDailyCorporateActions(LocalDate.of(2025, 1, 15));

            assertThat(count).isEqualTo(1);
            ArgumentCaptor<NseCorporateAction> captor = ArgumentCaptor.forClass(NseCorporateAction.class);
            verify(corpActionRepository).save(captor.capture());
            assertThat(captor.getValue().getSymbol()).isEqualTo("TCS");
        }

        @Test
        @DisplayName("returns 0 when the daily CA file is not yet published (empty/HTML response)")
        void returnsZeroWhenNotPublished() {
            when(responseSpec.body(String.class)).thenReturn(null);

            assertThat(service.refreshDailyCorporateActions(LocalDate.of(2025, 1, 15))).isEqualTo(0);
        }

        @Test
        @DisplayName("returns 0 when the request throws")
        void returnsZeroOnException() {
            when(responseSpec.body(String.class)).thenThrow(new RuntimeException("not found"));

            assertThat(service.refreshDailyCorporateActions(LocalDate.of(2025, 1, 15))).isEqualTo(0);
        }
    }

    // ─── parseBSEBhavcopy (pure parsing helper, exercised via reflection) ───────

    @Nested
    @DisplayName("parseBSEBhavcopy")
    class ParseBseBhavcopyTests {

        @Test
        @DisplayName("parses SC_CODE/SC_NAME/ISIN_CODE columns from a bhavcopy CSV inside a zip")
        void parsesBhavcopyZip() throws Exception {
            String csv = "SC_CODE,SC_NAME,SC_GROUP,ISIN_CODE\n"
                    + "500325,Reliance Industries,A,INE002A01018\n";
            byte[] zip = zipOf("EQ.csv", csv);

            java.util.Map<String, StockMaster> result =
                    (java.util.Map<String, StockMaster>) ReflectionTestUtils.invokeMethod(service, "parseBSEBhavcopy", (Object) zip);

            assertThat(result).containsKey("Reliance Industries");
            assertThat(result.get("Reliance Industries").getIsin()).isEqualTo("INE002A01018");
            assertThat(result.get("Reliance Industries").getExchange()).isEqualTo("BSE");
        }

        @Test
        @DisplayName("returns an empty map when the header has no SC_CODE/SC_NAME columns")
        void emptyWhenHeaderUnrecognised() throws Exception {
            byte[] zip = zipOf("EQ.csv", "FOO,BAR\n1,2\n");

            java.util.Map<String, StockMaster> result =
                    (java.util.Map<String, StockMaster>) ReflectionTestUtils.invokeMethod(service, "parseBSEBhavcopy", (Object) zip);

            assertThat(result).isEmpty();
        }
    }
}
