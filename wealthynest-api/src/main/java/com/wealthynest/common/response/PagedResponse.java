package com.wealthynest.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Page;
import java.time.Instant;
import java.util.List;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PagedResponse<T> {
    private final boolean  success;
    private final int      status;
    private final List<T>  data;
    private final PageMeta meta;
    @Builder.Default
    private final Instant timestamp = Instant.now();

    public static <T> PagedResponse<T> of(Page<T> page) {
        return PagedResponse.<T>builder()
                .success(true).status(200)
                .data(page.getContent())
                .meta(PageMeta.of(page))
                .build();
    }

    @Getter
    @Builder
    public static class PageMeta {
        private final int     page;
        private final int     size;
        private final long    totalElements;
        private final int     totalPages;
        private final boolean first;
        private final boolean last;

        public static PageMeta of(Page<?> page) {
            return PageMeta.builder()
                    .page(page.getNumber()).size(page.getSize())
                    .totalElements(page.getTotalElements())
                    .totalPages(page.getTotalPages())
                    .first(page.isFirst()).last(page.isLast())
                    .build();
        }
    }
}
