package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryScopes.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.winh.workplan.delivery.DeliveryConfigurationDirectory.PublishedConfiguration;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Component;

/** Candidate graph validation never writes effective delivery objects. */
@Component
class DeliveryScopeRules {
    private final DeliveryStore s;
    DeliveryScopeRules(DeliveryStore s){this.s=s;}
    Draft draft(DeliveryScopeChange d){return s.codec.read(d.draftJson,Draft.class);}
    Snapshot base(DeliveryScopeChange d){return s.codec.read(d.baseSnapshotJson,Snapshot.class);}
    String baseHash(DeliveryCase c,Snapshot b){
        return s.codec.hash(Arrays.asList(c.baselineVersion,b.header(),b.template(),b.policy(),b.objects(),b.resources()));
    }
    Snapshot candidate(DeliveryScopeChange d){
        var b=base(d);var edits=draft(d);
        var objects=new LinkedHashMap<UUID,ObjectFact>();b.objects().forEach(o->objects.put(o.id(),o));
        edits.objects().forEach(e->objects.put(e.proposed().id(),e.proposed()));
        var resources=new LinkedHashMap<UUID,ResourceFact>();b.resources().forEach(r->resources.put(r.id(),r));
        for(var e:edits.resources()){
            var r=e.proposed();resources.put(r.id(),e.releaseRequested()?new ResourceFact(r.id(),r.version(),r.request(),"REVOKED",r.commitment(),r.committedBy(),r.committedAt(),r.preparedBy(),r.overlapHash()):r);
        }
        return new Snapshot(b.caseId(),b.projectId(),b.caseVersion(),b.header(),d.preparedBy,b.handover(),b.template(),
            d.policyJson==null?b.policy():s.codec.read(d.policyJson,PublishedConfiguration.class),List.copyOf(objects.values()),List.copyOf(resources.values()),b.findings());
    }
    List<String> staleProblems(SessionPrincipal actor,DeliveryCase c,DeliveryScopeChange d,boolean includeWork){
        var problems=new ArrayList<String>();var live=s.snapshot(c);
        if(!d.baseHash.equals(baseHash(c,live)))problems.add("当前基线或责任已变化，请撤回冲突项并明确更新引用依据。");
        if(includeWork)for(var e:draft(d).objects())if(e.workVersion()!=null){
            try{var w=s.work.require(actor,c.projectId,e.proposed().id());if(w.version()!=e.workVersion()||!"OPEN".equals(w.status()))problems.add(e.proposed().content().title()+"：原工作包执行或责任版本已变化。");}
            catch(DomainException ex){problems.add("原工作包当前不可完整核验。");}
        }
        return problems;
    }
    void requireFresh(SessionPrincipal actor,DeliveryCase c,DeliveryScopeChange d,boolean includeWork){
        var problems=staleProblems(actor,c,d,includeWork);if(!problems.isEmpty())throw conflict(problems.getFirst());
    }
    void reference(Snapshot b,UUID id,String kind){
        if(id==null)return;
        var o=b.objects().stream().filter(x->x.id().equals(id)&&x.kind().equals(kind)&&!x.archived()).findFirst()
            .orElseThrow(()->invalid("reference","关联对象须为本提案或当前项目中的有效同类对象。"));
        if("STAGE".equals(kind)&&!o.content().stage().applicable())throw invalid("stageId","请关联适用阶段。");
    }
    void references(SessionPrincipal actor,DeliveryCase c,Snapshot b,Content content){
        switch(content.kind()){
            case "STAGE"->{var x=content.stage();optionalMember(c,x.ownerId());x.predecessorIds().forEach(id->reference(b,id,"STAGE"));x.parallelIds().forEach(id->reference(b,id,"STAGE"));}
            case "MILESTONE"->{var x=content.milestone();optionalMember(c,x.ownerId());reference(b,x.stageId(),"STAGE");if(x.contractNodeId()!=null)s.contracts.requireNode(actor,c.projectId,x.contractNodeId());}
            case "ITEM"->{var x=content.item();reference(b,x.stageId(),"STAGE");reference(b,x.workPackageId(),"WORK_PACKAGE");reference(b,x.milestoneId(),"MILESTONE");}
            case "WORK_PACKAGE"->{var x=content.workPackage();s.member(c.projectId,x.ownerId());s.member(c.projectId,x.verifierId());reference(b,x.stageId(),"STAGE");x.itemIds().forEach(id->reference(b,id,"ITEM"));x.milestoneIds().forEach(id->reference(b,id,"MILESTONE"));}
            case "PLAN"->{var x=content.plan();reference(b,x.stageId(),"STAGE");reference(b,x.workPackageId(),"WORK_PACKAGE");x.dependsOnIds().forEach(id->reference(b,id,"PLAN"));}
            case "BUDGET"->{var x=content.budget();x.authorizedStageIds().forEach(id->reference(b,id,"STAGE"));for(var l:x.lines()){
                reference(b,l.stageId(),"STAGE");reference(b,l.workPackageId(),"WORK_PACKAGE");reference(b,l.itemId(),"ITEM");
                if(l.resourceRequestId()!=null&&b.resources().stream().noneMatch(r->r.id().equals(l.resourceRequestId())&&!"REVOKED".equals(r.status())))throw invalid("resourceRequestId","预算须关联本提案有效的资源请求。");
            }}
            default->throw invalid("content","未注册的对象类型。");
        }
    }
    List<String> problems(SessionPrincipal actor,DeliveryCase c,DeliveryScopeChange d){
        var b=candidate(d);var problems=new ArrayList<String>();
        var edits=draft(d);
        if(edits.objects().isEmpty()&&edits.resources().isEmpty()&&d.policyJson==null)problems.add("请先维护本次需要调整的范围。");
        problems.addAll(DeliveryRules.stageProblems(b.objects(),b.template()==null?null:b.template().template()));
        problems.addAll(DeliveryRules.planProblems(b.objects()));problems.addAll(DeliveryRules.scopeProblems(b.objects()));
        problems.addAll(DeliveryRules.budgetProblems(b.objects(),b.resources(),LocalDate.now()));
        problems.addAll(s.teamProblems(c,b,false));problems.addAll(s.authorityProblems(c,b));
        try{var source=s.handover.requireCurrentPackage(actor,c.projectId);if(!source.id().equals(b.handover().id())||!source.hash().equals(b.handover().hash()))problems.add("当前移交商务依据已变化，请先核对范围来源。");}
        catch(DomainException e){problems.add("当前移交商务依据无法完整核验。");}
        for(var e:edits.objects())if(!e.proposed().archived()){
            try{references(actor,c,b,e.proposed().content());}catch(DomainException ex){problems.add(ex.getMessage());}
        }
        var completed=s.work.completedPackageIds(c.projectId);
        for(var r:b.resources())if(!"REVOKED".equals(r.status())&&!completed.contains(r.request().workPackageId())){
            if(b.objects().stream().noneMatch(o->o.id().equals(r.request().workPackageId())&&!o.archived()&&"WORK_PACKAGE".equals(o.kind())))problems.add("仍有资源指向已停用工作包，请一并处理撤回。");
            if(r.commitment()!=null&&peak(b,r).compareTo(r.commitment().dailyCapacity())>0
                &&(!"RESOLVED".equals(r.status())||!hash(b,r).equals(r.overlapHash())))problems.add("合并后的资源投入超过已签认容量，请重新协调。");
        }
        for(var e:edits.resources()){
            var r=e.proposed();if(e.releaseRequested()&&!"REVOKED".equals(r.status()))problems.add("撤回原资源尚未获得指定承诺人的确认。");
            if(!e.releaseRequested()&&!Set.of("COMMITTED","RESOLVED").contains(r.status()))problems.add("新增或调整的资源尚未完成指定人签认。");
            if(!s.allowsPerson(r.request().committerId(),"DG2_RESOURCE_COMMIT",c.projectId))problems.add("资源签认人的当前部门承诺权限已失效。");
            try{s.member(c.projectId,r.request().personId());s.requireCommitterOrganization(r.request());}catch(DomainException ex){problems.add("资源签认的人员或部门范围已变化。");}
        }
        for(var f:s.snapshot(c).findings())if(f.blocking()&&!"CLOSED".equals(f.status()))problems.add("当前仍有未关闭的阻断遗留："+f.finding().title());
        return problems.stream().distinct().toList();
    }
    List<Overlap> overlaps(SessionPrincipal actor,Snapshot b,ResourceFact target){
        return allocations(b,target).stream().map(a->{
            if(a.projectId().equals(b.projectId()))return new Overlap(a.id(),a.projectId(),"本项目拟生效资源",a.request().startsOn(),a.request().endsOn(),a.request().dailyHours(),"PROPOSED");
            try{var p=s.projects.requireReadable(actor,a.projectId(),"DG2_READ");return new Overlap(a.id(),a.projectId(),p.name(),a.request().startsOn(),a.request().endsOn(),a.request().dailyHours(),"COMMITTED");}
            catch(DomainException e){return new Overlap(null,null,"其他项目的已承诺资源",a.request().startsOn(),a.request().endsOn(),a.request().dailyHours(),"COMMITTED");}
        }).toList();
    }
    BigDecimal peak(Snapshot b,ResourceFact target){
        var points=new TreeMap<LocalDate,BigDecimal>();var t=target.request();range(points,t.startsOn(),t.endsOn(),t.dailyHours());
        for(var a:allocations(b,target)){var r=a.request();range(points,r.startsOn().isBefore(t.startsOn())?t.startsOn():r.startsOn(),r.endsOn().isAfter(t.endsOn())?t.endsOn():r.endsOn(),r.dailyHours());}
        var used=BigDecimal.ZERO;var peak=used;for(var delta:points.values()){used=used.add(delta);peak=peak.max(used);}return peak;
    }
    String hash(Snapshot b,ResourceFact target){return s.codec.hash(allocations(b,target).stream().sorted(Comparator.comparing(Allocation::id))
        .map(a->List.of(a.id().toString(),a.request().startsOn().toString(),a.request().endsOn().toString(),a.request().dailyHours().stripTrailingZeros().toPlainString())).toList());}
    private record Allocation(UUID id,UUID projectId,ResourceRequest request) {}
    private List<Allocation> allocations(Snapshot b,ResourceFact target){
        var t=target.request();var allocations=new ArrayList<Allocation>();
        for(var r:s.resources.findAllByPersonIdAndStartsOnLessThanEqualAndEndsOnGreaterThanEqual(t.personId(),t.endsOn(),t.startsOn()))
            if(!r.projectId.equals(b.projectId())&&Set.of("COMMITTED","RESOLVED").contains(r.status))allocations.add(new Allocation(r.id,r.projectId,s.codec.read(r.requestJson,ResourceRequest.class)));
        for(var r:b.resources())if(!r.id().equals(target.id())&&!"REVOKED".equals(r.status())&&r.request().personId().equals(t.personId())
            &&!r.request().startsOn().isAfter(t.endsOn())&&!r.request().endsOn().isBefore(t.startsOn()))allocations.add(new Allocation(r.id(),b.projectId(),r.request()));
        return allocations;
    }
    private void range(TreeMap<LocalDate,BigDecimal> points,LocalDate start,LocalDate end,BigDecimal hours){points.merge(start,hours,BigDecimal::add);points.merge(end.plusDays(1),hours.negate(),BigDecimal::add);}
    private void optionalMember(DeliveryCase c,UUID id){if(id!=null)s.member(c.projectId,id);}
}
