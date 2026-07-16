package com.wealthynest.domain.statementimport.service;

import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.dto.request.CreateExpenseRequest;
import com.wealthynest.domain.expense.service.ExpenseService;
import com.wealthynest.domain.income.dto.request.CreateIncomeRequest;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.income.service.IncomeService;
import com.wealthynest.domain.statementimport.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatementImportServiceImpl implements StatementImportService {

    private static final Set<String> DATE_ALIASES = Set.of(
            "date", "txndate", "transactiondate", "valuedate", "postingdate");
    private static final Set<String> DESCRIPTION_ALIASES = Set.of(
            "narration", "description", "particulars", "details", "transactiondetails", "remarks");
    private static final Set<String> DEBIT_ALIASES = Set.of(
            "debit", "withdrawal", "withdrawalamt", "withdrawalamount", "debitamount", "dr");
    private static final Set<String> CREDIT_ALIASES = Set.of(
            "credit", "deposit", "depositamt", "depositamount", "creditamount", "cr");
    private static final Set<String> AMOUNT_ALIASES = Set.of("amount", "amt", "transactionamount");

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("d-MMM-yy"),
            DateTimeFormatter.ofPattern("d-MMM-yyyy"),
            DateTimeFormatter.ofPattern("dd MMM yyyy"),
            DateTimeFormatter.ofPattern("dd MMM yy"));

    // ─── PDF parsing (text-extraction, no fixed column layout) ────────────────────
    // Bank statement PDFs lose their table structure once text is extracted — each transaction
    // line is matched by a leading date, then the trailing 2-3 whitespace-delimited numeric
    // tokens are treated as [withdrawal, deposit, balance] (or [amount, balance] with a Dr/Cr
    // marker) since that's the near-universal layout across Indian bank PDF exports. Lines with
    // no leading date (letterhead, disclaimers, column headers repeated per page, page numbers)
    // are silently skipped rather than surfaced as invalid rows.
    private static final Pattern PDF_LEADING_DATE = Pattern.compile(
            "^(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{1,2}[-\\s][A-Za-z]{3}[-\\s]\\d{2,4})\\s+(.*)$");
    private static final Pattern PDF_AMOUNT_TOKEN = Pattern.compile("-?[\\d,]+\\.\\d{1,2}");
    private static final Pattern PDF_DRCR_MARKER = Pattern.compile("(?i)\\b(dr|cr)\\b");
    private static final Pattern PDF_PAGE_FOOTER = Pattern.compile("(?i)\\bpage\\s+\\d+\\b");
    private static final Pattern PDF_STATEMENT_END = Pattern.compile("(?i)^(Total\\b.*\\d+\\.\\d{2}|Closing Balance\\b)");
    // Canara-style statements print a standalone "Chq: <number|blank>" line right after a
    // transaction's amount — it's the one reliable signal that the transaction is fully closed
    // out, used to flip narration-attribution from "trailing text belongs to the row just
    // completed" (the default — correct for banks whose narration wraps *after* the date+amount)
    // to "upcoming text belongs to the next row" (correct for banks like Canara whose narration
    // wraps *before* the date, so text between one transaction's Chq: line and the next date is
    // unambiguously that next transaction's narration).
    private static final Pattern PDF_CHQ_LINE = Pattern.compile("(?i)^Chq\\s*:\\s*\\S*$");
    private static final BigDecimal MAX_PLAUSIBLE_AMOUNT = new BigDecimal("100000000"); // ₹10 crore

    private final CategoryRepository categoryRepository;
    private final ExpenseService     expenseService;
    private final IncomeService      incomeService;

    @Override
    public StatementPreviewResponse preview(MultipartFile file, ColumnMapping mapping, String password, UUID userId, UUID familyId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Please choose a CSV or PDF file to import.", HttpStatus.BAD_REQUEST);
        }
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        boolean isPdf = filename.endsWith(".pdf") || MediaType.APPLICATION_PDF_VALUE.equals(file.getContentType());
        return isPdf ? previewPdf(file, password, userId, familyId) : previewCsv(file, mapping, userId, familyId);
    }

    private StatementPreviewResponse previewCsv(MultipartFile file, ColumnMapping mapping, UUID userId, UUID familyId) {
        try (CSVParser parser = CSVParser.parse(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8),
                CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setTrim(true).build())) {

            List<String> headers = parser.getHeaderNames();
            List<CSVRecord> records = parser.getRecords();

            ColumnMapping effective = mapping != null ? mapping : autoDetect(headers);
            if (effective == null) {
                List<List<String>> sample = records.stream().limit(5)
                        .map(r -> headers.stream().map(r::get).toList()).toList();
                return StatementPreviewResponse.builder()
                        .needsMapping(true).headers(headers).sampleRows(sample).rows(List.of()).build();
            }

            List<Category> categories = familyId != null
                    ? categoryRepository.findByFamilyIdOrSystem(familyId)
                    : categoryRepository.findByUserIdOrSystem(userId);
            List<Category> expenseCategories = categories.stream()
                    .filter(c -> c.getType() == CategoryType.EXPENSE).toList();

            List<ParsedRow> rows = new ArrayList<>();
            int idx = 0;
            for (CSVRecord r : records) {
                rows.add(parseRow(r, idx++, effective, headers, expenseCategories));
            }
            return StatementPreviewResponse.builder().needsMapping(false).rows(rows).build();
        } catch (IOException e) {
            throw new BusinessException("Could not read the CSV file — is it a valid CSV export?", HttpStatus.BAD_REQUEST);
        }
    }

    private StatementPreviewResponse previewPdf(MultipartFile file, String password, UUID userId, UUID familyId) {
        String text;
        try (PDDocument document = Loader.loadPDF(file.getBytes(), password != null ? password : "")) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            text = stripper.getText(document);
        } catch (InvalidPasswordException e) {
            return StatementPreviewResponse.builder().needsPassword(true).rows(List.of()).build();
        } catch (IOException e) {
            throw new BusinessException("Could not read the PDF file — is it a valid bank statement?", HttpStatus.BAD_REQUEST);
        }

        List<Category> categories = familyId != null
                ? categoryRepository.findByFamilyIdOrSystem(familyId)
                : categoryRepository.findByUserIdOrSystem(userId);
        List<Category> expenseCategories = categories.stream()
                .filter(c -> c.getType() == CategoryType.EXPENSE).toList();

        // Two passes: first walk the extracted lines with a small state machine that copes with
        // narration wrapping in either direction (see parsePdfLines' doc comment), then run
        // category suggestion once each row's full narration is known rather than off a partial
        // first-line fragment.
        List<PdfLineParse> raw = parsePdfLines(text);
        if (raw.isEmpty()) {
            throw new BusinessException(
                    "Could not detect any transactions in this PDF. Try exporting a CSV statement instead.",
                    HttpStatus.BAD_REQUEST);
        }
        List<ParsedRow> rows = new ArrayList<>();
        for (PdfLineParse r : raw) {
            String description = r.description().isBlank() ? null : r.description().toString();
            rows.add(buildParsedRow(rows.size(), r.date(), description, r.amount(), r.type(), r.error(), expenseCategories));
        }
        return StatementPreviewResponse.builder().needsMapping(false).rows(rows).build();
    }

    @Override
    @Transactional
    public StatementImportResultResponse confirm(UUID userId, UUID familyId, StatementImportConfirmRequest request) {
        // Category is a nice-to-have at import time, not a gate — with 100+ rows on a real bank
        // statement, forcing every one to be hand-categorized before anything can be saved is a
        // worse outcome than landing them under the system "Other" bucket and letting the user
        // recategorize at their own pace from the regular expense list.
        UUID fallbackCategoryId = findOtherExpenseCategoryId();
        int created = 0;
        List<String> errors = new ArrayList<>();
        for (ConfirmRowRequest row : request.getRows()) {
            try {
                if ("CREDIT".equalsIgnoreCase(row.getType())) {
                    CreateIncomeRequest income = new CreateIncomeRequest();
                    income.setAccountId(request.getAccountId());
                    income.setSource(parseIncomeSource(row.getIncomeSource()));
                    income.setAmount(row.getAmount());
                    income.setDescription(row.getDescription());
                    income.setIncomeDate(row.getDate());
                    income.setPeriodMonth(row.getDate().getMonthValue());
                    income.setPeriodYear(row.getDate().getYear());
                    incomeService.create(userId, income);
                } else {
                    CreateExpenseRequest expense = new CreateExpenseRequest();
                    expense.setCategoryId(row.getCategoryId() != null ? row.getCategoryId() : fallbackCategoryId);
                    expense.setAccountId(request.getAccountId());
                    expense.setAmount(row.getAmount());
                    expense.setDescription(row.getDescription());
                    expense.setExpenseDate(row.getDate());
                    expenseService.createExpense(userId, familyId, expense);
                }
                created++;
            } catch (Exception e) {
                errors.add(String.format("Row dated %s (%s): %s", row.getDate(),
                        row.getDescription() != null ? row.getDescription() : "—", e.getMessage()));
            }
        }
        return StatementImportResultResponse.builder()
                .created(created).failed(errors.size()).errors(errors).build();
    }

    private UUID findOtherExpenseCategoryId() {
        return categoryRepository.findBySystemTrue().stream()
                .filter(c -> c.getType() == CategoryType.EXPENSE && "Other".equalsIgnoreCase(c.getName()))
                .map(Category::getId)
                .findFirst()
                .orElseThrow(() -> new BusinessException("No default expense category available.", HttpStatus.INTERNAL_SERVER_ERROR));
    }

    // ─── CSV parsing helpers ────────────────────────────────────────────────────

    private ColumnMapping autoDetect(List<String> headers) {
        Integer dateCol = null, descCol = null, debitCol = null, creditCol = null, amountCol = null;
        for (int i = 0; i < headers.size(); i++) {
            String n = normalize(headers.get(i));
            if (dateCol == null && DATE_ALIASES.contains(n)) dateCol = i;
            else if (descCol == null && DESCRIPTION_ALIASES.contains(n)) descCol = i;
            else if (debitCol == null && DEBIT_ALIASES.contains(n)) debitCol = i;
            else if (creditCol == null && CREDIT_ALIASES.contains(n)) creditCol = i;
            else if (amountCol == null && AMOUNT_ALIASES.contains(n)) amountCol = i;
        }
        boolean confident = dateCol != null && descCol != null && ((debitCol != null && creditCol != null) || amountCol != null);
        if (!confident) return null;
        ColumnMapping m = new ColumnMapping();
        m.setDateColumn(dateCol); m.setDescriptionColumn(descCol);
        m.setDebitColumn(debitCol); m.setCreditColumn(creditCol); m.setAmountColumn(amountCol);
        return m;
    }

    private static String normalize(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private ParsedRow parseRow(CSVRecord r, int rowIndex, ColumnMapping m, List<String> headers, List<Category> expenseCategories) {
        String description = m.getDescriptionColumn() != null && m.getDescriptionColumn() < headers.size()
                ? r.get(m.getDescriptionColumn()) : null;

        LocalDate date = null;
        try {
            date = parseDate(r.get(m.getDateColumn()));
        } catch (Exception ignored) { /* falls through to the null-date validation error below */ }

        BigDecimal amount = null;
        String type = null;
        try {
            if (m.getDebitColumn() != null && m.getCreditColumn() != null) {
                BigDecimal debit  = parseAmount(safeGet(r, m.getDebitColumn()));
                BigDecimal credit = parseAmount(safeGet(r, m.getCreditColumn()));
                if (debit != null && debit.compareTo(BigDecimal.ZERO) > 0) { amount = debit; type = "DEBIT"; }
                else if (credit != null && credit.compareTo(BigDecimal.ZERO) > 0) { amount = credit; type = "CREDIT"; }
            } else if (m.getAmountColumn() != null) {
                BigDecimal raw = parseAmount(safeGet(r, m.getAmountColumn()));
                if (raw != null) {
                    type = raw.compareTo(BigDecimal.ZERO) < 0 ? "DEBIT" : "CREDIT";
                    amount = raw.abs();
                }
            }
        } catch (Exception ignored) { /* falls through to the null-amount validation error below */ }

        String error = date == null ? "Could not parse date"
                : (amount == null || type == null) ? "Could not parse amount"
                : null;

        return buildParsedRow(rowIndex, date, description, amount, type, error, expenseCategories);
    }

    private String safeGet(CSVRecord r, int col) {
        return col < r.size() ? r.get(col) : null;
    }

    // ─── PDF parsing helpers ────────────────────────────────────────────────────

    /** A transaction's raw parsed fields, before category suggestion runs. {@code description}
     * is mutable so narration fragments folded in from other physical lines can be appended
     * before the final {@link ParsedRow} is built. {@code balance} is the running balance printed
     * on this row, so the caller can carry it forward as {@code previousBalance} for the next. */
    private static final class PdfLineParse {
        private final LocalDate   date;
        private final StringBuilder description;
        private final BigDecimal  amount;
        private final String      type;
        private final String      error;
        private final BigDecimal  balance;

        PdfLineParse(LocalDate date, String description, BigDecimal amount, String type, String error, BigDecimal balance) {
            this.date = date;
            this.description = new StringBuilder(description == null ? "" : description);
            this.amount = amount; this.type = type; this.error = error; this.balance = balance;
        }

        void appendNarration(String extra) {
            if (extra.isBlank() || description.length() >= 200) return;
            if (description.length() > 0) description.append(' ');
            description.append(extra);
        }

        LocalDate date() { return date; }
        String description() { return description.toString(); }
        BigDecimal amount() { return amount; }
        String type() { return type; }
        String error() { return error; }
        BigDecimal balance() { return balance; }
    }

    /** Walks the extracted text line by line and reconstructs transactions even though PDF text
     * extraction has thrown away the original table structure. Two real layouts drove this:
     * <ul>
     * <li>Narration wraps <b>after</b> a self-contained "date + narration + amount + balance"
     *     line (e.g. Standard Chartered) — trailing lines belong to the row just completed.</li>
     * <li>Narration wraps <b>before</b> the date, which itself may sit on its own line ahead of
     *     the amount/balance line (e.g. Canara) — those lines belong to the row about to start,
     *     and a standalone "Chq: N" line is the reliable signal that a transaction just closed,
     *     so text after it belongs forward to the next one rather than back to the last.</li>
     * </ul>
     * Both are handled by one pass: text accumulates into a rolling {@code buffer} tagged with
     * the most recent date seen; a line whose (post-date) text contains amount tokens closes out
     * a transaction using that buffer, while a line with no amount tokens either extends the
     * buffer (once a "Chq:" line or a still-open date has put us in "attribute forward" mode) or
     * — the safe default — is appended to the row most recently completed. */
    private List<PdfLineParse> parsePdfLines(String text) {
        List<PdfLineParse> rows = new ArrayList<>();
        StringBuilder buffer = new StringBuilder();
        LocalDate bufferDate = null;
        boolean forwardAttribution = false;
        BigDecimal previousBalance = null;

        for (String rawLine : text.split("\\r?\\n")) {
            String line = rawLine.strip();
            if (line.isEmpty()) continue;
            if (PDF_STATEMENT_END.matcher(line).find()) break;
            if (PDF_CHQ_LINE.matcher(line).matches()) { forwardAttribution = true; continue; }
            if (isNonNarrationLine(line)) continue;

            Matcher dm = PDF_LEADING_DATE.matcher(line);
            String searchText = line;
            if (dm.matches()) {
                try {
                    LocalDate lineDate = parseDate(dm.group(1));
                    searchText = dm.group(2);
                    Matcher dm2 = PDF_LEADING_DATE.matcher(searchText);
                    if (dm2.matches()) {
                        try { lineDate = parseDate(dm2.group(1)); searchText = dm2.group(2); }
                        catch (Exception ignored) { /* keep the first date */ }
                    }
                    bufferDate = lineDate;
                } catch (Exception ignored) {
                    // Syntactically date-shaped (e.g. a wrapped "0/06/2026" fragment) but not a
                    // real date — fall through and treat the whole line as plain text instead.
                }
            }

            Matcher am = PDF_AMOUNT_TOKEN.matcher(searchText);
            List<int[]> spans = new ArrayList<>();
            List<String> tokens = new ArrayList<>();
            while (am.find()) { spans.add(new int[]{am.start(), am.end()}); tokens.add(am.group()); }

            if (tokens.isEmpty()) {
                if (forwardAttribution || bufferDate != null) {
                    buffer.append(buffer.length() > 0 ? " " : "").append(searchText);
                } else if (!rows.isEmpty()) {
                    rows.get(rows.size() - 1).appendNarration(collapseSpaces(searchText));
                }
                continue;
            }

            int n = tokens.size();
            int narrationEnd = spans.get(n >= 3 ? n - 3 : 0)[0];
            buffer.append(buffer.length() > 0 ? " " : "").append(searchText, 0, narrationEnd);
            BigDecimal balance = parseAmount(tokens.get(n - 1));

            if (bufferDate == null) {
                // Opening/closing balance or a subtotal — nothing to attribute a row to, but the
                // balance still anchors the delta check for whatever transaction comes next.
                if (balance != null) previousBalance = balance;
                buffer.setLength(0);
                forwardAttribution = false;
                continue;
            }

            BigDecimal amount = null;
            String type = null;
            if (n >= 3) {
                // Explicit separate withdrawal/deposit columns, including for the empty side
                // (some banks print "0.00" there instead of leaving the cell blank).
                BigDecimal debit  = parseAmount(tokens.get(n - 3));
                BigDecimal credit = parseAmount(tokens.get(n - 2));
                boolean debitSet  = debit  != null && debit.compareTo(BigDecimal.ZERO)  > 0;
                boolean creditSet = credit != null && credit.compareTo(BigDecimal.ZERO) > 0;
                if (debitSet ^ creditSet) { amount = debitSet ? debit : credit; type = debitSet ? "DEBIT" : "CREDIT"; }
            } else if (n == 2) {
                BigDecimal candidate = parseAmount(tokens.get(0));
                if (candidate != null && candidate.compareTo(BigDecimal.ZERO) != 0) {
                    // Most Indian bank PDFs leave the empty Deposit/Withdrawal cell blank rather
                    // than print "0.00", so there's rarely a second amount column to read the
                    // direction off of — infer it from how the running balance moved instead,
                    // which also self-validates the parsed amount against the statement's own
                    // arithmetic.
                    if (previousBalance != null && balance != null) {
                        BigDecimal delta = balance.subtract(previousBalance);
                        if (delta.abs().subtract(candidate).abs().compareTo(new BigDecimal("0.05")) <= 0) {
                            amount = candidate;
                            type = delta.signum() >= 0 ? "CREDIT" : "DEBIT";
                        }
                    }
                    if (type == null) {
                        Matcher marker = PDF_DRCR_MARKER.matcher(searchText.substring(0, spans.get(1)[0]));
                        if (marker.find()) { amount = candidate; type = marker.group(1).equalsIgnoreCase("dr") ? "DEBIT" : "CREDIT"; }
                    }
                }
            }

            String description = collapseSpaces(buffer.toString());
            String error = (amount == null || type == null) ? "Could not determine debit/credit amount" : null;
            rows.add(new PdfLineParse(bufferDate, description, amount, type, error, balance));
            if (balance != null) previousBalance = balance;
            buffer.setLength(0);
            bufferDate = null;
            forwardAttribution = false;
        }
        return rows;
    }

    private static String collapseSpaces(String s) {
        // Trailing "-" is the common placeholder banks print for an empty Chq/Ref No column
        // right before the amount columns — strip it so it doesn't linger in the narration.
        return s.strip().replaceAll("\\s{2,}", " ").replaceAll("\\s*-$", "");
    }

    /** True for lines that are page furniture (repeated column headers, "Page N" footers) rather
     * than narration text belonging to some transaction. */
    private static boolean isNonNarrationLine(String line) {
        String t = line.strip();
        if (t.isEmpty() || t.equals("Value") || t.equals("Date")) return true;
        boolean hasAmountColumnWord = t.contains("Withdrawal") || t.contains("Deposit");
        boolean hasDescColumnWord   = t.contains("Description") || t.contains("Particulars");
        if (hasAmountColumnWord && hasDescColumnWord && t.contains("Balance")) return true;
        return PDF_PAGE_FOOTER.matcher(t).find();
    }

    // ─── shared row-assembly ────────────────────────────────────────────────────

    private ParsedRow buildParsedRow(int rowIndex, LocalDate date, String description, BigDecimal amount,
                                      String type, String error, List<Category> expenseCategories) {
        UUID suggestedCategoryId = null;
        String suggestedCategoryName = null;
        if (error == null && "DEBIT".equals(type) && description != null) {
            String descLower = description.toLowerCase();
            Category match = expenseCategories.stream()
                    .filter(c -> descLower.contains(c.getName().toLowerCase()))
                    .findFirst().orElse(null);
            if (match != null) { suggestedCategoryId = match.getId(); suggestedCategoryName = match.getName(); }
        }

        return ParsedRow.builder()
                .rowIndex(rowIndex).date(date).description(description).amount(amount).type(type)
                .suggestedCategoryId(suggestedCategoryId).suggestedCategoryName(suggestedCategoryName)
                .valid(error == null).error(error)
                .build();
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) throw new DateTimeParseException("blank", raw, 0);
        String trimmed = raw.trim();
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try { return LocalDate.parse(trimmed, fmt); } catch (DateTimeParseException ignored) { }
        }
        throw new DateTimeParseException("Unrecognized date format", trimmed, 0);
    }

    private BigDecimal parseAmount(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String cleaned = raw.trim().replace(",", "").replace("₹", "").replace("Rs.", "").replace("Rs", "").trim();
        if (cleaned.isEmpty() || cleaned.equals("-")) return null;
        BigDecimal value = new BigDecimal(cleaned);
        // Guards mainly against PDF text extraction fusing an adjacent reference number onto an
        // amount token when a column has no rendered gap — an Indian personal-finance transaction
        // this large is never legitimate, so treat it as an extraction artifact, not a real amount.
        return value.abs().compareTo(MAX_PLAUSIBLE_AMOUNT) > 0 ? null : value;
    }

    private IncomeSource parseIncomeSource(String raw) {
        if (raw == null || raw.isBlank()) return IncomeSource.OTHER;
        try { return IncomeSource.valueOf(raw.toUpperCase()); } catch (IllegalArgumentException e) { return IncomeSource.OTHER; }
    }
}
