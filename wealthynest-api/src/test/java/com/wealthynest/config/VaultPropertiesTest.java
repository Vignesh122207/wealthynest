package com.wealthynest.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VaultPropertiesTest {

    private static final String VALID_KEY   = Base64.getEncoder().encodeToString(new byte[32]);
    private static final String VALID_KEY_2 = Base64.getEncoder().encodeToString(new byte[]{
        1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32});

    private VaultProperties validProperties() {
        VaultProperties props = new VaultProperties();
        props.setEncryptionKey(VALID_KEY);
        props.setHashPepper("a-real-random-pepper");
        return props;
    }

    @Test
    @DisplayName("valid key + pepper -> validate() passes without throwing")
    void validConfig_passes() {
        assertThatCode(() -> validProperties().validate()).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("null encryptionKey -> throws FATAL")
    void nullEncryptionKey_throws() {
        VaultProperties props = validProperties();
        props.setEncryptionKey(null);
        assertThatThrownBy(props::validate).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("VAULT_ENCRYPTION_KEY");
    }

    @Test
    @DisplayName("insecure default encryptionKey -> throws FATAL")
    void defaultEncryptionKey_throws() {
        VaultProperties props = validProperties();
        props.setEncryptionKey("change-this-key-in-production-must-be-32-byte-base64");
        assertThatThrownBy(props::validate).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("non-base64 encryptionKey -> throws FATAL")
    void invalidBase64Key_throws() {
        VaultProperties props = validProperties();
        props.setEncryptionKey("not valid base64!!");
        assertThatThrownBy(props::validate).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("base64");
    }

    @Test
    @DisplayName("encryptionKey decoding to the wrong byte length -> throws FATAL")
    void wrongLengthKey_throws() {
        VaultProperties props = validProperties();
        props.setEncryptionKey(Base64.getEncoder().encodeToString(new byte[16]));
        assertThatThrownBy(props::validate).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("32 bytes");
    }

    @Test
    @DisplayName("a previousEncryptionKeys entry with a bad format -> throws FATAL, labeled as previous")
    void invalidPreviousKey_throws() {
        VaultProperties props = validProperties();
        props.setPreviousEncryptionKeys(Map.of(1, "not valid base64!!"));
        props.setCurrentKeyVersion(2);
        assertThatThrownBy(props::validate).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("previous, version 1");
    }

    @Test
    @DisplayName("previousEncryptionKeys contains an entry for currentKeyVersion -> throws FATAL")
    void previousKeyVersionCollidesWithCurrent_throws() {
        VaultProperties props = validProperties();
        props.setPreviousEncryptionKeys(Map.of(1, VALID_KEY_2));
        props.setCurrentKeyVersion(1);
        assertThatThrownBy(props::validate).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("currentKeyVersion");
    }

    @Test
    @DisplayName("null hashPepper -> throws FATAL")
    void nullHashPepper_throws() {
        VaultProperties props = validProperties();
        props.setHashPepper(null);
        assertThatThrownBy(props::validate).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("VAULT_HASH_PEPPER");
    }

    @Test
    @DisplayName("blank hashPepper -> throws FATAL")
    void blankHashPepper_throws() {
        VaultProperties props = validProperties();
        props.setHashPepper("   ");
        assertThatThrownBy(props::validate).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("insecure default hashPepper -> throws FATAL")
    void defaultHashPepper_throws() {
        VaultProperties props = validProperties();
        props.setHashPepper("change-this-pepper-in-production");
        assertThatThrownBy(props::validate).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("a valid rotated previous key at a different version -> validate() passes")
    void validPreviousKeyDifferentVersion_passes() {
        VaultProperties props = validProperties();
        props.setCurrentKeyVersion(2);
        props.setPreviousEncryptionKeys(Map.of(1, VALID_KEY_2));
        assertThatCode(props::validate).doesNotThrowAnyException();
    }
}
