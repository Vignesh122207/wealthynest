package com.wealthynest.domain.category.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.category.dto.request.CreateCategoryRequest;
import com.wealthynest.domain.category.dto.response.CategoryResponse;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.service.CategoryService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CategoryController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class CategoryControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private CategoryService categoryService;

    private final UUID userId = UUID.randomUUID();
    private final UUID familyId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateCategoryRequest validRequest() {
        CreateCategoryRequest req = new CreateCategoryRequest();
        ReflectionTestUtils.setField(req, "name", "Groceries");
        ReflectionTestUtils.setField(req, "type", CategoryType.EXPENSE);
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(categoryService);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a name shorter than 2 chars fails @Size validation")
        void tooShortNameFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateCategoryRequest req = validRequest();
            ReflectionTestUtils.setField(req, "name", "A");

            mockMvc.perform(post("/api/v1/categories")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.name").exists());
        }

        @Test
        @DisplayName("a missing type fails @NotNull validation")
        void missingTypeFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateCategoryRequest req = validRequest();
            ReflectionTestUtils.setField(req, "type", null);

            mockMvc.perform(post("/api/v1/categories")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.type").exists());
        }

        @Test
        @DisplayName("a color longer than 7 chars fails @Size validation")
        void colorTooLongFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateCategoryRequest req = validRequest();
            ReflectionTestUtils.setField(req, "color", "#TOOLONGCOLOR");

            mockMvc.perform(post("/api/v1/categories")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.color").exists());
        }
    }

    @Nested
    @DisplayName("family-scoped delegation")
    class DelegationTests {

        @Test
        @DisplayName("GET /categories passes the server-resolved familyId (not client-supplied) to the service")
        void getCategoriesPassesServerResolvedFamilyId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, familyId);
            when(categoryService.getCategories(userId, familyId)).thenReturn(List.of(
                    CategoryResponse.builder().id(UUID.randomUUID()).name("Groceries").build()));

            mockMvc.perform(get("/api/v1/categories"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.length()").value(1));
        }

        @Test
        @DisplayName("POST /categories creates and returns 201 with the response body")
        void createReturns201() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(categoryService.createCategory(eq(userId), eq(null), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(CategoryResponse.builder().id(UUID.randomUUID()).name("Groceries").build());

            mockMvc.perform(post("/api/v1/categories")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validRequest())))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.name").value("Groceries"));
        }

        @Test
        @DisplayName("DELETE /categories/{id} delegates userId and familyId to the service")
        void deleteDelegatesUserAndFamily() throws Exception {
            SecurityTestUtils.authenticateAs(userId, familyId);
            UUID categoryId = UUID.randomUUID();

            mockMvc.perform(delete("/api/v1/categories/{id}", categoryId))
                    .andExpect(status().isOk());

            verify(categoryService).deleteCategory(categoryId, userId, familyId);
        }
    }
}
