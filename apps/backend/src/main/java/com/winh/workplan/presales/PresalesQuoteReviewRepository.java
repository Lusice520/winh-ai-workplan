package com.winh.workplan.presales;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface PresalesQuoteReviewRepository extends JpaRepository<PresalesQuoteReview, UUID> {
    List<PresalesQuoteReview> findAllByProjectIdOrderByCreatedAtDesc(UUID projectId);
}
