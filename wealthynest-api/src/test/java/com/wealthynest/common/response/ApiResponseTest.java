package com.wealthynest.common.response;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

// A null `data` payload (e.g. InvestmentServiceImpl#computePortfolioXirr when there's nothing to
// compute XIRR from) must still serialize as "data": null, not be dropped from the JSON entirely
// — the frontend's ApiResponse<T> unwrapping (`.data.data`) turns a missing key into `undefined`,
// which TanStack Query treats as an invalid query result and routes to the global error toast.
class ApiResponseTest {

    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void nullDataIsSerializedExplicitly() throws Exception {
        ApiResponse<Double> response = ApiResponse.success(null);

        JsonNode json = mapper.readTree(mapper.writeValueAsString(response));

        assertThat(json.has("data")).isTrue();
        assertThat(json.get("data").isNull()).isTrue();
    }

    @Test
    void nullMessageIsOmitted() throws Exception {
        ApiResponse<Double> response = ApiResponse.success(1.5);

        JsonNode json = mapper.readTree(mapper.writeValueAsString(response));

        assertThat(json.has("message")).isFalse();
    }

    @Test
    void presentMessageIsSerialized() throws Exception {
        ApiResponse<Double> response = ApiResponse.success(1.5, "ok");

        JsonNode json = mapper.readTree(mapper.writeValueAsString(response));

        assertThat(json.get("message").asText()).isEqualTo("ok");
    }
}
