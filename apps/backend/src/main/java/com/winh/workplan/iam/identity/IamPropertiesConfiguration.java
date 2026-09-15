package com.winh.workplan.iam.identity;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({ BootstrapProperties.class, SessionProperties.class })
class IamPropertiesConfiguration {
}
