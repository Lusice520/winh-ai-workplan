package com.winh.workplan.iam.shared;

import java.util.List;

public record ApiProblem(
		String code,
		String message,
		List<FieldProblem> fieldErrors,
		String correlationId) {

	public record FieldProblem(String field, String message) {
	}
}
