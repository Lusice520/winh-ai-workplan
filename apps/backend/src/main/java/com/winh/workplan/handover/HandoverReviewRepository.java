package com.winh.workplan.handover;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface HandoverReviewRepository extends JpaRepository<HandoverReview,UUID> {
java.util.List<HandoverReview> findAllByCaseIdOrderByCreatedAtDesc(UUID id);
}
