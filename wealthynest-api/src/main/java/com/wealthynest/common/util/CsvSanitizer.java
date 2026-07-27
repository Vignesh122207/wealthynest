package com.wealthynest.common.util;

/** Shared by every hand-built or {@code commons-csv}-printed CSV export in the app. */
public final class CsvSanitizer {

    private CsvSanitizer() { }

    /** Prevents CSV formula injection: Excel/Sheets treat a cell starting with {@code =}, {@code +},
     * {@code -}, {@code @} (or a tab/CR) as a formula to evaluate, even when quoted. Prefixing a
     * literal apostrophe forces it to be read as plain text. */
    public static String neutralizeFormula(String value) {
        if (value == null || value.isEmpty()) return value;
        char first = value.charAt(0);
        return (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r')
                ? "'" + value : value;
    }
}
