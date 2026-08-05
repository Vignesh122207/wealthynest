package com.wealthynest.domain.asset.repository;

import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.entity.AssetType;
import com.wealthynest.domain.family.entity.Family;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AssetRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private AssetRepository assetRepository;

    private UUID userId;
    private UUID familyId;

    @BeforeEach
    void seedUserAndFamily() {
        User user = User.builder().fullName("Ivan").email("ivan-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();

        Family family = Family.builder().name("The Ivans").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
        entityManager.persist(family);
        familyId = family.getId();

        entityManager.flush();
    }

    private Asset persistAsset(UUID userId, UUID familyId, BigDecimal value, boolean active) {
        Asset a = Asset.builder().userId(userId).familyId(familyId).name("Asset").assetType(AssetType.REAL_ESTATE)
                .currentValue(value).asOfDate(LocalDate.now()).active(active).build();
        entityManager.persist(a);
        return a;
    }

    @Nested
    @DisplayName("basic lookups")
    class LookupTests {

        @Test
        @DisplayName("findByUserIdAndActiveTrue excludes inactive assets")
        void findByUserExcludesInactive() {
            persistAsset(userId, null, new BigDecimal("1000"), true);
            persistAsset(userId, null, new BigDecimal("500"), false);
            entityManager.flush();

            List<Asset> result = assetRepository.findByUserIdAndActiveTrue(userId);

            assertThat(result).hasSize(1);
        }

        @Test
        @DisplayName("findByIdAndUserId does not leak another user's asset even by correct id")
        void findByIdAndUserIdScopesToOwner() {
            Asset asset = persistAsset(userId, null, new BigDecimal("1000"), true);
            entityManager.flush();

            assertThat(assetRepository.findByIdAndUserId(asset.getId(), userId)).isPresent();
            assertThat(assetRepository.findByIdAndUserId(asset.getId(), UUID.randomUUID())).isEmpty();
        }
    }

    @Nested
    @DisplayName("aggregate sums")
    class AggregateSumTests {

        @Test
        @DisplayName("sumCurrentValueByUser only counts active assets")
        void sumCurrentValueOnlyActive() {
            persistAsset(userId, null, new BigDecimal("1000"), true);
            persistAsset(userId, null, new BigDecimal("500"), false);
            entityManager.flush();

            assertThat(assetRepository.sumCurrentValueByUser(userId)).isEqualByComparingTo("1000");
        }

        @Test
        @DisplayName("sumCurrentValueByFamily scopes strictly by familyId")
        void sumCurrentValueByFamilyScoped() {
            persistAsset(userId, familyId, new BigDecimal("1000"), true);
            persistAsset(userId, null, new BigDecimal("500"), true); // no family — excluded
            entityManager.flush();

            assertThat(assetRepository.sumCurrentValueByFamily(familyId)).isEqualByComparingTo("1000");
        }

        @Test
        @DisplayName("sumManualAssetValueByUserIn aggregates active assets across multiple users in one query")
        void sumManualByUserInAggregatesAcrossUsers() {
            User user2 = User.builder().fullName("Jack").email("jack-" + UUID.randomUUID() + "@x.com")
                    .passwordHash("hash").build();
            entityManager.persist(user2);
            entityManager.flush();

            persistAsset(userId, null, new BigDecimal("1000"), true);
            persistAsset(user2.getId(), null, new BigDecimal("2000"), true);
            persistAsset(user2.getId(), null, new BigDecimal("500"), false); // inactive — excluded
            entityManager.flush();

            BigDecimal sum = assetRepository.sumManualAssetValueByUserIn(List.of(userId, user2.getId()));

            assertThat(sum).isEqualByComparingTo("3000");
        }
    }

    @Nested
    @DisplayName("family-linkage modifying queries")
    class FamilyLinkageTests {

        @Test
        @DisplayName("migrateUserAssetsToFamily only touches assets with no existing familyId")
        void migrateOnlyTouchesUnassigned() {
            Family otherFamily = Family.builder().name("Other").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
            entityManager.persist(otherFamily);

            Asset unassigned = persistAsset(userId, null, new BigDecimal("1000"), true);
            Asset alreadyAssigned = persistAsset(userId, otherFamily.getId(), new BigDecimal("500"), true);
            entityManager.flush();
            entityManager.clear();

            assetRepository.migrateUserAssetsToFamily(familyId, userId);
            entityManager.flush();
            entityManager.clear();

            assertThat(entityManager.find(Asset.class, unassigned.getId()).getFamilyId()).isEqualTo(familyId);
            assertThat(entityManager.find(Asset.class, alreadyAssigned.getId()).getFamilyId()).isEqualTo(otherFamily.getId());
        }

        @Test
        @DisplayName("clearFamilyId nulls familyId for every asset in the family")
        void clearFamilyIdNullsAll() {
            Asset asset = persistAsset(userId, familyId, new BigDecimal("1000"), true);
            entityManager.flush();
            entityManager.clear();

            assetRepository.clearFamilyId(familyId);
            entityManager.clear();

            assertThat(entityManager.find(Asset.class, asset.getId()).getFamilyId()).isNull();
        }

        @Test
        @DisplayName("clearFamilyIdForUser only detaches the specified user's assets")
        void clearFamilyIdForUserOnlyTouchesThatUser() {
            Asset mine = persistAsset(userId, familyId, new BigDecimal("1000"), true);

            User otherUser = User.builder().fullName("Kara").email("kara-" + UUID.randomUUID() + "@x.com")
                    .passwordHash("hash").build();
            entityManager.persist(otherUser);
            Asset theirs = persistAsset(otherUser.getId(), familyId, new BigDecimal("500"), true);
            entityManager.flush();
            entityManager.clear();

            assetRepository.clearFamilyIdForUser(userId, familyId);
            entityManager.clear();

            assertThat(entityManager.find(Asset.class, mine.getId()).getFamilyId()).isNull();
            assertThat(entityManager.find(Asset.class, theirs.getId()).getFamilyId()).isEqualTo(familyId);
        }
    }
}
