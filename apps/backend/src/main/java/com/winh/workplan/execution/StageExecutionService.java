package com.winh.workplan.execution;
import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.execution.ExecutionRules.*;
import static com.winh.workplan.execution.ExecutionCommands.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
class StageExecutionService {
    private final ExecutionStore s;
    StageExecutionService(ExecutionStore s){this.s=s;}
    void transition(SessionPrincipal actor,UUID projectId,UUID id,StageCommand input){
        String action=choice(input.action(),"action","START","PROGRESS","PAUSE","RESUME","COMPLETE","REOPEN");
        var c=s.write(actor,projectId,"PROGRESS".equals(action)?"DELIVERY_EXECUTION_EDIT":"DELIVERY_EXECUTION_MANAGE");
        var ref=s.object(c,id,"STAGE");
        if("PROGRESS".equals(action))s.requireResponsible(actor,c,ref);else s.manager(actor,c);
        var reservation=s.access.reserve(actor,"execution.stage:"+id,input.requestId(),input);if(reservation.replayed())return;
        objectVersion(ref,input.objectVersion());var row=s.stages.findByProjectIdAndStageId(projectId,id).orElse(null);expected(row,input.version());
        var date=date(input.occurredOn());String note=required(input.note(),"note",4000);s.runningProject(c);
        if(!Boolean.TRUE.equals(ref.content().stage().applicable()))throw conflict("不适用阶段不能从执行入口开始，请先完成范围变更。");
        Object before=s.stageSnapshot(row);
        if(row==null){row=new ExecutionStage();row.projectId=projectId;row.stageId=id;row.scopeHash=s.completionScopeHash(c,ref);}
        if(row.startedOn!=null&&date.isBefore(row.startedOn))throw invalid("occurredOn","实际日期不能早于阶段开始日期。");
        switch(action){
            case "START" -> {
                if(!"NOT_STARTED".equals(row.status))throw conflict("阶段已开始，请使用对应状态操作。");
                var blockers=s.predecessorProblems(c,ref);if(!blockers.isEmpty())throw conflict(blockers.getFirst());
                row.status="IN_PROGRESS";row.startedOn=date;row.scopeHash=s.completionScopeHash(c,ref);
            }
            case "PROGRESS" -> {
                if(!"IN_PROGRESS".equals(row.status))throw conflict("仅进行中的阶段可以登记进展。");
                if(input.progress()==null||input.progress()<0||input.progress()>99)throw invalid("progress","请填写 0–99；完成由项目经理核验后确认。");
                row.progress=input.progress();
            }
            case "PAUSE" -> {if(!"IN_PROGRESS".equals(row.status))throw conflict("仅进行中的阶段可以暂停。");row.status="PAUSED";}
            case "RESUME" -> {if(!"PAUSED".equals(row.status))throw conflict("仅暂停的阶段可以恢复。");row.status="IN_PROGRESS";}
            case "COMPLETE" -> {
                if(!"IN_PROGRESS".equals(row.status))throw conflict("请先开始或恢复阶段，再核验完成条件。");
                var blockers=s.stageCompletionProblems(c,ref);if(!blockers.isEmpty())throw conflict("阶段完成条件尚未满足："+blockers.getFirst());
                boolean laterMilestone=s.milestones.findAllByProjectId(projectId).stream()
                    .filter(m->"VERIFIED".equals(m.status)&&m.occurredOn!=null&&m.occurredOn.isAfter(date))
                    .anyMatch(m->s.objects(c,"MILESTONE").stream().anyMatch(o->o.id().equals(m.milestoneId)&&id.equals(s.stageId(o))));
                boolean laterItem=s.items.findAllByProjectIdOrderByCreatedAtDesc(projectId).stream()
                    .filter(e->ExecutionRules.active(e)&&e.occurredOn.isAfter(date))
                    .anyMatch(e->s.objects(c,"ITEM").stream().anyMatch(o->o.id().equals(e.itemId)&&id.equals(s.stageId(o))));
                if(laterMilestone||laterItem)throw invalid("occurredOn","阶段完成日期不能早于其清单或里程碑实际发生日期。");
                row.status="COMPLETED";row.progress=100;row.completedOn=date;row.scopeHash=s.completionScopeHash(c,ref);
            }
            case "REOPEN" -> {
                if(!"COMPLETED".equals(row.status))throw conflict("仅已完成或需重核的阶段可以重开。");
                if(date.isBefore(row.completedOn))throw invalid("occurredOn","重开日期不能早于上一轮完成日期。");
                row.status="IN_PROGRESS";row.progress=0;row.completedOn=null;row.scopeHash=s.completionScopeHash(c,ref);
            }
            default -> throw invalid("action","不支持此操作。");
        }
        row.objectVersion=ref.version();row.baselineVersion=c.scope().baselineVersion();row.touch();s.stages.saveAndFlush(row);
        s.record(c,ref,"STAGE_"+action,note,date,actor.accountId(),before,s.stageSnapshot(row));s.access.complete(reservation,row.id);
    }
}
