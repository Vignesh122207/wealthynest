package com.wealthynest.domain.category.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "categories")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Category extends BaseEntity {
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "family_id")
    private UUID familyId;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(length = 50)
    private String icon;

    @Column(length = 7)
    private String color;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CategoryType type;

    @Column(name = "is_system", nullable = false)
    @Builder.Default
    private boolean system = false;

    // Soft-delete: archived categories are hidden from pickers/lists but keep labelling the
    // expenses that reference them; recreating the same name+type un-archives the row.
    @Column(nullable = false)
    @Builder.Default
    private boolean archived = false;
}
