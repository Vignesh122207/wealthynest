package com.wealthynest.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import java.time.Duration;
import java.util.Map;

@Configuration
@EnableCaching
public class CacheConfig {
    public static final String CACHE_CATEGORIES   = "categories";
    public static final String CACHE_USER_PROFILE = "userProfile";
    public static final String CACHE_FAMILY       = "family";
    public static final String CACHE_DASHBOARD    = "dashboard";

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new GenericJackson2JsonRedisSerializer()))
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> configs = Map.of(
            CACHE_CATEGORIES,   defaultConfig.entryTtl(Duration.ofHours(1)),
            CACHE_USER_PROFILE, defaultConfig.entryTtl(Duration.ofMinutes(15)),
            CACHE_FAMILY,       defaultConfig.entryTtl(Duration.ofMinutes(15)),
            CACHE_DASHBOARD,    defaultConfig.entryTtl(Duration.ofMinutes(5))
        );
        return RedisCacheManager.builder(factory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(configs)
                .build();
    }
}
