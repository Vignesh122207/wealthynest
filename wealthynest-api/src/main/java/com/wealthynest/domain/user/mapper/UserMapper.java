package com.wealthynest.domain.user.mapper;

import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {
    @Mapping(target = "role", expression = "java(user.getRole().name())")
    @Mapping(target = "active", source = "active")
    @Mapping(target = "pinEnabled", expression = "java(user.getPinHash() != null)")
    UserResponse toResponse(User user);
}
