package com.winh.workplan.contracts;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.*;
public interface ContractDirectory {
    List<ContractViews.Master> forProject(SessionPrincipal actor, UUID projectId);
    ContractReference requireArchivedPrimary(SessionPrincipal actor, UUID projectId);
    ContractNodeReference requireNode(SessionPrincipal actor, UUID projectId, UUID nodeId);
    List<ContractNodeReference> nodeOptions(SessionPrincipal actor, UUID projectId);
    ContractFinancialReference financialReference(SessionPrincipal actor, UUID projectId, UUID contractId, boolean requireArchived);
    record ContractFinancialReference(UUID id,long version,String number,String title,String status,String archiveStatus) {}
    record ContractReference(UUID id, long version, UUID projectId, String number, List<UUID> signedFileVersionIds) {}
    record ContractNodeReference(UUID id, UUID contractId, long version, String title, java.time.LocalDate dueDate) {}
}
