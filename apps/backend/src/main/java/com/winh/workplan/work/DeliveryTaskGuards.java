package com.winh.workplan.work;

import static com.winh.workplan.business.BusinessRules.*;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory.BaselineApplied;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
class DeliveryTaskGuards {
    private final DeliveryTaskStore s;
    DeliveryTaskGuards(DeliveryTaskStore s){this.s=s;}
    @EventListener public void beforeWork(WorkDirectory.BeforeExecutionAction event){
        if(!java.util.Set.of("COMPLETE","VERIFY").contains(event.action()))return;
        checkParent(event.actor(),event.work());
    }
    @EventListener public void options(WorkDirectory.ExecutionAvailability event){
        try{checkParent(event.actor(),event.work());}catch(com.winh.workplan.iam.shared.DomainException ignored){event.disallow().accept("COMPLETE");event.disallow().accept("VERIFY");}
    }
    @EventListener public void completion(WorkDirectory.CompletionEligibility event){
        var p=s.profile(event.work().projectId(),event.work().id());var c=s.context(event.actor(),p.projectId,p.workPackageId,null);
        if(s.needsReview(c,s.task(p.projectId,p.id),p))event.unavailable().accept("NEEDS_REVIEW");
    }
    private void checkParent(com.winh.workplan.iam.identity.SessionPrincipal actor,WorkDirectory.WorkReference parent){
        var tasks=s.profiles.findAllByProjectIdAndWorkPackageIdOrderByUpdatedAtDesc(parent.projectId(),parent.id());
        if(tasks.isEmpty())return;
        var c=s.context(actor,parent.projectId(),parent.id(),null);
        if(tasks.stream().anyMatch(p->{var w=s.task(parent.projectId(),p.id);return !"CANCELLED".equals(w.status)&&(!"DONE".equals(w.status)||s.needsReview(c,w,p));}))
            throw conflict("原工作包仍有未完成或需复核的任务，请先处理任务成果。");
    }
    @EventListener public void baseline(BaselineApplied event){
        for(var ref:event.changed())if("WORK_PACKAGE".equals(ref.kind())){
            var tasks=s.profiles.findAllByProjectIdAndWorkPackageIdOrderByUpdatedAtDesc(event.projectId(),ref.id());
            if(ref.archived()&&tasks.stream().anyMatch(p->!"CANCELLED".equals(s.task(event.projectId(),p.id).status)))throw conflict("工作包下仍有未取消的任务，不能停用原范围。");
            if(tasks.stream().anyMatch(p->p.actualStartedOn!=null&&!p.stageId.equals(ref.content().workPackage().stageId())))throw conflict("下属任务已有实际事实，不能改换原工作包的阶段。");
        }
    }
    @EventListener public void transferred(WorkDirectory.TaskResponsibilityTransferred event){
        var p=s.profile(event.after().projectId(),event.after().id());var w=s.task(p.projectId,p.id);
        @SuppressWarnings("unchecked") var before=(java.util.Map<String,Object>)s.snapshot(w,p);
        before.put("ownerId",event.before().ownerId());before.put("verifierId",event.before().verifierId());
        before.put("ownerName",s.access.name(event.before().ownerId()));before.put("verifierName",s.access.name(event.before().verifierId()));
        s.record(event.actor(),w,p,"RESPONSIBILITY_TRANSFER",event.reason(),before);
    }
}
