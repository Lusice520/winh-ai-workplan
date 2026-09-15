package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.winh.workplan.delivery.configuration.ConfigurationDefinitions;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Stream;

final class DeliveryRules {
    static final Set<String> BLOCKING_IMPACTS = Set.of("LEGAL", "SCOPE", "RESPONSIBILITY", "INITIAL_RESOURCE", "KEY_DATE", "BUDGET");
    private DeliveryRules() {}

    static Header header(Header h) {
        if (h == null || h.projectManagerId() == null) throw invalid("projectManagerId", "请明确项目经理。");
        return new Header(h.projectManagerId(), h.technicalLeadId(),
            choice(h.projectType(), "projectType", "SYSTEM_INTEGRATION", "TECHNICAL_SERVICE", "EQUIPMENT"),
            choice(h.riskLevel(), "riskLevel", "LOW", "MEDIUM", "HIGH"),
            optional(h.scopeAcceptance(), "scopeAcceptance", 4000), optional(h.acceptanceCriteria(), "acceptanceCriteria", 4000),
            optional(h.timeConstraints(), "timeConstraints", 4000), optional(h.handoverFollowups(), "handoverFollowups", 4000));
    }
    static Content content(Content c) {
        if (c == null || Stream.of(c.stage(), c.milestone(), c.item(), c.workPackage(), c.plan(), c.budget()).filter(Objects::nonNull).count() != 1)
            throw invalid("content", "每次仅维护一种已注册的交付对象。");
        return switch (c.kind()) {
            case "STAGE" -> {
                var s=c.stage(); dates(s.startsOn(),s.endsOn(),"stage");
                yield Content.of(new Stage(optional(s.templateCode(),"templateCode",40),required(s.title(),"title",80),
                    bool(s.applicable()),optional(s.applicabilityReason(),"applicabilityReason",2000),optional(s.differenceReason(),"differenceReason",2000),
                    s.ownerId(),s.startsOn(),s.endsOn(),ids(s.predecessorIds()),ids(s.parallelIds()),bool(s.focus()),
                    lines(s.actions()),lines(s.deliverables()),optional(s.completionCriteria(),"completionCriteria",2000)));
            }
            case "MILESTONE" -> {
                var m=c.milestone();
                yield new Content(null,new Milestone(required(m.title(),"title",160),choice(m.kind(),"kind","CONTRACT","ACCEPTANCE","DELIVERY"),
                    m.dueDate(),m.ownerId(),m.stageId(),m.contractNodeId(),optional(m.sourceNote(),"sourceNote",2000),
                    optional(m.acceptanceCriteria(),"acceptanceCriteria",4000)),null,null,null,null);
            }
            case "ITEM" -> {
                var i=c.item(); if(i.quantity()!=null && amount(i.quantity(),"quantity").signum()<=0)throw invalid("quantity","数量须大于零。");
                yield new Content(null,null,new Item(required(i.title(),"title",160),choice(i.category(),"category","EQUIPMENT","MATERIAL","DELIVERABLE"),
                    optional(i.specification(),"specification",2000),i.quantity(),optional(i.unit(),"unit",24),optional(i.acceptanceScope(),"acceptanceScope",4000),
                    i.stageId(),i.workPackageId(),i.milestoneId(),bool(i.procurementNeeded()),optional(i.procurementNote(),"procurementNote",2000)),null,null,null);
            }
            case "WORK_PACKAGE" -> {
                var w=c.workPackage(); dates(w.startsOn(),w.endsOn(),"workPackage");
                if(w.ownerId()==null || w.verifierId()==null || w.ownerId().equals(w.verifierId()))throw invalid("verifierId","工作包须明确不同的负责人和验证人。");
                yield new Content(null,null,null,new WorkPackage(required(w.title(),"title",160),required(w.scope(),"scope",8000),
                    optional(w.deliverables(),"deliverables",4000),optional(w.acceptanceCriteria(),"acceptanceCriteria",4000),w.ownerId(),w.verifierId(),
                    w.stageId(),w.startsOn(),w.endsOn(),optional(w.resourceNotes(),"resourceNotes",4000),ids(w.itemIds()),ids(w.milestoneIds())),null,null);
            }
            case "PLAN" -> {
                var p=c.plan();dates(p.startsOn(),p.endsOn(),"plan");dates(p.deliveryWindowStart(),p.deliveryWindowEnd(),"deliveryWindow");
                yield new Content(null,null,null,null,new Plan(required(p.title(),"title",160),choice(p.kind(),"kind","MASTER","WORK_PACKAGE"),
                    p.stageId(),p.workPackageId(),p.startsOn(),p.endsOn(),p.deliveryWindowStart(),p.deliveryWindowEnd(),
                    ids(p.dependsOnIds()),optional(p.resourceConstraints(),"resourceConstraints",4000)),null);
            }
            case "BUDGET" -> {
                var b=c.budget();var items=new ArrayList<BudgetLine>();
                if(b.lines()!=null){
                    if(b.lines().size()>100)throw invalid("lines","单份预算最多 100 行。");
                    for(var l:b.lines()){
                        if(l==null)throw invalid("lines","预算行不能为空。");
                        items.add(new BudgetLine(required(l.title(),"title",160),choice(l.category(),"category","PERSONNEL","PROCUREMENT","SUBCONTRACT","TRAVEL","OTHER"),
                            amount(l.amount(),"amount"),l.stageId(),l.workPackageId(),l.resourceRequestId(),l.itemId(),optional(l.basis(),"basis",4000)));
                    }
                }
                yield new Content(null,null,null,null,null,new Budget(choice(b.mode(),"mode","FULL","PHASED"),optional(b.scope(),"scope",4000),
                    ids(b.authorizedStageIds()),b.authorizedCap()==null?null:amount(b.authorizedCap(),"authorizedCap"),b.expiresOn(),b.nextCompletionOn(),
                    optional(b.remainingScope(),"remainingScope",4000),List.copyOf(items)));
            }
            default -> throw invalid("content","未注册的对象类型。");
        };
    }
    static ResourceRequest resource(ResourceRequest r) {
        if(r==null || r.workPackageId()==null || r.personId()==null || r.committerId()==null)throw invalid("resource","请明确工作包、资源人员与承诺人。");
        requireDates(r.startsOn(),r.endsOn(),"resource");
        return new ResourceRequest(r.workPackageId(),r.personId(),r.committerId(),r.startsOn(),r.endsOn(),
            hours(r.dailyHours(),false),required(r.requestNote(),"requestNote",4000));
    }
    static Commitment commitment(Commitment c) {
        if(c==null)throw invalid("commitment","请填写签认内容。");
        return new Commitment(hours(c.dailyCapacity(),true),required(c.conclusion(),"conclusion",4000),
            optional(c.impact(),"impact",4000),optional(c.escalationPath(),"escalationPath",2000));
    }
    static Finding finding(Finding f) {
        if(f==null || f.ownerId()==null || f.verifierId()==null || f.escalationOwnerId()==null || f.dueDate()==null)
            throw invalid("finding","请明确责任人、独立验证人、期限与升级责任人。");
        if(f.ownerId().equals(f.verifierId()))throw invalid("verifierId","遗留事项须由不同人员验证。");
        return new Finding(required(f.title(),"title",160),choice(f.kind(),"kind","RISK","GAP","DEPENDENCY"),
            choice(f.impactCategory(),"impactCategory","LEGAL","SCOPE","RESPONSIBILITY","INITIAL_RESOURCE","KEY_DATE","BUDGET","DETAIL"),
            choice(f.riskLevel(),"riskLevel","LOW","MEDIUM","HIGH"),f.ownerId(),f.verifierId(),f.dueDate(),
            required(f.closingCriteria(),"closingCriteria",4000),required(f.impactScope(),"impactScope",4000),
            f.escalationOwnerId(),required(f.escalationPath(),"escalationPath",2000));
    }
    static BigDecimal budgetTotal(List<ObjectFact> objects) {
        return objects.stream().filter(o->!o.archived()&&"BUDGET".equals(o.kind())).flatMap(o->o.content().budget().lines().stream())
            .map(BudgetLine::amount).reduce(BigDecimal.ZERO,BigDecimal::add);
    }
    static List<String> stageProblems(List<ObjectFact> objects,ConfigurationDefinitions.Template template) {
        var problems=new ArrayList<String>();var stages=selected(objects,"STAGE");var active=new LinkedHashMap<UUID,Stage>();var codes=new HashSet<String>();
        if(template==null)problems.add("尚未选择已发布的阶段模板。");
        if(stages.isEmpty())problems.add("请至少登记一个适用阶段。");
        for(var o:stages){
            var s=o.content().stage();String name=s.title();
            ConfigurationDefinitions.Stage original=template==null?null:template.stages().stream().filter(t->t.code().equals(s.templateCode())).findFirst().orElse(null);
            if(s.templateCode()!=null && (!codes.add(s.templateCode())||original==null))problems.add(name+"：模板代码重复或不存在。");
            if(original==null && blank(s.differenceReason()))problems.add(name+"：新增阶段需差异理由。");
            if(original!=null && "REQUIRED".equals(original.applicability())&&!s.applicable())problems.add(name+"：必选阶段不能跳过。");
            if((!s.applicable()||original!=null&&"CONDITIONAL".equals(original.applicability()))&&blank(s.applicabilityReason()))problems.add(name+"：请填写适用或跳过的判定依据。");
            if(!s.applicable())continue;
            active.put(o.id(),s);
            if(s.ownerId()==null||s.startsOn()==null||s.endsOn()==null)problems.add(name+"：责任人与计划日期尚未齐备。");
            if(s.actions().isEmpty()||s.deliverables().isEmpty()||blank(s.completionCriteria()))problems.add(name+"：动作、成果和完成条件尚未齐备。");
        }
        if(template!=null)for(var original:template.stages())if(!codes.contains(original.code()))problems.add(original.name()+"：模板阶段缺失，请逐项说明适用性。");
        if(active.values().stream().filter(Stage::focus).count()!=1)problems.add("请明确且仅明确一个适用阶段作为当前重点。");
        for(var entry:active.entrySet()){
            var s=entry.getValue();
            for(UUID id:s.predecessorIds()){
                var previous=active.get(id);
                if(previous==null||id.equals(entry.getKey()))problems.add(s.title()+"：前置阶段不存在、已跳过或引用自身。");
                else if(previous.endsOn()!=null && s.startsOn()!=null && previous.endsOn().isAfter(s.startsOn()))problems.add(s.title()+"：前置阶段晚于本阶段开始。");
            }
            for(UUID id:s.parallelIds()){
                if(!active.containsKey(id)||id.equals(entry.getKey()))problems.add(s.title()+"：并行阶段引用无效。");
                else if(reachable(entry.getKey(),id,active,Stage::predecessorIds,new HashSet<>())
                    ||reachable(id,entry.getKey(),active,Stage::predecessorIds,new HashSet<>()))problems.add(s.title()+"：并行关系与前置顺序冲突。");
            }
        }
        if(cyclic(active,Stage::predecessorIds))problems.add("阶段前置关系存在循环。");
        return List.copyOf(problems);
    }
    static List<String> planProblems(List<ObjectFact> objects) {
        var problems=new ArrayList<String>();var stages=byKind(objects,"STAGE");var packages=byKind(objects,"WORK_PACKAGE");
        var plans=byKind(objects,"PLAN");var milestones=byKind(objects,"MILESTONE");
        var masters=plans.values().stream().map(o->o.content().plan()).filter(p->"MASTER".equals(p.kind())).toList();
        if(masters.isEmpty())problems.add("尚无项目主计划。");
        if(milestones.isEmpty())problems.add("尚无合同、验收或关键交付里程碑。");
        for(var o:plans.values()){
            var p=o.content().plan();var stage=stages.get(p.stageId());var w=packages.get(p.workPackageId());
            if(p.startsOn()==null||p.endsOn()==null||p.deliveryWindowStart()==null||p.deliveryWindowEnd()==null||blank(p.resourceConstraints()))problems.add(p.title()+"：日期、交付窗口和资源约束尚未齐备。");
            if(!within(p.deliveryWindowStart(),p.deliveryWindowEnd(),p.startsOn(),p.endsOn()))problems.add(p.title()+"：交付窗口超出本计划。");
            if(stage==null||!stage.content().stage().applicable())problems.add(p.title()+"：尚未关联适用阶段。");
            else if(!within(p.startsOn(),p.endsOn(),stage.content().stage().startsOn(),stage.content().stage().endsOn()))problems.add(p.title()+"：计划超出所属阶段窗口。");
            if("WORK_PACKAGE".equals(p.kind())){
                if(w==null)problems.add(p.title()+"：尚未关联工作包。");
                else if(!Objects.equals(p.stageId(),w.content().workPackage().stageId())||!within(p.startsOn(),p.endsOn(),w.content().workPackage().startsOn(),w.content().workPackage().endsOn()))
                    problems.add(p.title()+"：计划与工作包阶段或日期不一致。");
                if(masters.stream().noneMatch(m->within(p.startsOn(),p.endsOn(),m.startsOn(),m.endsOn())))problems.add(p.title()+"：工作包计划超出主计划窗口。");
            }else if(p.workPackageId()!=null)problems.add(p.title()+"：主计划不能同时作为某工作包计划。");
            for(UUID id:p.dependsOnIds()){
                var prev=plans.get(id);
                if(prev==null||id.equals(o.id()))problems.add(p.title()+"：前置计划引用无效。");
                else if(prev.content().plan().endsOn()!=null&&p.startsOn()!=null&&prev.content().plan().endsOn().isAfter(p.startsOn()))problems.add(p.title()+"：前置计划晚于本计划开始。");
            }
        }
        if(cyclic(plans,o->o.content().plan().dependsOnIds()))problems.add("计划前置关系存在循环。");
        for(var o:packages.values()){
            var w=o.content().workPackage();
            if(plans.values().stream().noneMatch(p->"WORK_PACKAGE".equals(p.content().plan().kind())&&o.id().equals(p.content().plan().workPackageId())))
                problems.add(w.title()+"：尚未编制工作包计划。");
        }
        for(var o:milestones.values()){
            var m=o.content().milestone();var stage=stages.get(m.stageId());
            if(m.dueDate()==null||m.ownerId()==null||blank(m.acceptanceCriteria()))problems.add(m.title()+"：日期、责任人与验收条件尚未齐备。");
            if(m.contractNodeId()==null&&blank(m.sourceNote()))problems.add(m.title()+"：请关联合同节点或说明移交来源。");
            if(stage==null||!stage.content().stage().applicable()||!within(m.dueDate(),m.dueDate(),stage.content().stage().startsOn(),stage.content().stage().endsOn()))
                problems.add(m.title()+"：里程碑不在适用阶段窗口。");
            if(masters.stream().noneMatch(p->within(m.dueDate(),m.dueDate(),p.startsOn(),p.endsOn())))problems.add(m.title()+"：里程碑超出主计划。");
        }
        return List.copyOf(problems);
    }
    static List<String> scopeProblems(List<ObjectFact> objects) {
        var problems=new ArrayList<String>();var items=byKind(objects,"ITEM");var packages=byKind(objects,"WORK_PACKAGE");
        var stages=byKind(objects,"STAGE");var milestones=byKind(objects,"MILESTONE");
        if(items.isEmpty())problems.add("当前已知交付清单为空。");
        if(packages.isEmpty())problems.add("尚无专业工作包。");
        for(var o:items.values()){
            var i=o.content().item();var stage=stages.get(i.stageId());var wp=packages.get(i.workPackageId());var ms=milestones.get(i.milestoneId());
            if(i.quantity()==null||blank(i.unit())||blank(i.specification())||blank(i.acceptanceScope()))problems.add(i.title()+"：规格、数量、单位或验收范围尚未齐备。");
            if(stage==null||!stage.content().stage().applicable()||wp==null||ms==null)problems.add(i.title()+"：阶段、工作包和验收节点尚未齐备。");
            else if(!i.stageId().equals(wp.content().workPackage().stageId())||!i.stageId().equals(ms.content().milestone().stageId())
                    ||!wp.content().workPackage().itemIds().contains(o.id())||!wp.content().workPackage().milestoneIds().contains(ms.id()))
                problems.add(i.title()+"：清单与承担工作包的阶段、清单和验收关系不一致。");
            if(i.procurementNeeded()&&blank(i.procurementNote()))problems.add(i.title()+"：请说明采购需求。");
        }
        for(var o:packages.values()){
            var w=o.content().workPackage();var stage=stages.get(w.stageId());
            if(blank(w.deliverables())||blank(w.acceptanceCriteria())||blank(w.resourceNotes())||w.startsOn()==null||w.endsOn()==null)
                problems.add(w.title()+"：成果、验收、计划窗口或资源要求尚未齐备。");
            if(stage==null||!stage.content().stage().applicable()||!within(w.startsOn(),w.endsOn(),stage.content().stage().startsOn(),stage.content().stage().endsOn()))
                problems.add(w.title()+"：工作包须处于适用阶段窗口。");
            if(w.itemIds().isEmpty()||w.milestoneIds().isEmpty())problems.add(w.title()+"：尚未关联清单及验收里程碑。");
            for(UUID id:w.itemIds())if(!items.containsKey(id)||!o.id().equals(items.get(id).content().item().workPackageId()))problems.add(w.title()+"：清单关联不一致。");
            for(UUID id:w.milestoneIds()){
                var m=milestones.get(id);
                if(m==null||!Objects.equals(w.stageId(),m.content().milestone().stageId())||!within(m.content().milestone().dueDate(),m.content().milestone().dueDate(),w.startsOn(),w.endsOn()))
                    problems.add(w.title()+"：验收里程碑不在工作包窗口或阶段内。");
            }
        }
        return List.copyOf(problems);
    }
    static List<String> budgetProblems(List<ObjectFact> objects,List<ResourceFact> resources,LocalDate today) {
        var problems=new ArrayList<String>();var budgets=selected(objects,"BUDGET");var stages=byKind(objects,"STAGE");var packages=byKind(objects,"WORK_PACKAGE");
        var items=byKind(objects,"ITEM");var resourceIds=new HashMap<UUID,ResourceFact>();resources.forEach(r->resourceIds.put(r.id(),r));
        if(budgets.size()!=1){problems.add("请建立且仅建立一份实施预算。");return problems;}
        var b=budgets.getFirst().content().budget();var authorized=new HashSet<>(b.authorizedStageIds());var covered=new HashSet<UUID>();
        if(blank(b.scope())||b.lines().isEmpty()||budgetTotal(objects).signum()<=0)problems.add("批准范围与预算明细尚未齐备，总额须大于零。");
        for(UUID id:authorized)if(!stages.containsKey(id)||!stages.get(id).content().stage().applicable())problems.add("预算授权阶段无效。");
        if("PHASED".equals(b.mode())){
            if(authorized.isEmpty()||b.authorizedCap()==null||b.expiresOn()==null||b.nextCompletionOn()==null||blank(b.remainingScope()))problems.add("请补齐首批范围、额度、有效截止、后续补齐日及剩余范围。");
            if(b.authorizedCap()!=null&&budgetTotal(objects).compareTo(b.authorizedCap())>0)problems.add("首批预算超过授权上限。");
            if(b.expiresOn()!=null&&b.expiresOn().isBefore(today)||b.nextCompletionOn()!=null&&b.nextCompletionOn().isBefore(today)
                ||b.expiresOn()!=null&&b.nextCompletionOn()!=null&&b.nextCompletionOn().isAfter(b.expiresOn()))problems.add("分阶段授权日期已过期或补齐日在到期之后。");
            for(UUID id:authorized){var s=stages.get(id);if(s!=null&&b.expiresOn()!=null&&s.content().stage().endsOn()!=null&&s.content().stage().endsOn().isAfter(b.expiresOn()))problems.add("首批阶段计划超出授权期限。");}
        } else if(b.authorizedCap()!=null||b.expiresOn()!=null||b.nextCompletionOn()!=null||!authorized.isEmpty()||!blank(b.remainingScope()))
            problems.add("全范围预算不应混填首批授权字段。");
        for(var l:b.lines()){
            var stage=stages.get(l.stageId());var wp=packages.get(l.workPackageId());
            if(stage==null||!stage.content().stage().applicable()||wp==null||!Objects.equals(l.stageId(),wp.content().workPackage().stageId()))problems.add(l.title()+"：预算的阶段或工作包映射无效。");
            else covered.add(l.stageId());
            if("PHASED".equals(b.mode())&&!authorized.contains(l.stageId()))problems.add(l.title()+"：明细超出首批授权阶段。");
            if(blank(l.basis()))problems.add(l.title()+"：缺少预算依据。");
            if(l.resourceRequestId()!=null){
                var r=resourceIds.get(l.resourceRequestId());
                if(r==null||!Objects.equals(l.workPackageId(),r.request().workPackageId())||"REVOKED".equals(r.status())||!"PERSONNEL".equals(l.category()))problems.add(l.title()+"：人员资源映射无效。");
            }
            if(l.itemId()!=null){
                var i=items.get(l.itemId());
                if(i==null||!Objects.equals(l.workPackageId(),i.content().item().workPackageId())||!i.content().item().procurementNeeded()||!"PROCUREMENT".equals(l.category()))problems.add(l.title()+"：采购清单映射无效。");
            }
            if("PERSONNEL".equals(l.category())&&l.resourceRequestId()==null)problems.add(l.title()+"：人员预算请关联资源申请。");
            if("PROCUREMENT".equals(l.category())&&l.itemId()==null)problems.add(l.title()+"：采购预算请关联采购清单项。");
        }
        for(var s:stages.values())if(s.content().stage().applicable()&&("FULL".equals(b.mode())||authorized.contains(s.id()))&&!covered.contains(s.id()))problems.add(s.content().title()+"：批准范围缺少预算覆盖。");
        for(var r:resources){
            var wp=packages.get(r.request().workPackageId());boolean inScope=wp!=null&&("FULL".equals(b.mode())||authorized.contains(wp.content().workPackage().stageId()));
            if(inScope&&!"REVOKED".equals(r.status())&&b.lines().stream().noneMatch(l->r.id().equals(l.resourceRequestId())))problems.add("已知资源需求尚未映射人员预算。");
        }
        for(var i:items.values())if(i.content().item().procurementNeeded()&&("FULL".equals(b.mode())||authorized.contains(i.content().item().stageId()))
                &&b.lines().stream().noneMatch(l->i.id().equals(l.itemId())))problems.add(i.content().title()+"：采购需求尚未映射预算。");
        return List.copyOf(problems);
    }
    static List<ObjectFact> selected(List<ObjectFact> objects,String kind){return objects.stream().filter(o->!o.archived()&&kind.equals(o.kind())).toList();}
    static Map<UUID,ObjectFact> byKind(List<ObjectFact> objects,String kind){var result=new LinkedHashMap<UUID,ObjectFact>();selected(objects,kind).forEach(o->result.put(o.id(),o));return result;}
    static boolean within(LocalDate start,LocalDate end,LocalDate outerStart,LocalDate outerEnd){
        return start!=null&&end!=null&&outerStart!=null&&outerEnd!=null&&!start.isBefore(outerStart)&&!end.isAfter(outerEnd)&&!end.isBefore(start);
    }
    static boolean blank(String s){return s==null||s.isBlank();}
    static boolean bool(Boolean b){return Boolean.TRUE.equals(b);}
    private static BigDecimal hours(BigDecimal b,boolean allowZero){
        if(b==null||b.scale()>2||b.signum()<0||(!allowZero&&b.signum()==0)||b.compareTo(new BigDecimal("24"))>0)throw invalid("hours","每日工时须在 0 至 24 内，需求须大于零，最多两位小数。");return b;
    }
    private static List<UUID> ids(List<UUID> list){
        if(list==null)return List.of();if(list.size()>100||list.stream().anyMatch(Objects::isNull)||new HashSet<>(list).size()!=list.size())throw invalid("references","关联最多 100 项且不能包含空值或重复值。");return List.copyOf(list);
    }
    private static List<String> lines(List<String> list){
        if(list==null)return List.of();if(list.size()>30)throw invalid("lines","最多填写 30 条。");return list.stream().map(s->required(s,"lines",300)).toList();
    }
    private static void dates(LocalDate start,LocalDate end,String field){
        if(start!=null&&end!=null&&end.isBefore(start))throw invalid(field,"结束日期不能早于开始日期。");
        for(var d:Arrays.asList(start,end))if(d!=null&&(d.getYear()<2000||d.getYear()>2200))throw invalid(field,"请使用 2000 至 2200 年间的业务日期。");
    }
    private static void requireDates(LocalDate start,LocalDate end,String field){dates(start,end,field);if(start==null||end==null)throw invalid(field,"请填写完整日期窗口。");}
    private static <T> boolean reachable(UUID from,UUID target,Map<UUID,T> nodes,Function<T,List<UUID>> edges,Set<UUID> seen){
        if(!seen.add(from)||!nodes.containsKey(from))return false;
        for(UUID next:edges.apply(nodes.get(from)))if(next.equals(target)||reachable(next,target,nodes,edges,seen))return true;return false;
    }
    private static <T> boolean cyclic(Map<UUID,T> nodes,Function<T,List<UUID>> edges){return nodes.keySet().stream().anyMatch(id->reachable(id,id,nodes,edges,new HashSet<>()));}
}
