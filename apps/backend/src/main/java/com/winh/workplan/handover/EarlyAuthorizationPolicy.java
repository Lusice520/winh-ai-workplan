package com.winh.workplan.handover;
import java.math.BigDecimal;
import java.time.LocalDate;

public final class EarlyAuthorizationPolicy {
    private EarlyAuthorizationPolicy() {}
    public static boolean over(LedgerPolicy.Totals totals,BigDecimal hours,BigDecimal cost) {
        return hours!=null&&cost!=null&&(totals.usedHours().compareTo(hours)>0||totals.usedCost().compareTo(cost)>0);
    }
    public static String effective(String status,LocalDate startsOn,LocalDate endsOn,LedgerPolicy.Totals totals,
            BigDecimal hours,BigDecimal cost,LocalDate today) {
        if(!"APPROVED".equals(status))return "REGULARIZED".equals(status)?"REGULARIZED":"STOPPED";
        if(over(totals,hours,cost))return "OVER_LIMIT";
        if(today.isBefore(startsOn))return "NOT_YET_ACTIVE";
        if(today.isAfter(endsOn))return "EXPIRED";
        return "ACTIVE";
    }
}
