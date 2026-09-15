package com.winh.workplan.requirements;
import java.time.*;
import java.util.*;
import com.winh.workplan.business.BusinessHistory.EventView;
public final class RequirementViews {
    private RequirementViews(){}
    public record RequirementView(UUID id,long version,String code,UUID projectId,String projectName,String title,
        String originalText,String source,String requester,UUID createdBy,UUID ownerAccountId,String ownerName,
        UUID verifierAccountId,String verifierName,String priority,String status,LocalDate expectedOn,boolean importantCustomer,
        String disposition,String completionEvidence,String verificationComment,String customerEvidence,
        String completedByName,String verifiedByName,Instant verifiedAt,Instant updatedAt){}
    public record AssessmentView(UUID id,String clarification,String category,String scopeImpact,String technicalImpact,
        String scheduleImpact,String costImpact,String contractImpact,String acceptanceImpact,String safetyImpact,
        boolean baselineImpact,String createdByName,Instant createdAt){}
    public record LinkView(UUID id,UUID workItemId,String kind,String title,String status,boolean active,boolean approved){}
    public record Detail(RequirementView requirement,List<AssessmentView> assessments,List<LinkView> links,
        List<EventView> history,List<String> allowedActions){}
}
