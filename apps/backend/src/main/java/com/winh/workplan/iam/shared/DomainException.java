package com.winh.workplan.iam.shared;

import java.util.List;

import org.springframework.http.HttpStatus;

public class DomainException extends RuntimeException {

	private final HttpStatus status;
	private final String code;
	private final List<ApiProblem.FieldProblem> fieldErrors;

	public DomainException(HttpStatus status, String code, String message) {
		this(status, code, message, List.of());
	}

	public DomainException(
			HttpStatus status,
			String code,
			String message,
			List<ApiProblem.FieldProblem> fieldErrors) {
		super(message);
		this.status = status;
		this.code = code;
		this.fieldErrors = List.copyOf(fieldErrors);
	}

	public HttpStatus status() {
		return status;
	}

	public String code() {
		return code;
	}

	public List<ApiProblem.FieldProblem> fieldErrors() {
		return fieldErrors;
	}
}
