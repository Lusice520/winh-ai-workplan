package com.winh.workplan.handover;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface EarlyStartReviewRepository extends JpaRepository<EarlyStartReview,UUID> {
java.util.List<EarlyStartReview> findAllByApplicationIdOrderByCreatedAtDesc(UUID id);
}
