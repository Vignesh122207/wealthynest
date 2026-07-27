package com.wealthynest.domain.category.mapper;

import com.wealthynest.domain.category.dto.request.CreateCategoryRequest;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CategoryMapperImplTest {

    private final CategoryMapper mapper = new CategoryMapperImpl();

    @Test
    @DisplayName("toResponse(null) -> null")
    void toResponse_null_returnsNull() {
        assertThat(mapper.toResponse(null)).isNull();
    }

    @Test
    @DisplayName("toResponse maps all fields, including type via its expression and system/userId")
    void toResponse_mapsAllFields() {
        UUID userId = UUID.randomUUID();
        Category category = Category.builder()
                .userId(userId).name("Groceries").icon("cart").color("#00FF00")
                .type(CategoryType.EXPENSE).system(true).build();
        ReflectionTestUtils.setField(category, "id", UUID.randomUUID());

        var response = mapper.toResponse(category);

        assertThat(response.getName()).isEqualTo("Groceries");
        assertThat(response.getIcon()).isEqualTo("cart");
        assertThat(response.getColor()).isEqualTo("#00FF00");
        assertThat(response.getType()).isEqualTo("EXPENSE");
        assertThat(response.isSystem()).isTrue();
        assertThat(response.getUserId()).isEqualTo(userId);
    }

    @Test
    @DisplayName("toResponseList(null) -> null")
    void toResponseList_null_returnsNull() {
        assertThat(mapper.toResponseList(null)).isNull();
    }

    @Test
    @DisplayName("toResponseList maps each element in order")
    void toResponseList_mapsEachElement() {
        Category c1 = Category.builder().name("Food").type(CategoryType.EXPENSE).build();
        Category c2 = Category.builder().name("Salary").type(CategoryType.INCOME).build();

        List<com.wealthynest.domain.category.dto.response.CategoryResponse> responses =
                mapper.toResponseList(List.of(c1, c2));

        assertThat(responses).hasSize(2);
        assertThat(responses.get(0).getName()).isEqualTo("Food");
        assertThat(responses.get(1).getName()).isEqualTo("Salary");
    }

    @Test
    @DisplayName("toEntity(null) -> null")
    void toEntity_null_returnsNull() {
        assertThat(mapper.toEntity(null)).isNull();
    }

    @Test
    @DisplayName("toEntity maps request fields and forces system=false regardless of input")
    void toEntity_mapsFieldsAndForcesSystemFalse() {
        CreateCategoryRequest req = new CreateCategoryRequest();
        ReflectionTestUtils.setField(req, "name", "Rent");
        ReflectionTestUtils.setField(req, "icon", "home");
        ReflectionTestUtils.setField(req, "color", "#123456");
        ReflectionTestUtils.setField(req, "type", CategoryType.EXPENSE);

        Category entity = mapper.toEntity(req);

        assertThat(entity.getName()).isEqualTo("Rent");
        assertThat(entity.getIcon()).isEqualTo("home");
        assertThat(entity.getColor()).isEqualTo("#123456");
        assertThat(entity.getType()).isEqualTo(CategoryType.EXPENSE);
        assertThat(entity.isSystem()).isFalse();
        assertThat(entity.getId()).isNull();
    }
}
