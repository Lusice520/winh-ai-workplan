package com.winh.workplan.work;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryTaskProfileRepository extends JpaRepository<DeliveryTaskProfile,UUID> {
    List<DeliveryTaskProfile> findAllByProjectIdAndWorkPackageIdOrderByUpdatedAtDesc(UUID projectId,UUID workPackageId);
}
