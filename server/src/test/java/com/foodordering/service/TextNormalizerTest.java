package com.foodordering.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Kiểm chuẩn hoá chữ cho ô tìm kiếm: "pho bo" phải khớp "Phở bò" mặc dù một bên không dấu.
 */
class TextNormalizerTest {

    @Test
    void bỏDấuVàThườngHoá() {
        assertThat(TextNormalizer.plain("Phở bò")).isEqualTo("pho bo");
        assertThat(TextNormalizer.plain("Cà phê sữa đá")).isEqualTo("ca phe sua da");
        assertThat(TextNormalizer.plain("PHỞ BÒ")).isEqualTo("pho bo");
    }

    @Test
    void đĐThànhD() {
        assertThat(TextNormalizer.plain("Đậu hà lan")).isEqualTo("dau ha lan");
        assertThat(TextNormalizer.plain("đá")).isEqualTo("da");
    }

    @Test
    void rỗngVàBlankTrảChuỗiRỗng() {
        assertThat(TextNormalizer.plain(null)).isEmpty();
        assertThat(TextNormalizer.plain("   ")).isEmpty();
        assertThat(TextNormalizer.plain("")).isEmpty();
    }
}
