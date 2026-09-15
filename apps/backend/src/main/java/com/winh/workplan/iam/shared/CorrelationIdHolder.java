package com.winh.workplan.iam.shared;

import java.util.UUID;

public final class CorrelationIdHolder {

	private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

	private CorrelationIdHolder() {
	}

	public static String currentOrCreate() {
		String value = CURRENT.get();
		return value == null ? UUID.randomUUID().toString() : value;
	}

	public static void set(String value) {
		CURRENT.set(value);
	}

	public static void clear() {
		CURRENT.remove();
	}
}
