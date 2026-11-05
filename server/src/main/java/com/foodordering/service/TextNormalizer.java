package com.foodordering.service;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Chuẩn hoá chữ Việt phục vụ tìm kiếm không dấu: "Phở bò" và "pho bo" chung một dạng.
 * Lớp chỉ dùng nội bộ và test nên để package-private.
 */
final class TextNormalizer {

    private TextNormalizer() {
    }

    /**
     * NFD tách dấu khỏi ký tự gốc rồi bỏ các ký tự kết hợp (\p{M}); đ/Đ không có biểu diễn
     * NFD nên phải thay thủ công. Lọc bằng Java để không phải thêm extension `unaccent`
     * của PostgreSQL vào database — tránh phụ thuộc hạ tầng chỉ vì một ô tìm kiếm.
     */
    static String plain(String input) {
        if (input == null) return "";
        String noMarks = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return noMarks.replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase(Locale.ROOT).trim();
    }
}
