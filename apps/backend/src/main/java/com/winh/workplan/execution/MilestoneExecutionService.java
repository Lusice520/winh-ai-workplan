package com.winh.workplan.execution;
import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.execution.ExecutionRules.*;
import static com.winh.workplan.execution.ExecutionCommands.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
class MilestoneExecutionService {
    private final ExecutionStore s;
    MilestoneExecutionService(ExecutionStore s){this.s=s;}
    void submit(SessionPrincipal actor,UUID projectId,UUID id,MilestoneCommand input){
        var c=s.write(actor,projectId,"DELIVERY_EXECUTION_EDIT");var ref=s.object(c,id,"MILESTONE");s.requireResponsible(actor,c,ref);
        var reservation=s.access.reserve(actor,"execution.milestone.submit:"+id,input.requestId(),input);if(reservation.replayed())return;
        objectVersion(ref,input.objectVersion());var row=s.milestones.findByProjectIdAndMilestoneId(projectId,id).orElse(null);expected(row,input.version());
        if(row!=null&&!"OPEN".equals(row.status))throw conflict("里程碑已有提交或验证结论，请先退回或明确重开。");
        s.runningProject(c);var occurred=date(input.occurredOn());s.occurredDuringStage(c,ref,occurred);var blockers=s.milestoneProblems(c,ref);
        if(!blockers.isEmpty())throw conflict("里程碑尚不具备完成条件："+blockers.getFirst());
        s.checkReviewer(c,input.verifierId(),actor.accountId(),s.owner(c,ref));var fileIds=s.validateFiles(actor,projectId,input.fileVersionIds());
        var evidence=required(input.evidence(),"evidence",4000);var before=s.milestoneSnapshot(row);
        if(row==null){row=new ExecutionMilestone();row.projectId=projectId;row.milestoneId=id;}
        row.status="PENDING";row.occurredOn=occurred;row.evidence=evidence;row.filesJson=s.rules.json(fileIds);row.submittedBy=actor.accountId();row.verifierId=input.verifierId();
        row.decidedBy=null;row.decidedAt=null;row.decision=null;row.scopeHash=s.completionScopeHash(c,ref);row.objectVersion=ref.version();row.baselineVersion=c.scope().baselineVersion();
        row.touch();s.milestones.saveAndFlush(row);s.record(c,ref,"MILESTONE_SUBMIT",evidence,occurred,actor.accountId(),before,s.milestoneSnapshot(row));s.access.complete(reservation,row.id);
    }
    void decide(SessionPrincipal actor,UUID projectId,UUID id,Decision input){
        String action=choice(input.action(),"action","VERIFY","RETURN","REOPEN");
        var c=s.write(actor,projectId,"REOPEN".equals(action)?"DELIVERY_EXECUTION_MANAGE":"DELIVERY_EXECUTION_REVIEW");var ref=s.object(c,id,"MILESTONE");
        var reservation=s.access.reserve(actor,"execution.milestone.decide:"+id,input.requestId(),input);if(reservation.replayed())return;
        objectVersion(ref,input.objectVersion());var row=s.milestones.findByProjectIdAndMilestoneId(projectId,id).orElseThrow(()->conflict("该里程碑尚无实际提交。"));expected(row,input.version());
        String note=required(input.note(),"note",4000);var before=s.milestoneSnapshot(row);
        if("REOPEN".equals(action)){
            s.manager(actor,c);if(!"VERIFIED".equals(row.status))throw conflict("仅已有验证结论的里程碑可明确重开。");
            var stage=s.stages.findByProjectIdAndStageId(projectId,s.stageId(ref)).orElse(null);
            if(stage!=null&&"COMPLETED".equals(stage.status))throw conflict("阶段已有完成结论，请先明确重开受影响阶段。");
            row.status="OPEN";
        }else{
            if(!"PENDING".equals(row.status))throw conflict("只有待验证里程碑可以确认或退回。");
            s.independent(actor,c,row.verifierId,row.submittedBy,s.owner(c,ref));
            if("VERIFY".equals(action)){
                if(!row.scopeHash.equals(s.completionScopeHash(c,ref)))throw conflict("批准的验收范围已变化，请退回后重新提交。");
                var blockers=s.milestoneProblems(c,ref);if(!blockers.isEmpty())throw conflict("当前范围仍有完成缺项："+blockers.getFirst());
                s.validateFiles(actor,projectId,s.fileIds(row.filesJson));row.status="VERIFIED";
            }else row.status="OPEN";
        }
        row.decidedBy=actor.accountId();row.decidedAt=Instant.now();row.decision=note;row.touch();s.milestones.flush();
        s.record(c,ref,"MILESTONE_"+action,note,today(),actor.accountId(),before,s.milestoneSnapshot(row));s.access.complete(reservation,row.id);
    }
}
