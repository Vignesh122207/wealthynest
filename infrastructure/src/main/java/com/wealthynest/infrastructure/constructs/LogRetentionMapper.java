package com.wealthynest.infrastructure.constructs;

import software.amazon.awscdk.services.logs.RetentionDays;

/** Maps a plain day count from config into the nearest supported {@link RetentionDays} value. */
public final class LogRetentionMapper {

    private LogRetentionMapper() {
    }

    public static RetentionDays fromDays(int days) {
        if (days <= 3) return RetentionDays.THREE_DAYS;
        if (days <= 5) return RetentionDays.FIVE_DAYS;
        if (days <= 7) return RetentionDays.ONE_WEEK;
        if (days <= 14) return RetentionDays.TWO_WEEKS;
        if (days <= 30) return RetentionDays.ONE_MONTH;
        if (days <= 60) return RetentionDays.TWO_MONTHS;
        if (days <= 90) return RetentionDays.THREE_MONTHS;
        if (days <= 120) return RetentionDays.FOUR_MONTHS;
        if (days <= 150) return RetentionDays.FIVE_MONTHS;
        if (days <= 180) return RetentionDays.SIX_MONTHS;
        if (days <= 365) return RetentionDays.ONE_YEAR;
        if (days <= 400) return RetentionDays.THIRTEEN_MONTHS;
        if (days <= 545) return RetentionDays.EIGHTEEN_MONTHS;
        if (days <= 731) return RetentionDays.TWO_YEARS;
        return RetentionDays.TEN_YEARS;
    }
}
