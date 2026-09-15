package com.winh.workplan.iam.identity;

import java.util.List;

import com.winh.workplan.iam.shared.ApiProblem;
import com.winh.workplan.iam.shared.DomainException;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class PasswordPolicy {

	private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

	public String hash(String rawPassword) {
		validate(rawPassword);
		return passwordEncoder.encode(rawPassword);
	}

	public boolean matches(String rawPassword, String passwordHash) {
		return passwordEncoder.matches(rawPassword, passwordHash);
	}

	public void validate(String rawPassword) {
		if (rawPassword == null || rawPassword.length() < 12) {
			throw new DomainException(
					HttpStatus.BAD_REQUEST,
					"VALIDATION_FAILED",
					"请检查输入后重试。",
					List.of(new ApiProblem.FieldProblem("password", "密码至少需要 12 位。")));
		}
		boolean hasLetter = rawPassword.chars().anyMatch(Character::isLetter);
		boolean hasDigit = rawPassword.chars().anyMatch(Character::isDigit);
		boolean hasOther = rawPassword.chars().anyMatch(character -> !Character.isLetterOrDigit(character));
		if (!hasLetter || !hasDigit || !hasOther) {
			throw new DomainException(
					HttpStatus.BAD_REQUEST,
					"VALIDATION_FAILED",
					"请检查输入后重试。",
					List.of(new ApiProblem.FieldProblem("password", "密码需包含字母、数字和符号。")));
		}
	}
}
