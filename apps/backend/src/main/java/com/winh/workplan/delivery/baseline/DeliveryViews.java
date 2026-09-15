package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessHistory;
import com.winh.workplan.delivery.DeliveryConfigurationDirectory.PublishedConfiguration;
import com.winh.workplan.handover.HandoverDirectory.PackageReference;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
final class DeliveryViews {
    private DeliveryViews() {}
    record ObjectFact(UUID id, long version, String kind, Content content, UUID preparedBy, boolean archived, int baselineVersion) {}
    record ResourceFact(UUID id, long version, ResourceRequest request, String status, Commitment commitment,
        UUID committedBy, Instant committedAt, UUID preparedBy, String overlapHash) {}
    record FindingFact(UUID id, long version, Finding finding, String status, boolean blocking, UUID preparedBy,
        String evidence, UUID evidenceBy, Instant evidenceAt, String verification, UUID verifiedBy, Instant verifiedAt) {}
    record Snapshot(UUID caseId, UUID projectId, long caseVersion, Header header, UUID preparedBy,
        PackageReference handover, PublishedConfiguration template, PublishedConfiguration policy,
        List<ObjectFact> objects, List<ResourceFact> resources, List<FindingFact> findings) {}
    record Check(String code, String title, String status, List<String> problems, String href) {}
    record Person(UUID id, String name) {}
    record ReviewAssignment(UUID accountId, String scope) {}
    record CaseView(UUID id, long version, String status, Header header, int roundNumber, int baselineVersion,
        PackageReference handover, PublishedConfiguration template, PublishedConfiguration policy, boolean budgetReadable,
        List<ReviewAssignment> reviewAssignments, UUID finalApproverId) {}
    record Review(UUID id, long version, UUID reviewerId, String scope, String status, String comment, Instant reviewedAt) {}
    record Round(UUID id, long version, int number, String status, String snapshotHash, UUID submittedBy,
        Instant submittedAt, String submissionNote, UUID decidedBy, Instant decidedAt, String decisionNote, List<Review> reviews) {}
    record Baseline(UUID id, int number, String snapshotHash, UUID approvedBy, Instant approvedAt, String reason) {}
    record Change(UUID id, long version, UUID objectId, long expectedObjectVersion, String status, Content content,
        boolean archiveRequested, UUID submittedBy, String reason, String impact, String basis,
        UUID decidedBy, Instant decidedAt, String decision) {}
    record Revision(UUID id, UUID objectId, String kind, long objectVersion, String beforeJson, String afterJson,
        UUID actorId, Instant createdAt, String reason, String impact, String basis) {}
    record Row(UUID projectId, String projectCode, String projectName, String customerName, String mainStage,
        String projectStatus, String status, UUID managerId, String managerName, int roundNumber, int baselineVersion,
        int openFindings, int overdueFindings, Instant updatedAt) {}
    record Workspace(Row project, CaseView preparation, List<ObjectFact> objects, List<ResourceFact> resources,
        List<FindingFact> findings, List<Check> checks, List<Round> rounds, List<Baseline> baselines, List<Change> changes,
        List<Person> people, List<BusinessHistory.EventView> history, List<String> allowedActions) {}
    record Overlap(UUID resourceId, UUID projectId, String projectName, LocalDate startsOn, LocalDate endsOn,
        BigDecimal dailyHours, String status) {}
}
