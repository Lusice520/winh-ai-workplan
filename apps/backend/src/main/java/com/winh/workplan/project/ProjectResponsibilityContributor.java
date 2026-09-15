package com.winh.workplan.project;

import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.List;
import java.util.UUID;

/** Each owning module validates and moves its own unfinished responsibilities under the project lock. */
public interface ProjectResponsibilityContributor {
    String responsibilityDomain();
    List<Responsibility> responsibilities(SessionPrincipal actor,UUID projectId,UUID fromId,UUID toId);
    void transferResponsibilities(SessionPrincipal actor,UUID projectId,UUID fromId,UUID toId,List<Responsibility> expected,String reason);
    void validateRecipient(UUID projectId,UUID toId,List<Responsibility> responsibilities);
    record Responsibility(String domain,UUID objectId,long version,String title,List<String> roles) {}
}
