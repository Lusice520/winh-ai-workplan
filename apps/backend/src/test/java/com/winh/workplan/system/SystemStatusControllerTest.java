package com.winh.workplan.system;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
		controllers = SystemStatusController.class,
		excludeAutoConfiguration = UserDetailsServiceAutoConfiguration.class)
@AutoConfigureMockMvc(addFilters = false)
class SystemStatusControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void returnsTheLocalServiceStatusContract() throws Exception {
		mockMvc.perform(get("/api/system/status"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("UP"))
				.andExpect(jsonPath("$.service").value("workplan-backend"))
				.andExpect(jsonPath("$.version").value("0.1.0"))
				.andExpect(jsonPath("$.timestamp").isString());
	}
}
