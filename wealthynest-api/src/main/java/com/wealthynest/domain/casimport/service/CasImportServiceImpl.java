package com.wealthynest.domain.casimport.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.domain.casimport.dto.*;
import com.wealthynest.domain.investment.dto.request.CreateInvestmentRequest;
import com.wealthynest.domain.investment.repository.MfMasterRepository;
import com.wealthynest.domain.investment.service.InvestmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses a CAMS/KFintech Consolidated Account Statement (CAS) PDF into draft mutual fund
 * holdings, so adding an existing portfolio is "upload the CAS you can already download for free"
 * instead of typing every scheme in by hand. Same stateless preview/confirm shape as
 * StatementImportServiceImpl (no draft DB table — the client holds parsed rows in browser state
 * and can edit/remove/add before confirming), and reuses its exact password-protected-PDF
 * handling since CAS PDFs are almost always password-protected too.
 *
 * <p><b>Honest caveat:</b> unlike bank statement PDFs (which this codebase already had many real
 * samples to tune against), this parser was written against general knowledge of how CAMS/
 * KFintech CAS documents are laid out, not a verified real sample — RTAs vary their exact phrasing
 * year to year and between each other. It's deliberately conservative: every field it can't
 * confidently extract is left null and the row is flagged invalid rather than guessed at, and the
 * frontend lets the user edit any field or add a scheme by hand. Expect this to need a tuning pass
 * against a real CAS PDF before it's fully reliable.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CasImportServiceImpl implements CasImportService {

    // "Folio No: 12345678 / 0" or "Folio No. : 12345678"
    private static final Pattern FOLIO_PATTERN = Pattern.compile("(?i)Folio\\s+No\\.?\\s*:?\\s*([\\w/]+)");
    // "ISIN: INF179K01158" — Indian MF ISINs start with IN, standard 12-char format
    private static final Pattern ISIN_PATTERN = Pattern.compile("(?i)ISIN\\s*:?\\s*([A-Z]{2}[A-Z0-9]{9}[0-9])");
    // "Closing Unit Balance: 1,234.567" / "Closing Balance: 1234.567 Units"
    private static final Pattern UNITS_PATTERN = Pattern.compile(
            "(?i)closing\\s+(?:unit\\s+)?balance\\s*:?\\s*([\\d,]+\\.\\d{2,4})");
    // "NAV on 30-Jun-2026: Rs. 45.6789" / "NAV: 45.6789"
    private static final Pattern NAV_PATTERN = Pattern.compile(
            "(?i)NAV\\s*(?:on\\s+[\\w/\\-]+)?\\s*:?\\s*(?:Rs\\.?)?\\s*([\\d,]+\\.\\d{2,4})");
    // "Market Value: Rs. 56,437.89" / "Value as on 30-Jun-2026: Rs. 56,437.89" / "Valuation: ..."
    private static final Pattern VALUE_PATTERN = Pattern.compile(
            "(?i)(?:market\\s+)?valu(?:e|ation)\\s*(?:as\\s+on\\s+[\\w/\\-]+)?\\s*:?\\s*(?:Rs\\.?)?\\s*([\\d,]+\\.\\d{2})");
    // "Cost Value: Rs. 50,000.00" / "Total Cost: Rs. 50,000.00" — not every CAS format prints this
    private static final Pattern COST_PATTERN = Pattern.compile(
            "(?i)(?:total\\s+)?cost\\s+value\\s*:?\\s*(?:Rs\\.?)?\\s*([\\d,]+\\.\\d{2})");

    private static final int LOOKAHEAD_LINES = 3;

    private final MfMasterRepository mfMasterRepository;
    private final InvestmentService  investmentService;
    private final ObjectMapper       objectMapper;

    @Override
    public CasPreviewResponse preview(MultipartFile file, String password, UUID userId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Please choose a CAS PDF to import.", HttpStatus.BAD_REQUEST);
        }
        String text;
        try (PDDocument document = Loader.loadPDF(file.getBytes(), password != null ? password : "")) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            text = stripper.getText(document);
        } catch (InvalidPasswordException e) {
            return CasPreviewResponse.builder().needsPassword(true).holdings(List.of()).build();
        } catch (IOException e) {
            throw new BusinessException("Could not read the PDF file — is it a valid CAS statement?", HttpStatus.BAD_REQUEST);
        }

        List<CasParsedHolding> holdings = parseHoldings(text);
        if (holdings.isEmpty()) {
            throw new BusinessException(
                    "Could not detect any fund holdings in this PDF. Make sure it's a CAMS/KFintech Consolidated Account Statement.",
                    HttpStatus.BAD_REQUEST);
        }
        return CasPreviewResponse.builder().needsPassword(false).holdings(holdings).build();
    }

    private List<CasParsedHolding> parseHoldings(String text) {
        String[] lines = text.split("\\r?\\n");
        List<CasParsedHolding> holdings = new ArrayList<>();
        String candidateSchemeName = null;
        String currentFolio = null;

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].strip();
            if (line.isEmpty()) continue;

            Matcher folioM = FOLIO_PATTERN.matcher(line);
            if (folioM.find()) { currentFolio = folioM.group(1); continue; }

            if (ISIN_PATTERN.matcher(line).find() || NAV_PATTERN.matcher(line).find()
                    || VALUE_PATTERN.matcher(line).find() || COST_PATTERN.matcher(line).find()) {
                // A "field" line, not a name — falls through to the units check below rather
                // than being considered as a scheme-name candidate.
            } else if (isPlausibleSchemeName(line)) {
                candidateSchemeName = line;
            }

            Matcher unitsM = UNITS_PATTERN.matcher(line);
            if (!unitsM.find()) continue;

            // Closing balance found — NAV/Value/Cost usually sit on this same line or the next
            // couple of lines, so widen the search window rather than requiring one exact layout.
            StringBuilder window = new StringBuilder(line);
            for (int j = i + 1; j < Math.min(lines.length, i + 1 + LOOKAHEAD_LINES); j++) {
                window.append(' ').append(lines[j].strip());
            }
            String windowText = window.toString();

            BigDecimal units          = parseAmount(unitsM.group(1));
            BigDecimal nav            = firstMatch(NAV_PATTERN, windowText);
            BigDecimal currentValue   = firstMatch(VALUE_PATTERN, windowText);
            BigDecimal investedAmount = firstMatch(COST_PATTERN, windowText);
            if (currentValue == null && units != null && nav != null) {
                currentValue = units.multiply(nav);
            }
            if (nav == null && units != null && currentValue != null && units.compareTo(BigDecimal.ZERO) > 0) {
                nav = currentValue.divide(units, 4, java.math.RoundingMode.HALF_UP);
            }

            String schemeName = candidateSchemeName != null ? candidateSchemeName
                    : "Unknown scheme (row " + (holdings.size() + 1) + ")";
            String error = units == null ? "Could not find unit balance"
                    : currentValue == null ? "Could not find market value"
                    : candidateSchemeName == null ? "Could not confidently identify the scheme name — please check"
                    : null;

            holdings.add(CasParsedHolding.builder()
                    .rowIndex(holdings.size())
                    .schemeName(schemeName)
                    .schemeCode(matchSchemeCode(schemeName))
                    .folioNumber(currentFolio)
                    .units(units)
                    .nav(nav)
                    .currentValue(currentValue)
                    .investedAmount(investedAmount)
                    .valid(error == null)
                    .error(error)
                    .build());

            // Next scheme's name hasn't appeared yet — reset so we don't accidentally reuse this
            // one for the next holding if the parser can't find a fresh name line before the next
            // closing-balance match.
            candidateSchemeName = null;
        }
        return holdings;
    }

    /** Best-effort fuzzy match against the local scheme-name mirror — a hit lets the confirmed
     * investment carry a real schemeCode (for NAV auto-refresh going forward); a miss just means
     * the user is holding a scheme not yet in mf_master, which is fine, not an error. */
    private String matchSchemeCode(String schemeName) {
        if (schemeName == null || schemeName.startsWith("Unknown scheme")) return null;
        return mfMasterRepository.search(schemeName, Pageable.ofSize(1)).stream()
                .findFirst().map(com.wealthynest.domain.investment.entity.MfMaster::getSchemeCode)
                .orElse(null);
    }

    private static boolean isPlausibleSchemeName(String line) {
        if (line.length() < 8 || line.length() > 150) return false;
        if (Character.isDigit(line.charAt(0))) return false;
        if (FOLIO_PATTERN.matcher(line).find()) return false;
        // Page furniture / boilerplate that shows up repeatedly and would otherwise get picked up
        // as a "scheme name" right before some unrelated closing-balance line.
        String lower = line.toLowerCase();
        if (lower.contains("consolidated account statement") || lower.contains("page ")
                || lower.contains("statement for the period") || lower.contains("pan:")
                || lower.contains("kyc") || lower.startsWith("mutual fund")) return false;
        return true;
    }

    private static BigDecimal firstMatch(Pattern p, String text) {
        Matcher m = p.matcher(text);
        return m.find() ? parseAmount(m.group(1)) : null;
    }

    private static BigDecimal parseAmount(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try { return new BigDecimal(raw.replace(",", "").trim()); }
        catch (NumberFormatException e) { return null; }
    }

    @Override
    public CasImportResultResponse confirm(UUID userId, CasImportConfirmRequest request) {
        int created = 0;
        List<String> errors = new ArrayList<>();
        for (CasConfirmRowRequest row : request.getRows()) {
            try {
                BigDecimal invested = row.getInvestedAmount() != null ? row.getInvestedAmount() : row.getCurrentValue();
                BigDecimal avgBuyPrice = row.getUnits().compareTo(BigDecimal.ZERO) > 0
                        ? invested.divide(row.getUnits(), 4, java.math.RoundingMode.HALF_UP)
                        : row.getNav();

                Map<String, Object> fields = new HashMap<>();
                fields.put("investmentType", "MUTUAL_FUND");
                fields.put("schemeCode", row.getSchemeCode());
                fields.put("companyName", row.getSchemeName());
                fields.put("units", row.getUnits());
                fields.put("avgBuyPrice", avgBuyPrice);
                fields.put("currentPrice", row.getNav());
                fields.put("investedAmount", invested);
                fields.put("currentValue", row.getCurrentValue());
                fields.put("purchaseDate", LocalDate.now());
                fields.put("notes", row.getFolioNumber() != null
                        ? "Imported from CAS — Folio " + row.getFolioNumber() : "Imported from CAS");

                CreateInvestmentRequest req = objectMapper.convertValue(fields, CreateInvestmentRequest.class);
                investmentService.createInvestment(userId, req);
                created++;
            } catch (Exception e) {
                errors.add(String.format("%s: %s", row.getSchemeName(), e.getMessage()));
            }
        }
        return CasImportResultResponse.builder().created(created).failed(errors.size()).errors(errors).build();
    }
}
