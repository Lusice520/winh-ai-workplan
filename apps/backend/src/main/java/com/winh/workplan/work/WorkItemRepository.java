package com.winh.workplan.work;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface WorkItemRepository extends JpaRepository<ProjectWorkItem,UUID>{
    List<ProjectWorkItem> findAllByProjectIdOrderByUpdatedAtDesc(UUID projectId);
}
