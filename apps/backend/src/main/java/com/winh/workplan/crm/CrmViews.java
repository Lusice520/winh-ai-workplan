package com.winh.workplan.crm;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.winh.workplan.business.BusinessHistory.EventView;

public final class CrmViews {
    private CrmViews() {}
    public record CustomerView(UUID id, long version, String code, String name, String shortName,
        String kind, String identifier, String industry, String region, String source, UUID ownerAccountId,
        String ownerName, String status, UUID mergedIntoId, Instant updatedAt) {}
    public record ContactView(UUID id, long version, String name, String position, String phone,
        String email, String status, boolean contactVisible) {}
    public record CustomerDetail(CustomerView customer, List<ContactView> contacts,
        List<OpportunityView> opportunities, List<EventView> history, List<String> allowedActions) {}
    public record MergePreview(CustomerView target, CustomerView source, int contacts, int opportunities,
        List<String> conflicts) {}
    public record OpportunityView(UUID id, long version, String code, UUID customerId, String customerName,
        String title, String eventKey, UUID ownerAccountId, String ownerName, String source,
        String grade, String progress, String procurementMethod, BigDecimal estimatedAmount,
        LocalDate targetDate, String background, String status, String result, UUID projectId,
        String health, String nextAction, String nextOwnerName, LocalDate nextDueDate, Instant updatedAt) {}
    public record ActivityView(UUID id, String fact, String nextAction, UUID assigneeId,
        String assigneeName, LocalDate dueDate, String recordedByName, Instant createdAt) {}
    public record OpportunityDetail(OpportunityView opportunity, List<ActivityView> activities,
        List<EventView> history, List<String> allowedActions) {}
}
