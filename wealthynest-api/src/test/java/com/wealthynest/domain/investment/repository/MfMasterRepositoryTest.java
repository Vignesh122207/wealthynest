package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.MfMaster;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MfMasterRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private MfMasterRepository mfMasterRepository;

    private MfMaster persistScheme(String code, String name) {
        MfMaster m = MfMaster.builder().schemeCode(code).schemeName(name).updatedAt(Instant.now()).build();
        entityManager.persist(m);
        return m;
    }

    @Test
    @DisplayName("search matches a substring case-insensitively, ranking a starts-with match ahead of a contains-only match")
    void searchRanksStartsWithFirst() {
        MfMaster startsWith = persistScheme("SC001", "Axis Bluechip Fund - Direct Growth");
        MfMaster containsOnly = persistScheme("SC002", "HDFC Axis Advantage Fund - Direct Growth"); // "Axis" appears mid-string
        entityManager.flush();

        List<MfMaster> results = mfMasterRepository.search("axis", Pageable.ofSize(10));

        assertThat(results).extracting(MfMaster::getSchemeCode).containsExactly("SC001", "SC002");
    }

    @Test
    @DisplayName("search returns nothing for a substring that matches no scheme name")
    void searchReturnsEmptyForNoMatch() {
        persistScheme("SC001", "Axis Bluechip Fund - Direct Growth");
        entityManager.flush();

        assertThat(mfMasterRepository.search("nonexistentfund", Pageable.ofSize(10))).isEmpty();
    }

    @Test
    @DisplayName("truncate empties the table (rolled back automatically at the end of this test)")
    void truncateEmptiesTable() {
        persistScheme("SC001", "Axis Bluechip Fund - Direct Growth");
        entityManager.flush();
        assertThat(mfMasterRepository.count()).isGreaterThan(0);

        mfMasterRepository.truncate();

        assertThat(mfMasterRepository.count()).isZero();
    }
}
