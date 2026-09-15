package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.business.BusinessRules.*;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.project.ProjectDirectory;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
class ApprovedDeliveryAdapter implements ApprovedDeliveryDirectory {
    private final DeliveryCaseRepository cases;
    private final DeliveryObjectRepository objects;
    private final DeliveryCodec codec;
    private final ProjectDirectory projects;
    ApprovedDeliveryAdapter(DeliveryCaseRepository cases,DeliveryObjectRepository objects,DeliveryCodec codec,ProjectDirectory projects){
        this.cases=cases;this.objects=objects;this.codec=codec;this.projects=projects;
    }
    @Override public Scope require(SessionPrincipal actor,UUID projectId){
        var p=projects.requireReadable(actor,projectId,"DG2_READ");
        var c=cases.findByProjectId(projectId).filter(x->"APPROVED".equals(x.status)&&x.baselineVersion>0)
            .orElseThrow(()->conflict("请先通过 DG-02，在原批准范围下记录执行。"));
        if(!"DELIVERY".equals(p.mainStage()))throw conflict("当前项目尚未进入正式交付执行。");
        return new Scope(projectId,c.managerId,c.baselineVersion,objects.findAllByCaseIdOrderByCreatedAtAsc(c.id).stream()
            .filter(o->!"BUDGET".equals(o.kind)).map(o->new ObjectReference(o.id,o.version,o.kind,
                codec.read(o.contentJson,DeliveryContent.Content.class),o.archived,o.baselineVersion)).toList());
    }
}
