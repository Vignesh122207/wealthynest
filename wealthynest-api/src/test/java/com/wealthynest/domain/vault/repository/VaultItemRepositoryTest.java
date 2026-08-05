package com.wealthynest.domain.vault.repository;

import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.vault.entity.VaultItem;
import com.wealthynest.domain.vault.entity.VaultItemType;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class VaultItemRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private VaultItemRepository vaultItemRepository;

    private UUID userId;

    @BeforeEach
    void seedUser() {
        User user = User.builder().fullName("Ivan").email("ivan-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();
        entityManager.flush();
    }

    private VaultItem persistItem(UUID userId, String title, boolean favorite) {
        VaultItem item = VaultItem.builder()
                .userId(userId).itemType(VaultItemType.LOGIN).title(title)
                .secretCiphertext("ct").secretIv("iv").favorite(favorite).build();
        entityManager.persist(item);
        return item;
    }

    @Test
    @DisplayName("findByUserIdOrderByFavoriteDescTitleAsc puts favorites first, then alphabetical by title")
    void ordersFavoritesFirstThenAlphabetical() {
        persistItem(userId, "Zebra Bank", false);
        persistItem(userId, "Amazon", false);
        persistItem(userId, "Netflix", true);
        entityManager.flush();

        List<VaultItem> result = vaultItemRepository.findByUserIdOrderByFavoriteDescTitleAsc(userId);

        assertThat(result).extracting(VaultItem::getTitle).containsExactly("Netflix", "Amazon", "Zebra Bank");
    }

    @Test
    @DisplayName("findByUserIdOrderByFavoriteDescTitleAsc never returns another user's items")
    void scopesStrictlyToOwner() {
        User otherUser = User.builder().fullName("Kara").email("kara-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(otherUser);
        persistItem(userId, "Mine", false);
        persistItem(otherUser.getId(), "Theirs", false);
        entityManager.flush();

        List<VaultItem> result = vaultItemRepository.findByUserIdOrderByFavoriteDescTitleAsc(userId);

        assertThat(result).extracting(VaultItem::getTitle).containsExactly("Mine");
    }
}
