package com.winh.workplan.iam.authorization;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.winh.workplan.iam.menu.MenuResourceStatus;
import com.winh.workplan.iam.menu.MenuResourceType;

/**
 * HTTP-facing read models for the access-control workspace. They intentionally
 * contain only registered authorization metadata, never a password, session
 * token, or business-object payload.
 */
public final class AccessControlResponses {

	private AccessControlResponses() {
	}

	public record MenuResourceResponse(
			UUID id,
			String code,
			MenuResourceType resourceType,
			UUID parentId,
			String name,
			String routeKey,
			String actionKey,
			String iconKey,
			int sortOrder,
			MenuResourceStatus status,
			long version) {
	}

	public record MenuResourceImpactResponse(
			UUID resourceId,
			long directChildCount,
			long permissionItemCount,
			long roleGrantCount,
			long temporaryGrantCount) {
	}

	public record PermissionItemResponse(
			UUID id,
			String code,
			UUID menuResourceId,
			String menuResourceCode,
			String name,
			String actionKey,
			PermissionDimension dimension,
			RiskLevel riskLevel,
			boolean canDelegate,
			PermissionItemStatus status,
			long version) {
	}

	public record RoleGrantResponse(
			UUID id,
			String permissionCode,
			String permissionName,
			String actionKey,
			PermissionDimension dimension,
			RiskLevel riskLevel,
			DataScope dataScope,
			String scopeReferences,
			String conditionSummary) {
	}

	public record AccessRoleResponse(
			UUID id,
			String code,
			String name,
			AccessRoleType roleType,
			String responsibilitySummary,
			AccessRoleStatus status,
			int delegationLevel,
			long version,
			long activeAssignmentCount,
			List<RoleGrantResponse> grants) {

		public AccessRoleResponse {
			grants = List.copyOf(grants);
		}
	}

	public record RoleImpactResponse(
			UUID roleId,
			long activeAssignmentCount,
			long historicalAssignmentCount,
			long permissionGrantCount,
			long relatedTemporaryGrantCount) {
	}

	public record SystemRoleAssignmentResponse(
			UUID id,
			UUID accountId,
			String accountLoginName,
			String accountDisplayName,
			UUID roleId,
			String roleCode,
			String roleName,
			SystemRoleAssignmentStatus status,
			UUID assignedByAccountId,
			Instant assignedAt,
			long version) {
	}

	public record SystemRoleAssignmentSetResponse(
			UUID accountId,
			long version,
			List<SystemRoleAssignmentResponse> assignments) {

		public SystemRoleAssignmentSetResponse {
			assignments = List.copyOf(assignments);
		}
	}

	public record TemporaryGrantResponse(
			UUID id,
			UUID recipientAccountId,
			String recipientLoginName,
			String recipientDisplayName,
			String permissionCode,
			String permissionName,
			RiskLevel riskLevel,
			DataScope dataScope,
			String scopeReferences,
			Instant startsAt,
			Instant endsAt,
			String reason,
			UUID reviewerAccountId,
			UUID createdByAccountId,
			String createdByName,
			String reviewerName,
			UUID reviewedByAccountId,
			Instant reviewedAt,
			String reviewComment,
			TemporaryGrantStatus status,
			Instant revokedAt,
			UUID revokedByAccountId,
			String revokeReason,
			long version,
			List<String> allowedActions) {
	}

	public record PermissionPreviewResponse(
			UUID subjectAccountId,
			String permissionCode,
			boolean allowed,
			String reasonCode,
			List<String> explanation) {

		public PermissionPreviewResponse {
			explanation = List.copyOf(explanation);
		}
	}
}
