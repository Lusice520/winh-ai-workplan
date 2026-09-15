package com.winh.workplan.execution;
import static com.winh.workplan.business.BusinessRules.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.winh.workplan.business.BusinessRecord;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory.ObjectReference;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
class ExecutionRules {
    private final ObjectMapper mapper;
    ExecutionRules(ObjectMapper mapper){this.mapper=mapper;}
    String json(Object value){try{return mapper.writeValueAsString(value);}catch(JsonProcessingException e){throw new IllegalStateException(e);}}
    <T>T read(String json,Class<T> type){try{return mapper.readValue(json,type);}catch(JsonProcessingException e){throw new IllegalStateException(e);}}
    String hash(Object value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json(value).getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    String scopeHash(ObjectReference ref){
        var c=ref.content();
        // Planned dates and personnel changes never rewrite or invalidate the physical fact itself.
        return switch(ref.kind()){
            case "STAGE" -> {var s=c.stage();yield hash(Arrays.asList(s.applicable(),s.predecessorIds(),s.actions(),s.deliverables(),s.completionCriteria()));}
            case "ITEM" -> {var i=c.item();yield hash(Arrays.asList(i.category(),i.specification(),i.quantity().stripTrailingZeros().toPlainString(),i.unit(),i.acceptanceScope(),i.stageId(),i.workPackageId(),i.milestoneId()));}
            case "MILESTONE" -> {var m=c.milestone();yield hash(Arrays.asList(m.kind(),m.stageId(),m.contractNodeId(),m.acceptanceCriteria()));}
            default -> hash(c);
        };
    }
    static LocalDate today(){return LocalDate.now(ZoneId.of("Asia/Shanghai"));}
    static LocalDate date(LocalDate value){if(value==null||value.isAfter(today()))throw invalid("occurredOn","请填写已经发生的实际日期，不能晚于今天。");return value;}
    static void expected(BusinessRecord row,Long version){
        if(row==null){if(version==null||version!=-1L)throw conflict("执行记录已变化，请加载最新内容。");}
        else version(row,version);
    }
    static void objectVersion(ObjectReference object,Long version){if(version==null||object.version()!=version)throw conflict("当前批准对象已变化，请加载最新范围后继续。");}
    static BigDecimal quantity(BigDecimal value){amount(value,"quantity");if(value.signum()<=0)throw invalid("quantity","数量必须大于零。");return value;}
    static boolean active(ExecutionItemEvent e){return !"REVERSAL".equals(e.kind)&&Set.of("RECORDED","PENDING","VERIFIED").contains(e.status);}
    Totals totals(List<ExecutionItemEvent> rows,String scopeHash){
        BigDecimal received=BigDecimal.ZERO,installed=BigDecimal.ZERO,accepted=BigDecimal.ZERO,pending=BigDecimal.ZERO,stale=BigDecimal.ZERO;
        for(var e:rows){if(!active(e))continue;
            if("RECEIVED".equals(e.kind))received=received.add(e.quantity);
            else if("INSTALLED".equals(e.kind))installed=installed.add(e.quantity);
            else if("PENDING".equals(e.status))pending=pending.add(e.quantity);
            else if(Objects.equals(e.scopeHash,scopeHash))accepted=accepted.add(e.quantity);
            else stale=stale.add(e.quantity);
        }
        return new Totals(received,installed,accepted,pending,stale);
    }
    void validateQuantities(ExecutionItemProfile profile,BigDecimal approved,Totals t){
        // Stale accepted facts retain occupied quantities until explicitly reversed and re-submitted.
        BigDecimal acceptance=t.accepted.add(t.pending).add(t.needsReview);
        if(t.received.compareTo(approved)>0||t.installed.compareTo(approved)>0||acceptance.compareTo(approved)>0)
            throw conflict("累计实际或待验收数量超过当前批准数量，请核对原记录和范围。");
        if(profile.requiresReceipt&&(t.installed.compareTo(t.received)>0||acceptance.compareTo(t.received)>0))
            throw conflict("已有安装或验收数量超过净到货，请先处理对应下游记录。");
        if(profile.requiresInstallation&&acceptance.compareTo(t.installed)>0)
            throw conflict("验收数量超过净安装数量，请先补齐安装或处理下游验收。");
    }
    void validateTimeline(ExecutionItemProfile profile,BigDecimal approved,List<ExecutionItemEvent> rows,String scopeHash){
        var days=new TreeMap<LocalDate,List<ExecutionItemEvent>>();
        rows.stream().filter(ExecutionRules::active).forEach(row->days.computeIfAbsent(row.occurredOn,ignored->new ArrayList<>()).add(row));
        var cumulative=new ArrayList<ExecutionItemEvent>();
        for(var day:days.entrySet()){
            cumulative.addAll(day.getValue());
            try{validateQuantities(profile,approved,totals(cumulative,scopeHash));}
            catch(com.winh.workplan.iam.shared.DomainException e){throw conflict(day.getKey()+" 的数量顺序不成立："+e.getMessage());}
        }
    }
    record Totals(BigDecimal received,BigDecimal installed,BigDecimal accepted,BigDecimal pending,BigDecimal needsReview){}
}
