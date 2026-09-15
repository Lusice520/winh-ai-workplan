package com.winh.workplan.project;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.winh.workplan.business.BusinessHistory.EventView;
public final class ProjectViews {
    private ProjectViews() {}
    public record ProjectView(UUID id, long version, String code, String name, UUID opportunityId,
        UUID customerId, String customerName, UUID salesOwnerId, String salesOwnerName,
        UUID presalesOwnerId, String presalesOwnerName, String mainStage, String focus, String status,
        String result, String procurementMethod, String background, Instant updatedAt) {}
    public record MemberView(UUID id, UUID accountId, String name, List<String> roleCodes, boolean active,
        boolean salesOwner, boolean presalesOwner, long version) {}
    public record ProjectDetail(ProjectView project, List<MemberView> members, List<EventView> history, List<String> allowedActions) {}
}
