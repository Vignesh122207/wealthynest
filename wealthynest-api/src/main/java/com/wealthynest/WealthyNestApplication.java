package com.wealthynest;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableCaching
@EnableAsync
@EnableScheduling
@ConfigurationPropertiesScan("com.wealthynest.config")
public class WealthyNestApplication {
    public static void main(String[] args) {SpringApplication.run(WealthyNestApplication.class, args);
    }
}
