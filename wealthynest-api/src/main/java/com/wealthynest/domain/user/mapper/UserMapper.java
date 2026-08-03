package com.wealthynest.domain.user.mapper;

import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {
    // hasPasskeys can't be derived from `User` alone (it's a WebAuthnCredential existence check,
    // a different domain/repository) - callers compute it themselves and pass it in, same as any
    // other cross-domain lookup a mapper can't reach on its own.
    @Mapping(target = "role", expression = "java(user.getRole().name())")
    @Mapping(target = "active", source = "user.active")
    @Mapping(target = "pinEnabled", expression = "java(user.getPinHash() != null)")
    @Mapping(target = "hasPasskeys", source = "hasPasskeys")
    UserResponse toResponse(User user, boolean hasPasskeys);
}
