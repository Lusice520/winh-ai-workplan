package com.winh.workplan.execution;

import static com.winh.workplan.business.BusinessRules.*;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory.BaselineApplied;
import com.winh.workplan.delivery.baseline.DeliveryContent.Item;
import com.winh.workplan.work.WorkDirectory.BeforeExecutionAction;
import java.util.*;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
class ExecutionGuards {
    private final ExecutionStore s;
    ExecutionGuards(ExecutionStore s){this.s=s;}
    @EventListener public void beforeWork(BeforeExecutionAction event){
        if(!"COMPLETE".equals(event.action()))return;
        var c=s.read(event.actor(),event.work().projectId());var object=s.object(c,event.work().id(),"WORK_PACKAGE");
        s.runningProject(c);s.runningStage(c,object);
    }
    @EventListener public void workOptions(com.winh.workplan.work.WorkDirectory.ExecutionAvailability event){
        try{var c=s.read(event.actor(),event.work().projectId());s.runningProject(c);s.runningStage(c,s.object(c,event.work().id(),"WORK_PACKAGE"));}
        catch(com.winh.workplan.iam.shared.DomainException ignored){event.disallow().accept("COMPLETE");}
    }
    @EventListener public void afterBaseline(BaselineApplied event){
        for(var ref:event.changed())switch(ref.kind()){
            case "STAGE" -> {
                var row=s.stages.findByProjectIdAndStageId(event.projectId(),ref.id()).orElse(null);
                if(row!=null&&!"NOT_STARTED".equals(row.status)&&(ref.archived()||!Boolean.TRUE.equals(ref.content().stage().applicable())))
                    throw conflict("阶段已有实际执行，不能直接停用或改为不适用，请先明确处理原执行范围。");
            }
            case "ITEM" -> {
                var rows=s.items.findAllByProjectIdAndItemIdOrderByCreatedAtDesc(event.projectId(),ref.id());
                if(rows.stream().noneMatch(ExecutionRules::active))continue;
                if(ref.archived())throw conflict("清单仍有有效实际或待验收，不能停用原对象。");
                var profile=s.profiles.findByProjectIdAndItemId(event.projectId(),ref.id()).orElseThrow();
                var previous=s.rules.read(profile.scopeJson,Item.class);var next=ref.content().item();
                if(!Objects.equals(previous.stageId(),next.stageId())||!Objects.equals(previous.workPackageId(),next.workPackageId())||!Objects.equals(previous.milestoneId(),next.milestoneId()))
                    throw conflict("清单已有实际事实，不能改换其所属阶段、工作包或验收关系，请先处理原执行记录。");
                s.rules.validateTimeline(profile,next.quantity(),rows,s.rules.scopeHash(ref));
            }
            case "MILESTONE" -> {
                var row=s.milestones.findByProjectIdAndMilestoneId(event.projectId(),ref.id()).orElse(null);
                if(row!=null&&!"OPEN".equals(row.status)&&ref.archived())throw conflict("里程碑已有待验证或已验证结论，不能停用原对象。");
            }
            default -> {}
        }
    }
}
