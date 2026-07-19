package com.wealthynest.domain.vault.mapper;

import com.wealthynest.domain.vault.dto.response.VaultItemResponse;
import com.wealthynest.domain.vault.entity.VaultItem;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface VaultItemMapper {
    @Mapping(target = "itemType", expression = "java(item.getItemType().name())")
    @Mapping(target = "hasTotp", expression = "java(item.getTotpCiphertext() != null)")
    VaultItemResponse toResponse(VaultItem item);
}
