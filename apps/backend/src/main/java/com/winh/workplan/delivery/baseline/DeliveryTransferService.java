package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryTransfers.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.project.ProjectDirectory.RoleChange;
import com.winh.workplan.project.ProjectResponsibilityContributor;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
class DeliveryTransferService {
    final DeliveryStore s;
    final DeliveryTransferRepository transfers;
    final List<ProjectResponsibilityContributor> contributors;
    DeliveryTransferService(DeliveryStore s,DeliveryTransferRepository transfers,List<ProjectResponsibilityContributor> contributors){this.s=s;this.transfers=transfers;this.contributors=contributors;}
    List<View> list(SessionPrincipal actor,UUID projectId){
        s.projects.requireReadable(actor,projectId,"DG2_READ");var c=s.require(projectId);
        var readable=readableRelated(actor,projectId);return transfers.findAllByCaseIdOrderByCreatedAtDesc(c.id).stream().map(t->view(t,readable)).toList();
    }
    Preview preview(SessionPrincipal actor,UUID projectId,UUID from,UUID to){
        s.projects.requireReadable(actor,projectId,"DG2_EDIT");s.projects.requireReadable(actor,projectId,"PROJECT_MEMBER_MANAGE");
        var c=s.require(projectId);s.manager(actor,c);approved(c);return build(actor,c,from,to);
    }
    @Transactional View create(SessionPrincipal actor,UUID projectId,Create input){
        var c=s.writable(actor,projectId,"DG2_EDIT");s.manager(actor,c);approved(c);
        var readable=readableRelated(actor,projectId);
        var res=s.access.reserve(actor,"dg2.transfer.create:"+c.id,input.requestId(),input);
        if(res.replayed())return view(require(c,res.targetId()),readable);version(c,input.version());
        var preview=preview(actor,projectId,input.fromId(),input.toId());
        if(!preview.hash().equals(input.mappingHash()))throw conflict("交接预览已变化，请重新核对未结职责。");
        if(transfers.findAllByCaseIdOrderByCreatedAtDesc(c.id).stream().anyMatch(t->t.fromId.equals(input.fromId())&&Set.of("PENDING","ACCEPTED").contains(t.status)))throw conflict("此人员已有待处理交接，请先完成或撤销原交接。");
        if(input.fromRoles()==null||input.toRoles()==null||input.toRoles().isEmpty())throw invalid("permissions","请明确原、新两名成员的角色；接任成员至少保留一个项目角色。");
        var permissions=new Permissions(List.of(new RoleChange(input.toId(),preview.mapping().to().version(),input.toRoles()),new RoleChange(input.fromId(),preview.mapping().from().version(),input.fromRoles())));
        s.projects.validateRoleChanges(actor,projectId,permissions.items());
        var t=new DeliveryTransfer();t.caseId=c.id;t.fromId=input.fromId();t.toId=input.toId();t.mappingJson=s.codec.write(preview.mapping());t.mappingHash=preview.hash();
        t.permissionsJson=s.codec.write(permissions);t.basis=required(input.basis(),"basis",2000);t.submittedBy=actor.accountId();transfers.saveAndFlush(t);s.touch(c);
        s.history.record(c.id,"DELIVERY_INITIATION","DELIVERY_TRANSFER_PROPOSED","发起责任交接，当前有效责任保持不变。",actor.accountId());
        s.access.complete(res,t.id);return view(t,readable);
    }
    @Transactional View decide(SessionPrincipal actor,UUID projectId,UUID id,Decide input){
        var c=s.writable(actor,projectId,"DG2_READ");approved(c);var t=require(c,id);
        var readable=readableRelated(actor,projectId);
        String action=choice(input.action(),"action","ACCEPT","RETURN","APPLY","CANCEL");
        if(Set.of("ACCEPT","RETURN").contains(action)){
            if(!actor.accountId().equals(t.toId))throw conflict("请由本交接指定的新责任人确认接收或退回。");
        }else{s.projects.requireWritable(actor,projectId,"DG2_EDIT");s.manager(actor,c);}
        var res=s.access.reserve(actor,"dg2.transfer.decide:"+t.id,input.requestId(),input);
        if(res.replayed())return view(t,readable);version(t,input.version());
        if(!Set.of("PENDING","ACCEPTED").contains(t.status))throw conflict("此交接已有最终结论，历史不可覆盖。");
        String note=required(input.note(),"note",4000);
        if("CANCEL".equals(action)){t.status="CANCELLED";t.decidedBy=actor.accountId();t.decisionNote=note;}
        else if("RETURN".equals(action)){t.status="RETURNED";t.decidedBy=actor.accountId();t.decisionNote=note;}
        else {
            var mapping=fresh(c,t);
            if("ACCEPT".equals(action)){
                if(!"PENDING".equals(t.status))throw conflict("已确认接收；有变化请退回后重新发起。");
                t.status="ACCEPTED";t.acceptedBy=actor.accountId();t.acceptedAt=Instant.now();t.acceptanceNote=note;
            }else{
                if(!"ACCEPTED".equals(t.status)||!t.toId.equals(t.acceptedBy))throw conflict("请先由新责任人确认接收。");
                apply(actor,c,t,mapping);t.status="APPLIED";t.decidedBy=actor.accountId();t.effectiveAt=Instant.now();t.decisionNote=note;
            }
        }
        t.touch();transfers.flush();s.touch(c);
        s.history.record(c.id,"DELIVERY_INITIATION","DELIVERY_TRANSFER_"+t.status,"责任交接"+switch(t.status){case "ACCEPTED"->"已由新责任人接收，等待资源重签和最终生效。";case "APPLIED"->"已统一生效，原批准责任快照保留。";case "RETURNED"->"已退回，原责任未改变。";default->"已撤销，原责任未改变。";},actor.accountId());
        s.access.complete(res,t.id);return view(t,readable);
    }
    @Transactional View sign(SessionPrincipal actor,UUID projectId,UUID id,Sign input){
        var c=s.writable(actor,projectId,"DG2_RESOURCE_COMMIT");approved(c);var t=require(c,id);
        var readable=readableRelated(actor,projectId);
        var res=s.access.reserve(actor,"dg2.transfer.sign:"+t.id,input.requestId(),input);
        if(res.replayed())return view(t,readable);version(t,input.version());
        if(!"ACCEPTED".equals(t.status))throw conflict("新责任人接收后才能重签资源。");
        var mapping=fresh(c,t);var move=resource(mapping,input.resourceId());var request=move.after();
        if(!request.committerId().equals(actor.accountId()))throw conflict("请由交接后请求指定的资源承诺人签认。");
        s.requireCommitterOrganization(request);s.accounts.lockForResourceCommit(request.personId());
        String decision=choice(input.decision(),"decision","COMMITTED","CONFLICT","RESOLVED");
        var commitment=DeliveryRules.commitment(input.commitment());var current=signatures(t);var prior=current.stream().filter(x->x.resourceId().equals(input.resourceId())).findFirst();
        if("COMMITTED".equals(decision)&&peak(mapping,move).compareTo(commitment.dailyCapacity())>0)throw conflict("接任后的重叠投入超过可用容量，请先记录冲突并协调。");
        if("RESOLVED".equals(decision)){
            if(prior.isEmpty()||!Set.of("CONFLICT","COMMITTED","RESOLVED").contains(prior.get().status()))throw conflict("请先明确记录资源冲突。");
            required(commitment.impact(),"impact",4000);required(commitment.escalationPath(),"escalationPath",2000);
        }
        var all=new ArrayList<>(current.stream().filter(x->!x.resourceId().equals(input.resourceId())).toList());
        all.add(new ResourceSignature(input.resourceId(),decision,commitment,actor.accountId(),Instant.now(),overlapHash(mapping,move)));
        all.sort(Comparator.comparing(ResourceSignature::resourceId));t.signaturesJson=s.codec.write(new Signatures(all));t.touch();transfers.flush();s.touch(c);
        s.history.record(c.id,"DELIVERY_INITIATION","DELIVERY_TRANSFER_RESOURCE_SIGNED","指定承诺人签认交接后的资源安排，原请求尚未改写。",actor.accountId());
        s.access.complete(res,t.id);return view(t,readable);
    }
    Overlaps overlaps(SessionPrincipal actor,UUID projectId,UUID id,UUID resourceId){
        s.projects.requireReadable(actor,projectId,"DG2_READ");var c=s.require(projectId);var t=require(c,id);var mapping=mapping(t);var move=resource(mapping,resourceId);
        if(!List.of(c.managerId,t.fromId,t.toId,move.after().committerId()).contains(actor.accountId()))throw conflict("此资源核验仅供本次交接责任人和指定承诺人查看。");
        var rows=allocations(mapping,move,true).stream().map(a->{
            try{var p=s.projects.requireReadable(actor,a.projectId(),"DG2_READ");return new Allocation(a.resourceId(),a.projectId(),p.name(),a.startsOn(),a.endsOn(),a.dailyHours(),a.proposed());}
            catch(DomainException e){return new Allocation(null,null,"其他项目的已承诺资源",a.startsOn(),a.endsOn(),a.dailyHours(),a.proposed());}
        }).toList();
        return new Overlaps(move.after(),peak(mapping,move),rows);
    }
    private Preview build(SessionPrincipal actor,DeliveryCase c,UUID from,UUID to){
        if(from==null||to==null||from.equals(to))throw invalid("toId","请选择两名不同的有效项目成员。");s.member(c.projectId,from);s.member(c.projectId,to);
        var snap=s.snapshot(c);var completed=s.work.completedPackageIds(c.projectId);var objects=new ArrayList<ObjectMove>();
        for(var o:snap.objects())if(!o.archived()&&!completed.contains(o.id())&&(o.content().stage()==null||o.content().stage().applicable())){
            var moved=DeliveryTransferRules.move(o.content(),from,to);if(!moved.equals(o.content()))objects.add(new ObjectMove(o,moved));
        }
        objects.sort(Comparator.comparing(o->o.before().id()));var resourceMoves=new ArrayList<ResourceMove>();
        for(var r:snap.resources())if(!"REVOKED".equals(r.status())&&!r.request().endsOn().isBefore(LocalDate.now())
                &&(r.request().personId().equals(from)||r.request().committerId().equals(from))){
            var moved=DeliveryTransferRules.move(r.request(),from,to,LocalDate.now());s.requireCommitterOrganization(moved);
            if(!s.allowsPerson(moved.committerId(),"DG2_RESOURCE_COMMIT",c.projectId))throw conflict("接任资源承诺人缺少当前部门承诺权限，请先按正常授权流程配置。");
            resourceMoves.add(new ResourceMove(r,moved));
        }
        resourceMoves.sort(Comparator.comparing(r->r.before().id()));var findingMoves=new ArrayList<FindingMove>();
        for(var f:snap.findings())if(!"CLOSED".equals(f.status())){
            var moved=DeliveryTransferRules.move(f.finding(),from,to);
            if(!moved.equals(f.finding())){
                if(moved.verifierId().equals(f.evidenceBy()))throw conflict(f.finding().title()+"：证据提交人不能接任独立验证。");
                findingMoves.add(new FindingMove(f,moved));
            }
        }
        findingMoves.sort(Comparator.comparing(f->f.before().id()));
        var related=contributors.stream().flatMap(p->p.responsibilities(actor,c.projectId,from,to).stream()).sorted(Comparator.comparing(ProjectResponsibilityContributor.Responsibility::domain).thenComparing(ProjectResponsibilityContributor.Responsibility::objectId)).toList();
        var header=DeliveryTransferRules.move(snap.header(),from,to);
        if(header.equals(snap.header())&&objects.isEmpty()&&resourceMoves.isEmpty()&&findingMoves.isEmpty()&&related.isEmpty())throw conflict("此人员没有需要交接的当前职责。");
        var mapping=new Mapping(s.projects.memberRoles(actor,c.projectId,from),s.projects.memberRoles(actor,c.projectId,to),snap.header(),header,objects,resourceMoves,findingMoves,related);
        return new Preview(s.codec.hash(mapping),mapping);
    }
    private Mapping fresh(DeliveryCase c,DeliveryTransfer t){
        var owner=principal(t.submittedBy);
        if(!c.managerId.equals(t.submittedBy)||!s.allowsPerson(t.submittedBy,"DG2_EDIT",c.projectId))throw conflict("交接发起人的当前项目经理责任或权限已变化，请重新发起。");
        s.projects.requireReadable(owner,c.projectId,"PROJECT_MEMBER_MANAGE");
        var current=build(owner,c,t.fromId,t.toId);
        if(!current.hash().equals(t.mappingHash))throw conflict("交接涉及的职责、成员角色或原记录已变化，请撤销后重新预览发起。");
        return current.mapping();
    }
    private void apply(SessionPrincipal actor,DeliveryCase c,DeliveryTransfer t,Mapping mapping){
        var roleChanges=s.codec.read(t.permissionsJson,Permissions.class).items();s.projects.validateRoleChanges(actor,c.projectId,roleChanges);
        var signatures=signatures(t);var locks=new TreeSet<UUID>();
        for(var move:mapping.resources()){locks.add(move.before().request().personId());locks.add(move.after().personId());}locks.forEach(s.accounts::lockForResourceCommit);
        for(var move:mapping.resources()){
            var signed=signatures.stream().filter(x->x.resourceId().equals(move.before().id())).findFirst().orElseThrow(()->conflict("尚有接任资源未重新签认。"));
            if(!Set.of("COMMITTED","RESOLVED").contains(signed.status())||!signed.signedBy().equals(move.after().committerId()))throw conflict("请先明确解决全部接任资源冲突。");
            if(!s.allowsPerson(signed.signedBy(),"DG2_RESOURCE_COMMIT",c.projectId))throw conflict("资源签认人的当前权限已失效，请重新核实。");
            s.requireCommitterOrganization(move.after());
            if(peak(mapping,move).compareTo(signed.commitment().dailyCapacity())>0&&(!"RESOLVED".equals(signed.status())||!overlapHash(mapping,move).equals(signed.overlapHash())))throw conflict("出现新的超容量重叠，请重新协调和签认。");
        }
        for(var move:mapping.objects()){
            var o=s.object(c,move.before().id());String before=o.contentJson;o.contentJson=s.codec.write(move.after());o.preparedBy=actor.accountId();o.touch();
            s.objects.flush();
            s.record(c,o.id,o.kind,o.version,before,o.contentJson,actor.accountId(),t.basis,"交接当前责任；范围、日期及原批准版本保持可追溯。","责任交接 "+t.id);
        }
        s.objects.flush();
        for(var move:mapping.findings()){
            var f=s.findings.findById(move.before().id()).orElseThrow(BusinessRules::missing);String before=s.codec.write(s.findingFact(f));
            f.contentJson=s.codec.write(move.after());f.touch();s.findings.flush();
            s.record(c,f.id,"FINDING",f.version,before,s.codec.write(s.findingFact(f)),actor.accountId(),t.basis,"未结遗留责任交接，原证据提交人与时间保留。","责任交接 "+t.id);
        }
        for(var move:mapping.resources()){
            var r=s.resources.findById(move.before().id()).orElseThrow(BusinessRules::missing);var next=move.after();var signed=signatures.stream().filter(x->x.resourceId().equals(r.id)).findFirst().orElseThrow();
            r.personId=next.personId();r.committerId=next.committerId();r.startsOn=next.startsOn();r.endsOn=next.endsOn();r.dailyHours=next.dailyHours();r.requestJson=s.codec.write(next);
            r.status=signed.status();r.commitmentJson=s.codec.write(signed.commitment());r.committedBy=signed.signedBy();r.committedAt=signed.signedAt();r.overlapHash=signed.overlapHash();r.touch();
        }
        s.resources.flush();
        for(var move:mapping.resources()){
            var r=s.resources.findById(move.before().id()).orElseThrow();s.record(c,r.id,"RESOURCE",r.version,s.codec.write(move.before()),s.codec.write(s.resourceFact(r)),actor.accountId(),t.basis,"新请求经指定人员重签；过去安排保留在批准快照与修订历史。","责任交接 "+t.id);
        }
        for(var provider:contributors)provider.transferResponsibilities(actor,c.projectId,t.fromId,t.toId,mapping.related().stream().filter(x->x.domain().equals(provider.responsibilityDomain())).toList(),t.basis);
        String oldHeader=c.headerJson;c.headerJson=s.codec.write(mapping.afterHeader());c.managerId=mapping.afterHeader().projectManagerId();s.touch(c);
        if(!oldHeader.equals(c.headerJson))s.record(c,c.id,"HEADER",c.version,oldHeader,c.headerJson,actor.accountId(),t.basis,"交接当前团队责任，原基线快照保持不变。","责任交接 "+t.id);
        s.projects.applyRoleChanges(actor,c.projectId,roleChanges,t.basis.length()>1000?t.basis.substring(0,1000):t.basis);
        for(var provider:contributors)provider.validateRecipient(c.projectId,t.toId,mapping.related().stream().filter(x->x.domain().equals(provider.responsibilityDomain())).toList());
        if(!s.allowsPerson(c.managerId,"DG2_EDIT",c.projectId)||!s.allowsPerson(c.managerId,"DG2_SUBMIT",c.projectId))throw conflict("接任后的项目经理缺少维护或提交权限，本次交接未生效。");
        for(var move:mapping.objects())if(move.after().workPackage()!=null&&!s.allowsPerson(move.after().workPackage().ownerId(),"DG2_EDIT",c.projectId))throw conflict("接任工作包负责人缺少交付维护权限，本次交接未生效。");
    }
    private List<Allocation> allocations(Mapping mapping,ResourceMove move,boolean includeCurrent){
        var r=move.after();var replacing=mapping.resources().stream().map(m->m.before().id()).collect(java.util.stream.Collectors.toSet());
        var all=new ArrayList<Allocation>();
        for(var old:s.resources.findAllByPersonIdAndStartsOnLessThanEqualAndEndsOnGreaterThanEqual(r.personId(),r.endsOn(),r.startsOn()))
            if(!replacing.contains(old.id)&&Set.of("COMMITTED","RESOLVED").contains(old.status))all.add(new Allocation(old.id,old.projectId,null,old.startsOn,old.endsOn,old.dailyHours,false));
        UUID projectId=s.cases.findById(s.resources.findById(move.before().id()).orElseThrow().caseId).orElseThrow().projectId;
        for(var candidate:mapping.resources())if(candidate.after().personId().equals(r.personId())&&(includeCurrent||!candidate.before().id().equals(move.before().id()))
                &&!candidate.after().startsOn().isAfter(r.endsOn())&&!candidate.after().endsOn().isBefore(r.startsOn()))
            all.add(new Allocation(candidate.before().id(),projectId,null,candidate.after().startsOn(),candidate.after().endsOn(),candidate.after().dailyHours(),true));
        all.sort(Comparator.comparing(Allocation::resourceId));return List.copyOf(all);
    }
    private BigDecimal peak(Mapping mapping,ResourceMove move){
        var window=move.after();var boundaries=new TreeMap<LocalDate,BigDecimal>();
        for(var allocation:allocations(mapping,move,true)){
            var start=allocation.startsOn().isBefore(window.startsOn())?window.startsOn():allocation.startsOn();
            var end=allocation.endsOn().isAfter(window.endsOn())?window.endsOn():allocation.endsOn();
            boundaries.merge(start,allocation.dailyHours(),BigDecimal::add);boundaries.merge(end.plusDays(1),allocation.dailyHours().negate(),BigDecimal::add);
        }
        var current=BigDecimal.ZERO;var peak=current;for(var delta:boundaries.values()){current=current.add(delta);peak=peak.max(current);}return peak;
    }
    private String overlapHash(Mapping mapping,ResourceMove move){return s.codec.hash(allocations(mapping,move,false).stream().map(a->List.of(a.resourceId().toString(),a.startsOn().toString(),a.endsOn().toString(),a.dailyHours().stripTrailingZeros().toPlainString())).toList());}
    private ResourceMove resource(Mapping mapping,UUID id){return mapping.resources().stream().filter(r->r.before().id().equals(id)).findFirst().orElseThrow(BusinessRules::missing);}
    private DeliveryTransfer require(DeliveryCase c,UUID id){return transfers.findById(id).filter(t->t.caseId.equals(c.id)).orElseThrow(BusinessRules::missing);}
    private Mapping mapping(DeliveryTransfer t){return s.codec.read(t.mappingJson,Mapping.class);}
    private List<ResourceSignature> signatures(DeliveryTransfer t){return s.codec.read(t.signaturesJson,Signatures.class).items();}
    private Set<String> readableRelated(SessionPrincipal actor,UUID projectId){
        var project=s.projects.requireReadable(actor,projectId,"DG2_READ");var result=new HashSet<String>();
        if(s.allows(actor,project,"WORK_READ"))result.add("WORK");if(s.allows(actor,project,"REQUIREMENT_READ"))result.add("REQUIREMENT");if(s.allows(actor,project,"FINANCE_READ"))result.add("INCOME");if(s.allows(actor,project,"DELIVERY_EXECUTION_READ"))result.add("EXECUTION");return result;
    }
    private View view(DeliveryTransfer t,Set<String> readable){
        var original=mapping(t);var projected=new Mapping(original.from(),original.to(),original.beforeHeader(),original.afterHeader(),original.objects(),original.resources(),original.findings(),original.related().stream().filter(r->!"INCOME".equals(r.domain())||readable.contains("INCOME"))
            .map(r->readable.contains(r.domain())?r:new ProjectResponsibilityContributor.Responsibility(r.domain(),r.objectId(),r.version(),"当前无权限查看的"+("WORK".equals(r.domain())?"工作记录":"需求"),List.of("当前无查看权限"))).toList());
        return new View(t.id,t.version,t.status,t.fromId,s.access.name(t.fromId),t.toId,s.access.name(t.toId),projected,t.mappingHash,s.codec.read(t.permissionsJson,Permissions.class).items(),signatures(t),t.basis,t.submittedBy,t.createdAt,t.acceptedBy,t.acceptedAt,t.acceptanceNote,t.decidedBy,t.effectiveAt,t.decisionNote);
    }
    private SessionPrincipal principal(UUID id){var a=s.access.account(id);return new SessionPrincipal(id,a.loginName(),a.displayName(),false,false,new UUID(0,0));}
    private void approved(DeliveryCase c){if(!"APPROVED".equals(c.status))throw conflict("批准前请在准备区维护团队；责任交接用于已批准项目。");}
}
