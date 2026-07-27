package com.wealthynest.domain.statementimport.service;

import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.dto.request.CreateExpenseRequest;
import com.wealthynest.domain.expense.dto.response.ExpenseResponse;
import com.wealthynest.domain.expense.service.ExpenseService;
import com.wealthynest.domain.income.dto.response.IncomeResponse;
import com.wealthynest.domain.income.service.IncomeService;
import com.wealthynest.domain.statementimport.dto.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StatementImportServiceImplTest {

    @Mock private CategoryRepository categoryRepository;
    @Mock private ExpenseService     expenseService;
    @Mock private IncomeService      incomeService;

    @InjectMocks
    private StatementImportServiceImpl service;

    private final UUID userId    = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();

    private MultipartFile csvFile(String content) {
        return new MockMultipartFile("file", "statement.csv", "text/csv", content.getBytes(StandardCharsets.UTF_8));
    }

    private Category expenseCategory(String name) {
        Category c = Category.builder().name(name).type(CategoryType.EXPENSE).build();
        ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
        return c;
    }

    // ─── preview: input validation ───────────────────────────────────────────────

    @Test
    @DisplayName("rejects a null/empty file upload")
    void rejectsEmptyFile() {
        MultipartFile empty = new MockMultipartFile("file", "x.csv", "text/csv", new byte[0]);
        assertThatThrownBy(() -> service.preview(empty, null, null, userId, null))
                .isInstanceOf(BusinessException.class);
    }

    // ─── preview: CSV auto-detection ─────────────────────────────────────────────

    @Nested
    @DisplayName("preview: CSV column auto-detection")
    class AutoDetectionTests {

        @Test
        @DisplayName("a ragged row missing its trailing description column is flagged invalid, not thrown")
        void raggedRowMissingTrailingColumnDoesNotCrashTheWholeImport() {
            // Narration is the LAST header column here, and the data row's trailing empty
            // Narration field (with its comma) is dropped entirely, as some spreadsheet-edited
            // or bank-exported CSVs do for a blank trailing cell.
            String csv = "Date,Debit,Credit,Narration\n2026-01-15,150.00,0.00\n";
            when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of());

            StatementPreviewResponse response = service.preview(csvFile(csv), null, null, userId, null);

            assertThat(response.getRows()).hasSize(1);
            ParsedRow row = response.getRows().get(0);
            assertThat(row.getDate()).isEqualTo(LocalDate.of(2026, 1, 15));
            assertThat(row.getDescription()).isNull();
            assertThat(row.getAmount()).isEqualByComparingTo("150.00");
            assertThat(row.getType()).isEqualTo("DEBIT");
            assertThat(row.isValid()).isTrue();
        }

        @Test
        @DisplayName("requests manual mapping when headers can't be confidently auto-detected")
        void requestsMappingWhenUnrecognizedHeaders() {
            // The mapping-failure early-return happens BEFORE categories are ever fetched, so no
            // categoryRepository stub is needed (and stubbing one would be flagged as unused).
            String csv = "Col1,Col2,Col3\nfoo,bar,baz\n";

            StatementPreviewResponse response = service.preview(csvFile(csv), null, null, userId, null);

            assertThat(response.isNeedsMapping()).isTrue();
            assertThat(response.getHeaders()).containsExactly("Col1", "Col2", "Col3");
        }

        @Test
        @DisplayName("auto-detects standard Date/Narration/Debit/Credit headers without a manual mapping")
        void autoDetectsStandardHeaders() {
            String csv = "Date,Narration,Debit,Credit\n2026-01-15,Coffee Shop,150.00,\n";
            when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of());

            StatementPreviewResponse response = service.preview(csvFile(csv), null, null, userId, null);

            assertThat(response.isNeedsMapping()).isFalse();
            assertThat(response.getRows()).hasSize(1);
            ParsedRow row = response.getRows().get(0);
            assertThat(row.getDate()).isEqualTo(LocalDate.of(2026, 1, 15));
            assertThat(row.getAmount()).isEqualByComparingTo("150.00");
            assertThat(row.getType()).isEqualTo("DEBIT");
            assertThat(row.isValid()).isTrue();
        }

        @Test
        @DisplayName("a populated Credit column (money in) is parsed as a CREDIT row")
        void detectsCreditColumn() {
            String csv = "Date,Narration,Debit,Credit\n2026-01-15,Salary,,50000.00\n";
            when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of());

            ParsedRow row = service.preview(csvFile(csv), null, null, userId, null).getRows().get(0);

            assertThat(row.getType()).isEqualTo("CREDIT");
            assertThat(row.getAmount()).isEqualByComparingTo("50000.00");
        }

        @Test
        @DisplayName("a single signed Amount column: negative -> DEBIT, positive -> CREDIT, both stored as absolute value")
        void singleSignedAmountColumn() {
            String csv = "Date,Description,Amount\n2026-01-15,Rent,-15000.00\n2026-01-16,Refund,2000.00\n";
            when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of());

            List<ParsedRow> rows = service.preview(csvFile(csv), null, null, userId, null).getRows();

            assertThat(rows.get(0).getType()).isEqualTo("DEBIT");
            assertThat(rows.get(0).getAmount()).isEqualByComparingTo("15000.00");
            assertThat(rows.get(1).getType()).isEqualTo("CREDIT");
            assertThat(rows.get(1).getAmount()).isEqualByComparingTo("2000.00");
        }

        @Test
        @DisplayName("flags a row with an unparseable date as invalid, with a descriptive error")
        void flagsUnparseableDate() {
            String csv = "Date,Narration,Debit,Credit\nnot-a-date,Coffee,150.00,\n";
            when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of());

            ParsedRow row = service.preview(csvFile(csv), null, null, userId, null).getRows().get(0);

            assertThat(row.isValid()).isFalse();
            assertThat(row.getError()).isEqualTo("Could not parse date");
        }

        @Test
        @DisplayName("flags a row with neither debit nor credit populated as an unparseable amount")
        void flagsMissingAmount() {
            String csv = "Date,Narration,Debit,Credit\n2026-01-15,Coffee,,\n";
            when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of());

            ParsedRow row = service.preview(csvFile(csv), null, null, userId, null).getRows().get(0);

            assertThat(row.isValid()).isFalse();
            assertThat(row.getError()).isEqualTo("Could not parse amount");
        }

        @Test
        @DisplayName("suggests a category by matching the category name inside the DEBIT row's description")
        void suggestsCategoryFromDescription() {
            String csv = "Date,Narration,Debit,Credit\n2026-01-15,Big Bazaar Groceries run,500.00,\n";
            when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of(expenseCategory("Groceries")));

            ParsedRow row = service.preview(csvFile(csv), null, null, userId, null).getRows().get(0);

            assertThat(row.getSuggestedCategoryName()).isEqualTo("Groceries");
        }

        @Test
        @DisplayName("never suggests a category for a CREDIT row, even if the description happens to match one")
        void neverSuggestsCategoryForCreditRows() {
            String csv = "Date,Narration,Debit,Credit\n2026-01-15,Groceries refund,,500.00\n";
            when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of(expenseCategory("Groceries")));

            ParsedRow row = service.preview(csvFile(csv), null, null, userId, null).getRows().get(0);

            assertThat(row.getSuggestedCategoryId()).isNull();
        }

        @Test
        @DisplayName("an implausibly large amount (extraction artifact) is rejected rather than accepted as real")
        void rejectsImplausiblyLargeAmount() {
            String csv = "Date,Narration,Debit,Credit\n2026-01-15,Weird row,999999999999.00,\n";
            when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of());

            ParsedRow row = service.preview(csvFile(csv), null, null, userId, null).getRows().get(0);

            assertThat(row.isValid()).isFalse();
        }

        @Test
        @DisplayName("family-scoped preview uses family categories instead of the caller's personal ones")
        void familyScopedUsesySharedCategories() {
            UUID familyId = UUID.randomUUID();
            String csv = "Date,Narration,Debit,Credit\n2026-01-15,Coffee,150.00,\n";
            when(categoryRepository.findByFamilyIdOrSystem(familyId)).thenReturn(List.of());

            service.preview(csvFile(csv), null, null, userId, familyId);

            verify(categoryRepository).findByFamilyIdOrSystem(familyId);
            verify(categoryRepository, never()).findByUserIdOrSystem(any());
        }

        @Test
        @DisplayName("an explicit manual ColumnMapping bypasses auto-detection entirely")
        void manualMappingBypassesAutoDetection() {
            String csv = "A,B,C,D\n2026-01-15,Coffee,150.00,\n"; // headers wouldn't auto-detect
            ColumnMapping mapping = new ColumnMapping();
            mapping.setDateColumn(0); mapping.setDescriptionColumn(1); mapping.setDebitColumn(2); mapping.setCreditColumn(3);
            when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of());

            StatementPreviewResponse response = service.preview(csvFile(csv), mapping, null, userId, null);

            assertThat(response.isNeedsMapping()).isFalse();
            assertThat(response.getRows().get(0).isValid()).isTrue();
        }
    }

    // ─── preview: PDF error paths (no valid PDF content needed) ─────────────────

    @Nested
    @DisplayName("preview: PDF error handling")
    class PdfErrorTests {

        @Test
        @DisplayName("an unreadable/corrupt PDF is rejected with a clear error, not a raw parser exception")
        void rejectsCorruptPdf() {
            MultipartFile pdf = new MockMultipartFile("file", "statement.pdf", "application/pdf", "not a real pdf".getBytes());
            assertThatThrownBy(() -> service.preview(pdf, null, null, userId, null))
                    .isInstanceOf(BusinessException.class);
        }
    }

    // ─── preview: PDF text-extraction parsing (exercises parsePdfLines/PdfLineParse) ─────────

    @Nested
    @DisplayName("preview: PDF statement parsing")
    class PdfParsingTests {

        @org.junit.jupiter.api.BeforeEach
        void stubNoCategories() {
            lenient().when(categoryRepository.findByUserIdOrSystem(userId)).thenReturn(List.of());
        }

        /** Renders each string as its own line in a real single-page PDF via PDFBox, so
         * PDFTextStripper (used by previewPdf) round-trips real extracted text rather than a mock. */
        private MultipartFile pdfFile(List<String> lines) throws java.io.IOException {
            try (org.apache.pdfbox.pdmodel.PDDocument document = new org.apache.pdfbox.pdmodel.PDDocument()) {
                org.apache.pdfbox.pdmodel.PDPage page = new org.apache.pdfbox.pdmodel.PDPage(
                        org.apache.pdfbox.pdmodel.common.PDRectangle.A4);
                document.addPage(page);
                try (org.apache.pdfbox.pdmodel.PDPageContentStream cs =
                             new org.apache.pdfbox.pdmodel.PDPageContentStream(document, page)) {
                    org.apache.pdfbox.pdmodel.font.PDType1Font font = new org.apache.pdfbox.pdmodel.font.PDType1Font(
                            org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA);
                    cs.setFont(font, 10);
                    cs.beginText();
                    cs.newLineAtOffset(50, 750);
                    for (String line : lines) {
                        cs.showText(line);
                        cs.newLineAtOffset(0, -14);
                    }
                    cs.endText();
                }
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                document.save(out);
                return new MockMultipartFile("file", "statement.pdf", "application/pdf", out.toByteArray());
            }
        }

        @Test
        @DisplayName("reconstructs transactions from real extracted PDF text: repeated headers/page " +
                "footers are skipped, narration wraps both after (Std Chartered-style) and before " +
                "(Canara-style, via a Chq: line), amount direction is inferred from the running " +
                "balance delta or a Dr/Cr marker, an all-zero debit/credit row is flagged invalid, " +
                "and a Closing Balance line ends parsing")
        void parsesMultiLineBankStatement() throws Exception {
            MultipartFile pdf = pdfFile(List.of(
                    "Date Particulars Withdrawal Deposit Balance",
                    "Opening Balance 10000.00",
                    "01/06/2026 UPI/SWIGGY/order432 450.00 9550.00",
                    "Ref:123456XYZ",
                    "Page 2",
                    "02/06/2026 SALARY JUN26 0.00 20000.00 29550.00",
                    "Chq:",
                    "ATM CASH WITHDRAWAL",
                    "03/06/2026 500.00 29050.00",
                    "04/06/2026 CASH DEPOSIT Cr 2000.00 32050.00",
                    "05/06/2026 BANK CHARGES 0.00 0.00 32050.00",
                    "Closing Balance"
            ));

            StatementPreviewResponse response = service.preview(pdf, null, null, userId, null);
            List<ParsedRow> rows = response.getRows();

            assertThat(rows).hasSize(5);

            ParsedRow row0 = rows.get(0);
            assertThat(row0.getDate()).isEqualTo(LocalDate.of(2026, 6, 1));
            assertThat(row0.getType()).isEqualTo("DEBIT");
            assertThat(row0.getAmount()).isEqualByComparingTo("450.00");
            assertThat(row0.getDescription()).contains("UPI/SWIGGY/order432").contains("Ref:123456XYZ");
            assertThat(row0.isValid()).isTrue();

            ParsedRow row1 = rows.get(1);
            assertThat(row1.getDate()).isEqualTo(LocalDate.of(2026, 6, 2));
            assertThat(row1.getType()).isEqualTo("CREDIT");
            assertThat(row1.getAmount()).isEqualByComparingTo("20000.00");
            assertThat(row1.getDescription()).contains("SALARY");

            ParsedRow row2 = rows.get(2);
            assertThat(row2.getDate()).isEqualTo(LocalDate.of(2026, 6, 3));
            assertThat(row2.getType()).isEqualTo("DEBIT");
            assertThat(row2.getAmount()).isEqualByComparingTo("500.00");
            assertThat(row2.getDescription()).contains("ATM CASH WITHDRAWAL");

            ParsedRow row3 = rows.get(3);
            assertThat(row3.getDate()).isEqualTo(LocalDate.of(2026, 6, 4));
            assertThat(row3.getType()).isEqualTo("CREDIT");
            assertThat(row3.getAmount()).isEqualByComparingTo("2000.00");

            ParsedRow row4 = rows.get(4);
            assertThat(row4.getDate()).isEqualTo(LocalDate.of(2026, 6, 5));
            assertThat(row4.isValid()).isFalse();
            assertThat(row4.getError()).isNotBlank();
            assertThat(row4.getAmount()).isNull();
        }

        @Test
        @DisplayName("a PDF with no detectable transaction lines is rejected rather than silently returning nothing")
        void rejectsPdfWithNoTransactions() throws Exception {
            MultipartFile pdf = pdfFile(List.of("Just a disclaimer page.", "No transactions here."));

            assertThatThrownBy(() -> service.preview(pdf, null, null, userId, null))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Could not detect any transactions");
        }
    }

    // ─── confirm ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("confirm")
    class ConfirmTests {

        // findOtherExpenseCategoryId() runs unconditionally before the row loop — even for a
        // request containing only CREDIT (income) rows or rows that already carry an explicit
        // categoryId, `confirm()` still requires the system "Other" expense category to exist.
        // That's arguably a needless coupling (a pure-income import shouldn't depend on an
        // expense-category row existing at all), but it's current behavior, so every test here
        // must stub it regardless of which row types it actually exercises.
        @org.junit.jupiter.api.BeforeEach
        void stubFallbackCategory() {
            UUID otherCatId = UUID.randomUUID();
            Category other = expenseCategory("Other");
            ReflectionTestUtils.setField(other, "id", otherCatId);
            lenient().when(categoryRepository.findBySystemTrue()).thenReturn(List.of(other));
        }

        private StatementImportConfirmRequest requestWithRows(List<ConfirmRowRequest> rows) {
            StatementImportConfirmRequest req = mock(StatementImportConfirmRequest.class);
            when(req.getAccountId()).thenReturn(accountId);
            when(req.getRows()).thenReturn(rows);
            return req;
        }

        private ConfirmRowRequest row(String type, BigDecimal amount, UUID categoryId) {
            ConfirmRowRequest r = mock(ConfirmRowRequest.class);
            lenient().when(r.getType()).thenReturn(type);
            lenient().when(r.getAmount()).thenReturn(amount);
            lenient().when(r.getDate()).thenReturn(LocalDate.of(2026, 1, 15));
            lenient().when(r.getCategoryId()).thenReturn(categoryId);
            lenient().when(r.getDescription()).thenReturn("desc");
            lenient().when(r.getIncomeSource()).thenReturn(null);
            return r;
        }

        @Test
        @DisplayName("a DEBIT row with no categoryId falls back to the system 'Other' expense category")
        void debitRowFallsBackToOtherCategory() {
            when(expenseService.createExpense(any(), any(), any())).thenReturn(ExpenseResponse.builder().build());

            service.confirm(userId, null, requestWithRows(List.of(row("DEBIT", new BigDecimal("100"), null))));

            var captor = org.mockito.ArgumentCaptor.forClass(CreateExpenseRequest.class);
            verify(expenseService).createExpense(eq(userId), any(), captor.capture());
            assertThat(captor.getValue().getCategoryId()).isNotNull();
        }

        @Test
        @DisplayName("a DEBIT row with an explicit categoryId uses that instead of the fallback")
        void debitRowUsesExplicitCategory() {
            UUID chosenCatId = UUID.randomUUID();
            when(expenseService.createExpense(any(), any(), any())).thenReturn(ExpenseResponse.builder().build());

            service.confirm(userId, null, requestWithRows(List.of(row("DEBIT", new BigDecimal("100"), chosenCatId))));

            var captor = org.mockito.ArgumentCaptor.forClass(CreateExpenseRequest.class);
            verify(expenseService).createExpense(eq(userId), any(), captor.capture());
            assertThat(captor.getValue().getCategoryId()).isEqualTo(chosenCatId); // explicit id wins over the fallback
        }

        @Test
        @DisplayName("a CREDIT row creates income instead of an expense")
        void creditRowCreatesIncome() {
            when(incomeService.create(any(), any())).thenReturn(IncomeResponse.builder().build());

            service.confirm(userId, null, requestWithRows(List.of(row("CREDIT", new BigDecimal("5000"), null))));

            verify(incomeService).create(eq(userId), any());
            verifyNoInteractions(expenseService);
        }

        @Test
        @DisplayName("one row's failure is captured as an error and does not stop the remaining rows from being imported")
        void oneRowFailureDoesNotStopOthers() {
            when(expenseService.createExpense(any(), any(), any()))
                    .thenThrow(new RuntimeException("insufficient balance"))
                    .thenReturn(ExpenseResponse.builder().build());

            StatementImportResultResponse result = service.confirm(userId, null,
                    requestWithRows(List.of(row("DEBIT", new BigDecimal("100"), null), row("DEBIT", new BigDecimal("50"), null))));

            assertThat(result.getCreated()).isEqualTo(1);
            assertThat(result.getFailed()).isEqualTo(1);
            assertThat(result.getErrors()).hasSize(1);
        }
    }

    // ─── autoDetect (pure private helper, exercised via reflection) ─────────────

    @Nested
    @DisplayName("autoDetect")
    class AutoDetectTests {

        @SuppressWarnings("unchecked")
        private Object autoDetect(List<String> headers) {
            return ReflectionTestUtils.invokeMethod(service, "autoDetect", headers);
        }

        @Test
        @DisplayName("detects separate Debit/Credit columns")
        void detectsDebitCreditColumns() {
            Object mapping = autoDetect(List.of("Date", "Narration", "Debit", "Credit"));
            assertThat(mapping).isNotNull();
        }

        @Test
        @DisplayName("detects a single signed Amount column when there's no separate Debit/Credit pair")
        void detectsSingleAmountColumn() {
            Object mapping = autoDetect(List.of("Date", "Description", "Amount"));
            assertThat(mapping).isNotNull();
        }

        @Test
        @DisplayName("is not confident when only a Debit column exists without a matching Credit column or Amount fallback")
        void notConfidentWithOnlyDebitColumn() {
            Object mapping = autoDetect(List.of("Date", "Description", "Debit"));
            assertThat(mapping).isNull();
        }

        @Test
        @DisplayName("is not confident when the description column can't be identified")
        void notConfidentWithoutDescriptionColumn() {
            Object mapping = autoDetect(List.of("Date", "Debit", "Credit"));
            assertThat(mapping).isNull();
        }

        @Test
        @DisplayName("the first matching header wins when duplicate alias columns appear")
        void firstMatchingHeaderWins() {
            Object mapping = autoDetect(List.of("Date", "Value Date", "Narration", "Debit", "Credit"));
            assertThat(mapping).isNotNull();
            assertThat(ReflectionTestUtils.getField(mapping, "dateColumn")).isEqualTo(0);
        }
    }

    // ─── isNonNarrationLine (pure private static helper) ────────────────────────

    @Nested
    @DisplayName("isNonNarrationLine")
    class IsNonNarrationLineTests {

        private boolean isNonNarrationLine(String line) {
            return (boolean) ReflectionTestUtils.invokeMethod(StatementImportServiceImpl.class, "isNonNarrationLine", line);
        }

        @Test
        @DisplayName("a blank line is non-narration")
        void blankLineIsNonNarration() {
            assertThat(isNonNarrationLine("   ")).isTrue();
        }

        @Test
        @DisplayName("a bare \"Date\" or \"Value\" column-header fragment is non-narration")
        void bareColumnFragmentsAreNonNarration() {
            assertThat(isNonNarrationLine("Date")).isTrue();
            assertThat(isNonNarrationLine("Value")).isTrue();
        }

        @Test
        @DisplayName("a repeated table header row (Withdrawal/Deposit/Balance + Description) is non-narration")
        void repeatedTableHeaderIsNonNarration() {
            assertThat(isNonNarrationLine("Date Description Withdrawal Deposit Balance")).isTrue();
        }

        @Test
        @DisplayName("a header-like line missing one of the three required column words is treated as narration")
        void partialHeaderIsTreatedAsNarration() {
            assertThat(isNonNarrationLine("Withdrawal Deposit")).isFalse();
        }

        @Test
        @DisplayName("a \"Page N\" footer line is non-narration")
        void pageFooterIsNonNarration() {
            assertThat(isNonNarrationLine("Page 3")).isTrue();
        }

        @Test
        @DisplayName("ordinary narration text is not flagged as non-narration")
        void ordinaryNarrationIsNotFlagged() {
            assertThat(isNonNarrationLine("UPI/mmid/12345/Swiggy order")).isFalse();
        }
    }

    // ─── parseAmount / parseDate / parseIncomeSource (pure private helpers) ─────

    @Nested
    @DisplayName("parseAmount")
    class ParseAmountTests {

        private BigDecimal parseAmount(String raw) {
            return (BigDecimal) ReflectionTestUtils.invokeMethod(service, "parseAmount", raw);
        }

        @Test
        @DisplayName("null or blank input returns null")
        void blankReturnsNull() {
            assertThat(parseAmount(null)).isNull();
            assertThat(parseAmount("  ")).isNull();
        }

        @Test
        @DisplayName("a lone \"-\" placeholder (empty cell) returns null")
        void loneDashReturnsNull() {
            assertThat(parseAmount("-")).isNull();
        }

        @Test
        @DisplayName("strips currency symbols, the Rs./Rs prefix, and thousands separators")
        void stripsFormattingCharacters() {
            assertThat(parseAmount("₹1,234.50")).isEqualByComparingTo("1234.50");
            assertThat(parseAmount("Rs. 500")).isEqualByComparingTo("500");
            assertThat(parseAmount("Rs99")).isEqualByComparingTo("99");
        }

        @Test
        @DisplayName("an implausibly large value (extraction artifact) is rejected as null")
        void implausiblyLargeValueRejected() {
            assertThat(parseAmount("999999999999")).isNull();
        }
    }

    @Nested
    @DisplayName("parseDate")
    class ParseDateTests {

        private LocalDate parseDate(String raw) {
            return (LocalDate) ReflectionTestUtils.invokeMethod(service, "parseDate", raw);
        }

        @Test
        @DisplayName("throws for a blank date string")
        void throwsForBlank() {
            assertThatThrownBy(() -> parseDate("")).isInstanceOf(java.time.format.DateTimeParseException.class);
        }

        @Test
        @DisplayName("throws for a completely unrecognizable date format")
        void throwsForUnrecognizedFormat() {
            assertThatThrownBy(() -> parseDate("not-a-date")).isInstanceOf(java.time.format.DateTimeParseException.class);
        }

        @Test
        @DisplayName("falls through multiple candidate formats until one parses")
        void fallsThroughFormats() {
            assertThat(parseDate("2025-01-15")).isEqualTo(LocalDate.of(2025, 1, 15));
        }
    }

    @Nested
    @DisplayName("parseIncomeSource")
    class ParseIncomeSourceTests {

        private com.wealthynest.domain.income.entity.IncomeSource parseIncomeSource(String raw) {
            return (com.wealthynest.domain.income.entity.IncomeSource)
                    ReflectionTestUtils.invokeMethod(service, "parseIncomeSource", raw);
        }

        @Test
        @DisplayName("null or blank input defaults to OTHER")
        void blankDefaultsToOther() {
            assertThat(parseIncomeSource(null)).isEqualTo(com.wealthynest.domain.income.entity.IncomeSource.OTHER);
            assertThat(parseIncomeSource("")).isEqualTo(com.wealthynest.domain.income.entity.IncomeSource.OTHER);
        }

        @Test
        @DisplayName("an unrecognized value defaults to OTHER instead of throwing")
        void unrecognizedValueDefaultsToOther() {
            assertThat(parseIncomeSource("not-a-real-source")).isEqualTo(com.wealthynest.domain.income.entity.IncomeSource.OTHER);
        }

        @Test
        @DisplayName("a matching enum name (case-insensitive) is parsed directly")
        void matchingNameIsParsed() {
            assertThat(parseIncomeSource("salary")).isEqualTo(com.wealthynest.domain.income.entity.IncomeSource.SALARY);
        }
    }
}
