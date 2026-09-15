package com.winh.workplan.iam.shared;

import java.util.List;
import java.util.function.Function;

import org.springframework.data.domain.Page;

public record PageResponse<T>(List<T> items, int page, int pageSize, long total) {

	public static <S, T> PageResponse<T> from(Page<S> source, Function<S, T> mapper) {
		return new PageResponse<>(
				source.getContent().stream().map(mapper).toList(),
				source.getNumber() + 1,
				source.getSize(),
				source.getTotalElements());
	}
}
