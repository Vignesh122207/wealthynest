package com.wealthynest.domain.family.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "families")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Family extends BaseEntity {
    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "invite_code", unique = true, nullable = false, length = 20)
    private String inviteCode;
}
