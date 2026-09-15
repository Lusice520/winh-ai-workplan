package com.winh.workplan.iam.shared;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;

@RestControllerAdvice
public class GlobalApiExceptionHandler {

	@ExceptionHandler(DomainException.class)
	public ResponseEntity<ApiProblem> handleDomainException(DomainException exception) {
		return ResponseEntity.status(exception.status())
				.body(new ApiProblem(
						exception.code(),
						exception.getMessage(),
						exception.fieldErrors(),
						CorrelationIdHolder.currentOrCreate()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiProblem> handleValidation(MethodArgumentNotValidException exception) {
		List<ApiProblem.FieldProblem> fields = exception.getBindingResult().getFieldErrors().stream()
				.map(this::toFieldProblem)
				.toList();
		return ResponseEntity.badRequest().body(new ApiProblem(
				"VALIDATION_FAILED",
				"请检查输入后重试。",
				fields,
				CorrelationIdHolder.currentOrCreate()));
	}

	@ExceptionHandler({
			MissingRequestHeaderException.class,
			MethodArgumentTypeMismatchException.class,
			HttpMessageNotReadableException.class
	})
	public ResponseEntity<ApiProblem> handleMalformedRequest(Exception exception) {
		String field = "request";
		String message = "请求参数不合法。";
		if (exception instanceof MissingRequestHeaderException missingHeader) {
			field = missingHeader.getHeaderName();
			message = "缺少必要请求头。";
		} else if (exception instanceof MethodArgumentTypeMismatchException typeMismatch) {
			field = typeMismatch.getName();
		}
		return ResponseEntity.badRequest().body(new ApiProblem(
				"VALIDATION_FAILED",
				"请检查输入后重试。",
				List.of(new ApiProblem.FieldProblem(field, message)),
				CorrelationIdHolder.currentOrCreate()));
	}

    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiProblem> handleUnsupportedMethod(org.springframework.web.HttpRequestMethodNotSupportedException exception) {
        var headers = new org.springframework.http.HttpHeaders();
        if (exception.getSupportedHttpMethods() != null) headers.setAllow(exception.getSupportedHttpMethods());
        return new ResponseEntity<>(new ApiProblem("METHOD_NOT_ALLOWED", "此资源不支持该操作。", List.of(),
            CorrelationIdHolder.currentOrCreate()), headers, HttpStatus.METHOD_NOT_ALLOWED);
    }

    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<ApiProblem> handleUnknownResource(Exception exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiProblem("RESOURCE_NOT_FOUND", "未找到请求的资源。",
            List.of(), CorrelationIdHolder.currentOrCreate()));
    }

	@ExceptionHandler(Exception.class)

	public ResponseEntity<ApiProblem> handleUnexpectedException(Exception exception) {
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiProblem(
				"INTERNAL_ERROR",
				"服务暂时不可用，请稍后重试。",
				List.of(),
				CorrelationIdHolder.currentOrCreate()));
	}

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiProblem> handleOversizedUpload(Exception exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(new ApiProblem("FILE_TOO_LARGE",
            "文件超过允许大小，请使用符合上传限制的文件。", List.of(new ApiProblem.FieldProblem("file", "文件大小超出限制。")), CorrelationIdHolder.currentOrCreate()));
    }

	@ExceptionHandler({org.springframework.dao.OptimisticLockingFailureException.class,
			jakarta.persistence.OptimisticLockException.class})
	public ResponseEntity<ApiProblem> handleConcurrentUpdate(Exception exception) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiProblem("VERSION_CONFLICT",
				"记录已被更新，请加载最新内容后重新提交。", List.of(), CorrelationIdHolder.currentOrCreate()));
	}

	@ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
	public ResponseEntity<ApiProblem> handleDataConflict(Exception exception) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiProblem("DATA_CONFLICT",
				"记录存在重复或关联冲突，请刷新并检查最新记录。", List.of(), CorrelationIdHolder.currentOrCreate()));
	}


	private ApiProblem.FieldProblem toFieldProblem(FieldError fieldError) {
		String message = fieldError.getDefaultMessage() == null ? "输入不合法。" : fieldError.getDefaultMessage();
		return new ApiProblem.FieldProblem(fieldError.getField(), message);
	}
}
