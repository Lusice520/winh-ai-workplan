package com.winh.workplan.delivery.baseline;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryReviewRepository extends JpaRepository<DeliveryReview,UUID> {
    List<DeliveryReview> findAllByRoundIdOrderByCreatedAtAsc(UUID roundId);
}
