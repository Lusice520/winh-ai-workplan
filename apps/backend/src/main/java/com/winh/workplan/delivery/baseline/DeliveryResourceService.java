package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.baseline.DeliveryCommands.*;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
class DeliveryResourceService {
    final DeliveryStore s;
    DeliveryResourceService(DeliveryStore s){this.s=s;}
    List<Overlap> overlaps(SessionPrincipal actor,UUID projectId,UUID resourceId){
        s.projects.requireReadable(actor,projectId,"DG2_READ");var c=s.require(projectId);var r=require(c,resourceId);
        if(!c.managerId.equals(actor.accountId())&&!r.committerId.equals(actor.accountId())&&!r.personId.equals(actor.accountId()))
            throw conflict("资源重叠明细仅供项目经理、资源人员和指定承诺人核验。");
        return s.resources.findAllByPersonIdAndStartsOnLessThanEqualAndEndsOnGreaterThanEqual(r.personId,r.endsOn,r.startsOn).stream()
            .filter(x->!x.id.equals(r.id)&&Set.of("COMMITTED","RESOLVED").contains(x.status)).map(x->{
                try{var p=s.projects.requireReadable(actor,x.projectId,"DG2_READ");return new Overlap(x.id,x.projectId,p.name(),x.startsOn,x.endsOn,x.dailyHours,x.status);}
                catch(DomainException e){return new Overlap(null,null,"其他项目的已承诺资源",x.startsOn,x.endsOn,x.dailyHours,x.status);}
            }).toList();
    }
    @Transactional Workspace save(SessionPrincipal actor,UUID projectId,UUID id,SaveResource input){
        var c=s.writable(actor,projectId,"DG2_EDIT");var res=s.access.reserve(actor,"dg2.resource:"+Objects.toString(id,c.id+":new"),input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);
        if("APPROVED".equals(c.status))throw conflict("批准后的资源人选或投入调整请办理责任交接。");
        var request=DeliveryRules.resource(input.request());s.reference(c,request.workPackageId(),"WORK_PACKAGE");
        var wp=s.object(c,request.workPackageId());var content=s.codec.read(wp.contentJson,Content.class);s.responsible(actor,c,content,content);
        s.member(projectId,request.personId());s.member(projectId,request.committerId());s.requireCommitterOrganization(request);
        var r=id==null?new DeliveryResource():require(c,id);if(id!=null)version(r,input.resourceVersion());
        var people=new TreeSet<UUID>();people.add(request.personId());if(r.personId!=null)people.add(r.personId);people.forEach(s.accounts::lockForResourceCommit);
        String before=id==null?null:s.codec.write(s.resourceFact(r));String reason=required(input.reason(),"reason",2000);
        if(id!=null&&!r.workPackageId.equals(request.workPackageId()))throw invalid("workPackageId","原资源申请归属工作包不可改写，请撤回后重新申请。");
        if(id==null&&s.resources.findAllByCaseIdOrderByCreatedAtAsc(c.id).size()>=300)throw conflict("资源申请超过本项目单次准备容量，请先梳理当前请求。");
        r.caseId=c.id;r.projectId=projectId;r.workPackageId=request.workPackageId();r.personId=request.personId();r.committerId=request.committerId();
        r.startsOn=request.startsOn();r.endsOn=request.endsOn();r.dailyHours=request.dailyHours();r.requestJson=s.codec.write(request);r.status="REQUESTED";
        r.commitmentJson=null;r.committedBy=null;r.committedAt=null;r.overlapHash=null;r.preparedBy=actor.accountId();r.touch();s.resources.saveAndFlush(r);s.touch(c);
        s.record(c,r.id,"RESOURCE",r.version,before,s.codec.write(s.resourceFact(r)),actor.accountId(),reason,null,null);
        s.access.complete(res,r.id);return s.workspace(actor,projectId);
    }
    @Transactional Workspace commit(SessionPrincipal actor,UUID projectId,UUID id,CommitResource input){
        var decision=choice(input.decision(),"decision","COMMITTED","CONFLICT","RESOLVED","REVOKED");
        var c=s.writable(actor,projectId,"DG2_RESOURCE_COMMIT");var res=s.access.reserve(actor,"delivery.resource.commit:"+id,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);
        if("APPROVED".equals(c.status))throw conflict("批准后的资源承诺变更请办理责任交接，原签认记录保持不变。");
        var r=require(c,id);version(r,input.resourceVersion());var request=s.codec.read(r.requestJson,ResourceRequest.class);
        if(!r.committerId.equals(actor.accountId()))throw conflict("请由本申请指定的资源承诺人签认。");
        s.member(projectId,r.personId);s.requireCommitterOrganization(request);s.accounts.lockForResourceCommit(r.personId);
        if("REVOKED".equals(r.status))throw conflict("此资源申请已撤回，请由负责人修改申请后重新签认。");
        String before=s.codec.write(s.resourceFact(r));String reason=required(input.reason(),"reason",2000);
        if(!"REVOKED".equals(decision)){
            var commitment=DeliveryRules.commitment(input.commitment());var peak=s.peakHours(request,id);
            if("COMMITTED".equals(decision)&&peak.compareTo(commitment.dailyCapacity())>0)throw conflict("当前重叠需求超过可用容量，请记录冲突，协调后明确解决依据。");
            if("RESOLVED".equals(decision)){
                if(!"CONFLICT".equals(r.status)&&!("COMMITTED".equals(r.status)||"RESOLVED".equals(r.status)))throw conflict("请先明确记录资源冲突，再确认协调结论。");
                required(commitment.impact(),"impact",4000);required(commitment.escalationPath(),"escalationPath",2000);
            }
            r.commitmentJson=s.codec.write(commitment);r.overlapHash=s.overlapHash(request,id);
        }
        r.status=decision;r.committedBy=actor.accountId();r.committedAt=Instant.now();r.touch();s.resources.flush();s.touch(c);
        s.record(c,r.id,"RESOURCE",r.version,before,s.codec.write(s.resourceFact(r)),actor.accountId(),reason,null,null);
        s.history.record(c.id,"DELIVERY_INITIATION","DELIVERY_RESOURCE_"+decision,"指定责任人签认资源申请："+decision+"。",actor.accountId());
        s.access.complete(res,r.id);return s.workspace(actor,projectId);
    }
    private DeliveryResource require(DeliveryCase c,UUID id){return s.resources.findById(id).filter(r->r.caseId.equals(c.id)).orElseThrow(BusinessRules::missing);}
}
