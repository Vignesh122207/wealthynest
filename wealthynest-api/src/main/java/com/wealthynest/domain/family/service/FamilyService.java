package com.wealthynest.domain.family.service;

import com.wealthynest.domain.family.dto.request.CreateFamilyRequest;
import com.wealthynest.domain.family.dto.request.JoinFamilyRequest;
import com.wealthynest.domain.family.dto.request.RenameFamilyRequest;
import com.wealthynest.domain.family.dto.response.FamilyMemberResponse;
import com.wealthynest.domain.family.dto.response.FamilyResponse;
import java.util.List;
import java.util.UUID;

public interface FamilyService {
    FamilyResponse createFamily(UUID userId, CreateFamilyRequest request, String ipAddress, String userAgent);
    FamilyResponse joinFamily(UUID userId, JoinFamilyRequest request);
    FamilyResponse getFamily(UUID userId, UUID familyId);
    FamilyResponse renameFamily(UUID familyId, UUID userId, RenameFamilyRequest request);
    void leaveFamily(UUID userId);
    void deleteFamily(UUID familyId, UUID userId, String ipAddress, String userAgent);
    List<FamilyMemberResponse> getMembers(UUID userId, UUID familyId);
    void removeMember(UUID familyId, UUID adminId, UUID memberId);
    void transferAdmin(UUID familyId, UUID adminId, UUID newAdminId, String ipAddress, String userAgent);
    void revokeAdmin(UUID familyId, UUID adminId, UUID targetId, String ipAddress, String userAgent);
}
