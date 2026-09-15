package com.winh.workplan.handover;
import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;

class LedgerPolicyTest {
    private final UUID commitment=UUID.randomUUID();
    private BigDecimal d(String s){return new BigDecimal(s);}
    private LedgerPolicy.Entry entry(UUID id,String kind,String hours,String cost,UUID parent,boolean reversed){return new LedgerPolicy.Entry(id,kind,d(hours),d(cost),parent,reversed);}
    @Test void partialSettlementDoesNotSpendTheCommitmentTwice() {
        var totals=LedgerPolicy.totals(List.of(entry(commitment,"COMMITTED","80","10000",null,false),
            entry(UUID.randomUUID(),"ACTUAL","20","2500",commitment,false),entry(UUID.randomUUID(),"ACTUAL","10","1000",null,false)));
        assertEquals(0,d("90").compareTo(totals.usedHours()));assertEquals(0,d("11000").compareTo(totals.usedCost()));
        assertEquals(0,d("7500").compareTo(totals.outstandingCost()));assertEquals(0,d("3500").compareTo(totals.actualCost()));
    }
    @Test void reversingAnActualRestoresOutstandingWithoutReleasingReservedBudget() {
        var totals=LedgerPolicy.totals(List.of(entry(commitment,"COMMITTED","10","100.10",null,false),
            entry(UUID.randomUUID(),"ACTUAL","4","40.04",commitment,true),entry(UUID.randomUUID(),"REVERSAL","-4","-40.04",null,false)));
        assertEquals(0,d("100.10").compareTo(totals.usedCost()));assertEquals(0,d("100.10").compareTo(totals.outstandingCost()));assertEquals(0,totals.actualCost().signum());
    }
    @Test void reversedCommitmentAndItsHistoricalCorrectionNoLongerConsumeCapacity() {
        var totals=LedgerPolicy.totals(List.of(entry(commitment,"COMMITTED","10","100",null,true),entry(UUID.randomUUID(),"REVERSAL","-10","-100",null,false)));
        assertEquals(0,totals.usedHours().signum());assertEquals(0,totals.usedCost().signum());
    }
    @Test void expiryIsInclusiveAndIndependentFromAvailableBalance() {
        var date=LocalDate.of(2026,9,8);var totals=LedgerPolicy.totals(List.of());
        assertEquals("ACTIVE",EarlyAuthorizationPolicy.effective("APPROVED",date,date,totals,d("10"),d("100"),date));
        assertEquals("EXPIRED",EarlyAuthorizationPolicy.effective("APPROVED",date,date,totals,d("10"),d("100"),date.plusDays(1)));
        assertEquals("NOT_YET_ACTIVE",EarlyAuthorizationPolicy.effective("APPROVED",date,date,totals,d("10"),d("100"),date.minusDays(1)));
    }
    @Test void EitherDimensionCanFreezeNewCommitmentsAndClosedNeverBecomesActive() {
        var date=LocalDate.of(2026,9,8);var totals=LedgerPolicy.totals(List.of(entry(UUID.randomUUID(),"ACTUAL","10.01","0",null,false)));
        assertTrue(EarlyAuthorizationPolicy.over(totals,d("10"),d("99999")));
        assertEquals("OVER_LIMIT",EarlyAuthorizationPolicy.effective("APPROVED",date,date,totals,d("10"),d("99999"),date));
        assertEquals("STOPPED",EarlyAuthorizationPolicy.effective("CLOSED",date,date,totals,d("10"),d("99999"),date));
        assertEquals("REGULARIZED",EarlyAuthorizationPolicy.effective("REGULARIZED",date,date,totals,d("10"),d("99999"),date));
    }
}
