package com.winh.workplan.handover;

import java.math.BigDecimal;
import java.util.*;

/** Actual settlements consume their original commitment once; reversals remain historical rows. */
public final class LedgerPolicy {
    private LedgerPolicy() {}
    public record Entry(UUID id, String kind, BigDecimal hours, BigDecimal cost, UUID commitmentId, boolean reversed) {}
    public record Totals(BigDecimal committedHours, BigDecimal committedCost, BigDecimal outstandingHours,
        BigDecimal outstandingCost, BigDecimal actualHours, BigDecimal actualCost, BigDecimal usedHours, BigDecimal usedCost) {}
    public static Totals totals(List<Entry> entries) {
        BigDecimal ch=BigDecimal.ZERO, cc=BigDecimal.ZERO, oh=BigDecimal.ZERO, oc=BigDecimal.ZERO, ah=BigDecimal.ZERO, ac=BigDecimal.ZERO;
        var active=entries.stream().filter(e->!e.reversed()&&!"REVERSAL".equals(e.kind())).toList();
        for(var e:active) {
            if("ACTUAL".equals(e.kind())) {ah=ah.add(e.hours());ac=ac.add(e.cost());}
            if("COMMITTED".equals(e.kind())) {
                ch=ch.add(e.hours());cc=cc.add(e.cost());BigDecimal ph=BigDecimal.ZERO,pc=BigDecimal.ZERO;
                for(var payment:active) if("ACTUAL".equals(payment.kind())&&e.id().equals(payment.commitmentId())) {ph=ph.add(payment.hours());pc=pc.add(payment.cost());}
                oh=oh.add(e.hours().subtract(ph));oc=oc.add(e.cost().subtract(pc));
            }
        }
        return new Totals(ch,cc,oh,oc,ah,ac,oh.add(ah),oc.add(ac));
    }
}
