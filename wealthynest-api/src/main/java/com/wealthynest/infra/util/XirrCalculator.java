package com.wealthynest.infra.util;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Extended IRR (XIRR) calculator using Newton-Raphson.
 * Matches Excel's XIRR function behaviour.
 */
public final class XirrCalculator {

    private XirrCalculator() {}

    /**
     * @param cashflows  List of cashflows: negative = outflow (buy), positive = inflow (sell/current value)
     * @param dates      Corresponding dates for each cashflow
     * @return annualized XIRR as a percentage (e.g. 12.5 = 12.5%), or NaN if no convergence
     */
    public static double calculate(List<Double> cashflows, List<LocalDate> dates) {
        if (cashflows == null || cashflows.size() < 2) return Double.NaN;
        if (cashflows.size() != dates.size()) return Double.NaN;

        LocalDate t0 = dates.get(0);
        double rate = 0.10; // 10% initial guess

        for (int iter = 0; iter < 200; iter++) {
            double npv  = 0.0;
            double dnpv = 0.0;
            for (int i = 0; i < cashflows.size(); i++) {
                double cf   = cashflows.get(i);
                double days = ChronoUnit.DAYS.between(t0, dates.get(i));
                double t    = days / 365.0;
                double denom = Math.pow(1.0 + rate, t);
                npv  +=  cf / denom;
                dnpv -= (t * cf) / (denom * (1.0 + rate));
            }
            if (Math.abs(dnpv) < 1e-12) break;
            double newRate = rate - npv / dnpv;
            if (Math.abs(newRate - rate) < 1e-7) {
                return newRate * 100.0;
            }
            // clamp to avoid runaway
            rate = Math.max(-0.9999, Math.min(newRate, 100.0));
        }
        return Double.NaN;
    }

    /**
     * Simple annualized return when there are no intermediate cashflows:
     * ((currentValue / investedAmount)^(1/years) - 1) * 100
     */
    public static double simpleAnnualized(double invested, double currentValue, double years) {
        if (invested <= 0 || years <= 0) return Double.NaN;
        double ratio = currentValue / invested;
        if (ratio <= 0) return Double.NaN;
        return (Math.pow(ratio, 1.0 / years) - 1.0) * 100.0;
    }
}
