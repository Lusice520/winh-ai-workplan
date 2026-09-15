package com.winh.workplan.execution;

import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
class ExecutionAdapter implements ExecutionDirectory {
    private final ExecutionStore s;
    ExecutionAdapter(ExecutionStore s){this.s=s;}
    @Override public StageState stage(SessionPrincipal actor,UUID projectId,UUID stageId){
        var c=s.read(actor,projectId);var ref=c.scope().objects().stream().filter(o->o.id().equals(stageId)&&"STAGE".equals(o.kind())).findFirst().orElseThrow(com.winh.workplan.business.BusinessRules::missing);
        var row=s.stages.findByProjectIdAndStageId(projectId,stageId).orElse(null);
        return new StageState(ref.archived()?"RETIRED":s.stageStatus(c,row,ref),row==null?null:row.startedOn);
    }
}
