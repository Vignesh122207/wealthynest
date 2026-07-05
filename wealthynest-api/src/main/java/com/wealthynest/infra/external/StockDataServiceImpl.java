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
    private static final DateTimeFormatter BSE_DATE = DateTimeFormatter.ofPattern("ddMMyyyy");
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

    // ── Phase 1: BSE stock master via bhavcopy ────────────────────────────────

    @Override
    @Transactional
    public int refreshBSEMaster() {
        log.info("Downloading BSE equity bhavcopy for stock master …");
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        // Try last 5 calendar days to account for weekends/holidays
        for (int i = 0; i <= 5; i++) {
            LocalDate date = today.minusDays(i);
            int count = tryBSEBhavcopy(date);
            if (count > 0) {
                log.info("BSE master refresh complete from {}: {} symbols upserted", date, count);
                return count;
            }
        }
        log.warn("BSE bhavcopy not available for last 5 days — BSE master not refreshed");
        return 0;
    }

    private int tryBSEBhavcopy(LocalDate date) {
        // BSE provides publicly downloadable bhavcopy ZIPs — no authentication required.
        // Format: https://www.bseindia.com/download/BhavCopy/Equity/EQ{DDMMYYYY}_CSV.ZIP
        // CSV inside has: SC_CODE,SC_NAME,SC_GROUP,SC_TYPE,OPEN,HIGH,LOW,CLOSE,...,ISIN_CODE
        String dateStr = date.format(BSE_DATE);
        String url = "https://www.bseindia.com/download/BhavCopy/Equity/EQ" + dateStr + "_CSV.ZIP";
        try {
            java.net.http.HttpClient httpClient = java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(15))
                .followRedirects(java.net.http.HttpClient.Redirect.NORMAL)
                .build();
            java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(url))
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120")
                .header("Accept", "application/zip,application/octet-stream,*/*")
                .header("Referer", "https://www.bseindia.com/")
                .GET().build();
            java.net.http.HttpResponse<byte[]> resp =
                httpClient.send(req, java.net.http.HttpResponse.BodyHandlers.ofByteArray());

            byte[] body = resp.body();
            if (body == null || body.length < 500) return 0;
            // Check magic bytes for ZIP
            if (body[0] != 0x50 || body[1] != 0x4B) return 0;

            Map<String, StockMaster> toSave = parseBSEBhavcopy(body);
            if (toSave.isEmpty()) return 0;

            int saved = 0;
            List<StockMaster> batch = new ArrayList<>(toSave.values());
            for (int i = 0; i < batch.size(); i += 200) {
                List<StockMaster> chunk = batch.subList(i, Math.min(i + 200, batch.size()));
                for (StockMaster sm : chunk) {
                    stockMasterRepository.findBySymbolAndExchange(sm.getSymbol(), sm.getExchange())
                        .ifPresentOrElse(
                            existing -> {
                                existing.setCompanyName(sm.getCompanyName());
                                if (sm.getIsin() != null) existing.setIsin(sm.getIsin());
                                existing.setActive(true);
                                stockMasterRepository.save(existing);
                            },
                            () -> stockMasterRepository.save(sm)
                        );
                    saved++;
                }
            }
            return saved;
        } catch (Exception e) {
            log.debug("BSE bhavcopy for {} not available: {}", date, e.getMessage());
            return 0;
        }
    }

    private Map<String, StockMaster> parseBSEBhavcopy(byte[] zipBytes) {
        // BSE bhavcopy CSV: SC_CODE,SC_NAME,SC_GROUP,SC_TYPE,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,NO_TRADES,NO_OF_SHRS,NET_TURNOV,TDCLOINDI,ISIN_CODE
        Map<String, StockMaster> result = new LinkedHashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            var entry = zis.getNextEntry();
            while (entry != null) {
                if (entry.getName().toLowerCase().endsWith(".csv")) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(zis));
                    String header = reader.readLine();
                    if (header == null) break;
                    // Detect column positions dynamically from the header
                    String[] cols = header.split(",");
                    int idxCode = -1, idxName = -1, idxIsin = -1;
                    for (int i = 0; i < cols.length; i++) {
                        String h = cols[i].trim().toUpperCase();
                        if (h.equals("SC_CODE"))   idxCode = i;
                        if (h.equals("SC_NAME"))   idxName = i;
                        if (h.contains("ISIN"))    idxIsin = i;
                    }
                    if (idxCode < 0 || idxName < 0) break;

                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty()) continue;
                        String[] parts = line.split(",");
                        if (parts.length <= Math.max(idxCode, idxName)) continue;
                        String scCode = parts[idxCode].trim();
                        String scName = parts[idxName].trim();
                        String isin   = (idxIsin >= 0 && idxIsin < parts.length) ? parts[idxIsin].trim() : "";
                        if (scCode.isEmpty() || scName.isEmpty()) continue;

                        // Use SC_NAME as the searchable symbol (matches NSE symbol for dual-listed stocks)
                        // Fall back to numeric SC_CODE only when SC_NAME is empty
                        String symbol = scName.isEmpty() ? scCode : scName;
                        result.putIfAbsent(symbol, StockMaster.builder()
                            .symbol(symbol)
                            .companyName(scName)
                            .exchange("BSE")
                            .isin(isin.startsWith("IN") ? isin : null)
                            .active(true).build());
                    }
                    break;
                }
                entry = zis.getNextEntry();
            }
        } catch (Exception e) {
            log.debug("BSE bhavcopy parse error: {}", e.getMessage());
        }
        return result;
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

            Map<String, BhavRow> bhavData = parseBhavcopyCsv(zipBytes);
            if (bhavData.isEmpty()) {
                log.warn("Bhavcopy for {} parsed 0 prices", dateStr);
                return 0;
            }

            // Build isin → price map for alias resolution
            Map<String, BigDecimal> isinPrices = new java.util.HashMap<>();
            for (Map.Entry<String, BhavRow> e : bhavData.entrySet()) {
                if (e.getValue().isin() != null)
                    isinPrices.put(e.getValue().isin(), e.getValue().price());
            }

            // Expand: find stock_master symbols whose ISIN matches a bhavcopy ISIN but
            // whose own symbol is not in the bhavcopy (e.g. FINOLEXCAB → FINCABLES).
            // This ensures investments entered under the display symbol still get updated.
            Map<String, BigDecimal> aliasedPrices = new java.util.HashMap<>();
            if (!isinPrices.isEmpty()) {
                List<Object[]> alts = stockMasterRepository.findAltSymbolsByIsin(
                    isinPrices.keySet(), bhavData.keySet());
                for (Object[] row : alts) {
                    String altSymbol = (String) row[0];
                    String isin      = (String) row[1];
                    aliasedPrices.put(altSymbol, isinPrices.get(isin));
                }
                if (!aliasedPrices.isEmpty())
                    log.info("Bhavcopy alias resolution: {} alternate symbols added (e.g. FINOLEXCAB→FINCABLES)",
                        aliasedPrices.size());
            }

            // Phase 1: batch-upsert stock_price_cache for all bhavcopy symbols + aliases.
            Instant now = Instant.now();
            Map<String, StockPriceCache> existing = new java.util.HashMap<>();
            stockPriceCacheRepository.findAll().forEach(c -> existing.put(c.getSymbol(), c));

            List<StockPriceCache> toSave = new java.util.ArrayList<>(bhavData.size() + aliasedPrices.size());
            for (Map.Entry<String, BhavRow> e : bhavData.entrySet()) {
                String symbol = e.getKey();
                BigDecimal close = e.getValue().price();
                StockPriceCache cache = existing.getOrDefault(symbol,
                    StockPriceCache.builder().symbol(symbol).exchange("NSE").build());
                if (cache.getCurrentPrice() != null) {
                    BigDecimal prev = cache.getCurrentPrice();
                    cache.setPreviousClose(prev);
                    BigDecimal chg = close.subtract(prev);
                    cache.setDayChange(chg);
                    if (prev.compareTo(BigDecimal.ZERO) > 0)
                        cache.setDayChangePct(chg.divide(prev, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)));
                }
                cache.setCurrentPrice(close);
                cache.setLastUpdated(now);
                toSave.add(cache);
            }
            // Alias entries: same price, linked via ISIN — allows investments saved under
            // the display symbol (e.g. FINOLEXCAB) to receive the bhavcopy close price.
            for (Map.Entry<String, BigDecimal> e : aliasedPrices.entrySet()) {
                String symbol = e.getKey();
                BigDecimal close = e.getValue();
                StockPriceCache cache = existing.getOrDefault(symbol,
                    StockPriceCache.builder().symbol(symbol).exchange("NSE").build());
                if (cache.getCurrentPrice() != null) {
                    BigDecimal prev = cache.getCurrentPrice();
                    cache.setPreviousClose(prev);
                    BigDecimal chg = close.subtract(prev);
                    cache.setDayChange(chg);
                    if (prev.compareTo(BigDecimal.ZERO) > 0)
                        cache.setDayChangePct(chg.divide(prev, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)));
                }
                cache.setCurrentPrice(close);
                cache.setLastUpdated(now);
                toSave.add(cache);
            }
            stockPriceCacheRepository.saveAll(toSave);

            // Phase 2: one SQL UPDATE to sync all active STOCK investments from cache.
            // O(held symbols) instead of O(users × symbols).
            int invUpdated = investmentRepository.syncStockCurrentValuesFromCache();
            log.info("EOD price update for {}: {} bhavcopy symbols ({} aliases), {} investment rows synced",
                dateStr, bhavData.size(), aliasedPrices.size(), invUpdated);
            return bhavData.size();
        } catch (Exception e) {
            log.warn("Bhavcopy update failed for {}: {}", dateStr, e.getMessage());
            return 0;
        }
    }

    private record BhavRow(BigDecimal price, String isin) {}

    private Map<String, BhavRow> parseBhavcopyCsv(byte[] zipBytes) throws IOException {
        Map<String, BhavRow> prices = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            var entry = zis.getNextEntry();
            while (entry != null) {
                String name = entry.getName().toLowerCase();
                if (name.endsWith(".csv") || name.endsWith(".txt")) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(zis));

                    String headerLine = reader.readLine();
                    if (headerLine == null) break;
                    String[] headers = headerLine.split(",");
                    int idxSymbol = -1, idxSeries = -1, idxClose = -1, idxIsin = -1;
                    for (int i = 0; i < headers.length; i++) {
                        String h = headers[i].trim().replaceAll("\"", "").toUpperCase();
                        if (h.equals("TCKRSYMB")) idxSymbol = i;
                        if (h.equals("SCTYSRS"))  idxSeries = i;
                        if (h.equals("CLSPRIC"))  idxClose  = i;
                        if (h.equals("ISIN"))     idxIsin   = i;
                    }
                    if (idxSymbol < 0 || idxSeries < 0 || idxClose < 0) {
                        log.warn("NSE bhavcopy header unrecognised — could not find TckrSymb/SctySrs/ClsPric. Headers: {}",
                            headerLine.substring(0, Math.min(200, headerLine.length())));
                        break;
                    }
                    log.info("NSE bhavcopy columns: symbol={}, series={}, close={}, isin={}",
                        idxSymbol, idxSeries, idxClose, idxIsin);

                    int minCols = Math.max(idxSymbol, Math.max(idxSeries, idxClose)) + 1;
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty()) continue;
                        String[] cols = line.split(",");
                        if (cols.length < minCols) continue;
                        String series = cols[idxSeries].trim();
                        if (!"EQ".equalsIgnoreCase(series)) continue;
                        String symbol   = cols[idxSymbol].trim();
                        String closeStr = cols[idxClose].trim();
                        if (symbol.isEmpty() || closeStr.isEmpty()) continue;
                        String isin = (idxIsin >= 0 && idxIsin < cols.length)
                            ? cols[idxIsin].trim() : null;
                        if (isin != null && !isin.startsWith("IN")) isin = null;
                        try {
                            prices.put(symbol, new BhavRow(new BigDecimal(closeStr), isin));
                        } catch (NumberFormatException ignored) {}
                    }
                    break;
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
