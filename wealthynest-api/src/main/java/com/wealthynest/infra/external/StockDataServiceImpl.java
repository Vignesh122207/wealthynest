package com.wealthynest.infra.external;

import com.wealthynest.domain.investment.entity.*;
import com.wealthynest.domain.investment.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.io.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.zip.ZipInputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class StockDataServiceImpl implements StockDataService {

    private final StockMasterRepository     stockMasterRepository;
    private final StockPriceCacheRepository stockPriceCacheRepository;
    private final InvestmentRepository      investmentRepository;
    private final NseCorporateActionRepository corpActionRepository;
    private final RestClient                nseClient;

    private static final String NSE_EQUITY_URL  = "/content/equities/EQUITY_L.csv";
    private static final String NSE_BHAV_URL    =
        "/content/cm/BhavCopy_NSE_CM_0_0_0_{date}_F_0000.csv.zip";
    private static final String NSE_CA_URL      = "/content/equities/CA_0_0_0_P_EquityList.csv";
    private static final DateTimeFormatter BHAV_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter CA_DATE   = DateTimeFormatter.ofPattern("ddMMyyyy");

    // ── Phase 1: Stock master ─────────────────────────────────────────────────

    @Override
    @Transactional
    public int refreshNSEMaster() {
        log.info("Downloading NSE EQUITY_L.csv …");
        try {
            String csv = nseClient.get()
                .uri(NSE_EQUITY_URL)
                .header("Referer", "https://www.nseindia.com")
                .retrieve().body(String.class);

            if (csv == null || csv.isBlank()) {
                log.warn("NSE EQUITY_L.csv returned empty");
                return 0;
            }

            List<StockMaster> batch = new ArrayList<>();
            String[] lines = csv.split("\n");
            // Header: SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
            for (int i = 1; i < lines.length; i++) {
                String line = lines[i].trim();
                if (line.isEmpty()) continue;
                StockMaster sm = parseEquityLine(line);
                if (sm != null) batch.add(sm);
            }

            // Upsert in batches of 200
            int saved = 0;
            for (int i = 0; i < batch.size(); i += 200) {
                List<StockMaster> chunk = batch.subList(i, Math.min(i + 200, batch.size()));
                for (StockMaster sm : chunk) {
                    stockMasterRepository.findBySymbolAndExchange(sm.getSymbol(), sm.getExchange())
                        .ifPresentOrElse(
                            existing -> {
                                existing.setCompanyName(sm.getCompanyName());
                                existing.setIsin(sm.getIsin());
                                existing.setSeries(sm.getSeries());
                                existing.setActive(true);
                                stockMasterRepository.save(existing);
                            },
                            () -> stockMasterRepository.save(sm)
                        );
                }
                saved += chunk.size();
            }
            log.info("NSE master refresh complete: {} symbols upserted", saved);
            return saved;
        } catch (Exception e) {
            log.warn("NSE master refresh failed: {}", e.getMessage());
            return 0;
        }
    }

    private StockMaster parseEquityLine(String line) {
        try {
            // Symbol is always the first field (no comma in NSE ticker symbols)
            int firstComma = line.indexOf(',');
            if (firstComma < 0) return null;
            String symbol = line.substring(0, firstComma).trim();
            String rest   = line.substring(firstComma + 1);

            // Split the rest — last 6 fields: series, date, paidUp, lot, isin, faceValue
            String[] parts = rest.split(",");
            if (parts.length < 7) return null;

            String series    = parts[parts.length - 6].trim();
            String isin      = parts[parts.length - 2].trim();
            // Company name may have commas → everything before the 6 trailing fields
            String compName  = String.join(",",
                Arrays.copyOfRange(parts, 0, parts.length - 6)).trim();

            if (symbol.isEmpty() || compName.isEmpty()) return null;

            return StockMaster.builder()
                .symbol(symbol).companyName(compName)
                .exchange("NSE").series(series)
                .isin(isin.startsWith("IN") ? isin : null)
                .active(true).build();
        } catch (Exception e) {
            return null;
        }
    }

    // ── Phase 1: EOD prices via bhavcopy ─────────────────────────────────────

    @Override
    @Transactional
    public int updateEODPrices(LocalDate tradeDate) {
        String dateStr = tradeDate.format(BHAV_DATE);
        log.info("Downloading NSE bhavcopy for {} …", dateStr);
        try {
            byte[] zipBytes = nseClient.get()
                .uri(NSE_BHAV_URL, dateStr)
                .header("Referer", "https://www.nseindia.com")
                .retrieve().body(byte[].class);

            if (zipBytes == null || zipBytes.length < 1000) {
                log.warn("Bhavcopy for {} not available or too small", dateStr);
                return 0;
            }

            Map<String, BigDecimal> prices = parseBhavcopyCsv(zipBytes);
            if (prices.isEmpty()) {
                log.warn("Bhavcopy for {} parsed 0 prices", dateStr);
                return 0;
            }

            int updated = 0;
            for (Map.Entry<String, BigDecimal> e : prices.entrySet()) {
                String symbol = e.getKey();
                BigDecimal close = e.getValue();
                // update stock_price_cache
                StockPriceCache cache = stockPriceCacheRepository.findById(symbol)
                    .orElse(StockPriceCache.builder().symbol(symbol).exchange("NSE").build());
                if (cache.getCurrentPrice() != null) {
                    BigDecimal prev = cache.getCurrentPrice();
                    cache.setPreviousClose(prev);
                    BigDecimal chg = close.subtract(prev);
                    cache.setDayChange(chg);
                    if (prev.compareTo(BigDecimal.ZERO) > 0) {
                        cache.setDayChangePct(chg.divide(prev, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)));
                    }
                }
                cache.setCurrentPrice(close);
                cache.setLastUpdated(Instant.now());
                stockPriceCacheRepository.save(cache);

                // update investment current_value for all users holding this symbol
                investmentRepository.findAll().stream()
                    .filter(inv -> inv.isActive()
                        && inv.getInvestmentType() == InvestmentType.STOCK
                        && symbol.equals(inv.getSymbol())
                        && inv.getUnits() != null)
                    .forEach(inv -> {
                        inv.setCurrentPrice(close);
                        inv.setCurrentValue(inv.getUnits().multiply(close));
                        investmentRepository.save(inv);
                    });
                updated++;
            }
            log.info("EOD price update for {}: {} symbols", dateStr, updated);
            return updated;
        } catch (Exception e) {
            log.warn("Bhavcopy update failed for {}: {}", dateStr, e.getMessage());
            return 0;
        }
    }

    private Map<String, BigDecimal> parseBhavcopyCsv(byte[] zipBytes) throws IOException {
        Map<String, BigDecimal> prices = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            var entry = zis.getNextEntry();
            while (entry != null) {
                String name = entry.getName().toLowerCase();
                if (name.endsWith(".csv") || name.endsWith(".txt")) {
                    BufferedReader reader = new BufferedReader(
                        new InputStreamReader(zis));
                    reader.readLine(); // skip header
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty()) continue;
                        String[] cols = line.split(",");
                        // New NSE bhavcopy format:
                        // col 7 = TckrSymb, col 8 = SctySrs, col 14 = ClsPric
                        if (cols.length < 15) continue;
                        String series = cols[8].trim();
                        if (!"EQ".equalsIgnoreCase(series)) continue;
                        String symbol   = cols[7].trim();
                        String closeStr = cols[14].trim();
                        if (symbol.isEmpty() || closeStr.isEmpty()) continue;
                        try {
                            prices.put(symbol, new BigDecimal(closeStr));
                        } catch (NumberFormatException ignored) {}
                    }
                    break; // only one CSV inside the ZIP
                }
                entry = zis.getNextEntry();
            }
        }
        return prices;
    }

    // ── Phase 2: Corporate actions (dividends) ────────────────────────────────

    @Override
    @Transactional
    public int refreshCorporateActions() {
        log.info("Fetching NSE corporate actions …");
        try {
            String csv = nseClient.get()
                .uri(NSE_CA_URL)
                .header("Referer", "https://www.nseindia.com")
                .retrieve().body(String.class);

            if (csv == null || csv.isBlank() || csv.trim().startsWith("<")) {
                log.warn("NSE CA CSV not available (got HTML or empty)");
                return 0;
            }

            int count = 0;
            for (String line : csv.split("\n")) {
                line = line.trim();
                if (line.isEmpty() || line.toLowerCase().startsWith("symbol")) continue;
                NseCorporateAction ca = parseCaLine(line);
                if (ca == null) continue;
                if (!corpActionRepository.existsBySymbolAndActionTypeAndExDate(
                        ca.getSymbol(), ca.getActionType(), ca.getExDate())) {
                    corpActionRepository.save(ca);
                    count++;
                }
            }
            log.info("Corporate actions refresh: {} new entries", count);
            return count;
        } catch (Exception e) {
            log.info("NSE CA fetch skipped (expected if not available without session): {}", e.getMessage());
            return 0;
        }
    }

    private NseCorporateAction parseCaLine(String line) {
        try {
            // Expected: Symbol,Ex-Date,Purpose,Record Date,...
            String[] cols = line.split(",");
            if (cols.length < 3) return null;
            String symbol  = cols[0].trim();
            String exDateS = cols[1].trim();
            String purpose = cols[2].trim().toLowerCase();
            if (symbol.isEmpty() || exDateS.isEmpty()) return null;
            if (!purpose.contains("dividend")) return null;

            LocalDate exDate = parseNSEDate(exDateS);
            if (exDate == null) return null;

            // Extract dividend amount from purpose like "Annual Dividend- Rs 10 Per Share"
            BigDecimal dps = extractDividendAmount(cols[2].trim());

            return NseCorporateAction.builder()
                .symbol(symbol).actionType("DIVIDEND")
                .exDate(exDate).dividendPerShare(dps).build();
        } catch (Exception e) {
            return null;
        }
    }

    private LocalDate parseNSEDate(String s) {
        for (String fmt : new String[]{"dd-MMM-yyyy", "dd-MM-yyyy", "yyyy-MM-dd"}) {
            try { return LocalDate.parse(s, DateTimeFormatter.ofPattern(fmt, Locale.ENGLISH)); }
            catch (Exception ignored) {}
        }
        return null;
    }

    private BigDecimal extractDividendAmount(String purpose) {
        // patterns: "Rs 10 Per Share", "Re 1 Per Share", "Rs.5.00 Per Share"
        java.util.regex.Matcher m = java.util.regex.Pattern
            .compile("(?:Rs?\\.?\\s*)([0-9]+(?:\\.[0-9]+)?)", java.util.regex.Pattern.CASE_INSENSITIVE)
            .matcher(purpose);
        if (m.find()) {
            try { return new BigDecimal(m.group(1)); } catch (Exception ignored) {}
        }
        return BigDecimal.ZERO;
    }

    // ── Daily corporate actions (date-specific CA file) ───────────────────────

    @Override
    @Transactional
    public int refreshDailyCorporateActions(LocalDate date) {
        String dateStr = date.format(CA_DATE);
        log.info("Downloading NSE daily CA for {} …", dateStr);
        try {
            String csv = nseClient.get()
                .uri("/corporate/CA_" + dateStr + ".csv")
                .header("Referer", "https://www.nseindia.com")
                .retrieve().body(String.class);

            if (csv == null || csv.isBlank() || csv.trim().startsWith("<")) {
                log.info("NSE CA file for {} not available (holiday/weekend or not yet published)", dateStr);
                return 0;
            }

            String[] lines = csv.split("\n");
            if (lines.length < 2) return 0;

            // Detect format from header
            String header = lines[0].trim().toLowerCase().replace("\"", "");
            boolean companyNameFirst = header.startsWith("company") || header.startsWith("\"company");

            int count = 0;
            for (int i = 1; i < lines.length; i++) {
                String line = lines[i].trim();
                if (line.isEmpty()) continue;
                NseCorporateAction ca = parseDailyCaLine(line, companyNameFirst);
                if (ca == null) continue;
                if (!corpActionRepository.existsBySymbolAndActionTypeAndExDate(
                        ca.getSymbol(), ca.getActionType(), ca.getExDate())) {
                    corpActionRepository.save(ca);
                    count++;
                }
            }
            log.info("NSE daily CA for {}: {} new dividend entries saved", dateStr, count);
            return count;
        } catch (Exception e) {
            log.info("NSE daily CA for {} not fetched: {}", dateStr, e.getMessage());
            return 0;
        }
    }

    private NseCorporateAction parseDailyCaLine(String line, boolean companyNameFirst) {
        try {
            List<String> cols = splitQuotedCsv(line);
            if (companyNameFirst) {
                // Format: "Company Name","Symbol","Ex Date","Purpose","Record Date",...
                if (cols.size() < 4) return null;
                String symbol  = cols.get(1).trim();
                String exDateS = cols.get(2).trim();
                String purpose = cols.get(3).trim();
                if (symbol.isEmpty() || !purpose.toLowerCase().contains("dividend")) return null;
                LocalDate exDate = parseNSEDate(exDateS);
                if (exDate == null) return null;
                LocalDate recDate = cols.size() > 4 ? parseNSEDate(cols.get(4).trim()) : null;
                return NseCorporateAction.builder()
                    .symbol(symbol).actionType("DIVIDEND")
                    .exDate(exDate).recordDate(recDate)
                    .dividendPerShare(extractDividendAmount(purpose)).build();
            } else {
                // Format: Symbol,Ex-Date,Purpose,Record Date,...
                if (cols.size() < 3) return null;
                String symbol  = cols.get(0).trim();
                String exDateS = cols.get(1).trim();
                String purpose = cols.get(2).trim();
                if (symbol.isEmpty() || !purpose.toLowerCase().contains("dividend")) return null;
                LocalDate exDate = parseNSEDate(exDateS);
                if (exDate == null) return null;
                LocalDate recDate = cols.size() > 3 ? parseNSEDate(cols.get(3).trim()) : null;
                return NseCorporateAction.builder()
                    .symbol(symbol).actionType("DIVIDEND")
                    .exDate(exDate).recordDate(recDate)
                    .dividendPerShare(extractDividendAmount(purpose)).build();
            }
        } catch (Exception e) {
            return null;
        }
    }

    private List<String> splitQuotedCsv(String line) {
        List<String> cols = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuote = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuote = !inQuote;
            } else if (c == ',' && !inQuote) {
                cols.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        cols.add(cur.toString());
        return cols;
    }
}
