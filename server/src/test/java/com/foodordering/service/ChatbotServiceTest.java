package com.foodordering.service;

import com.foodordering.dto.ChatbotDtos.ChatRequest;
import com.foodordering.dto.ChatbotDtos.ChatResponse;
import com.foodordering.dto.ChatbotDtos.FoodCard;
import com.foodordering.entity.Category;
import com.foodordering.entity.Food;
import com.foodordering.repository.AiSettingRepository;
import com.foodordering.repository.CategoryRepository;
import com.foodordering.repository.ChatMessageRepository;
import com.foodordering.repository.FoodRepository;
import com.foodordering.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Kiểm chứng bộ lọc của chatbot: tiêu chí do AI trích xuất phải được áp bằng code xác định,
 * không phải bằng suy luận của AI. Test ở mức service nên chạy nhanh, không cần database.
 */
class ChatbotServiceTest {

    private AiClient ai;
    private FoodRepository foodRepo;
    private CategoryRepository categoryRepo;
    private ChatbotService service;

    private Category monChinh;
    private Category doUong;

    @BeforeEach
    void setUp() {
        ai = mock(AiClient.class);
        foodRepo = mock(FoodRepository.class);
        categoryRepo = mock(CategoryRepository.class);
        ChatMessageRepository chatRepo = mock(ChatMessageRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        AiSettingRepository settingRepo = mock(AiSettingRepository.class);

        monChinh = new Category();
        monChinh.setId(1L);
        monChinh.setName("Món Việt");
        doUong = new Category();
        doUong.setId(2L);
        doUong.setName("Đồ uống");

        when(categoryRepo.findAll()).thenReturn(List.of(monChinh, doUong));
        when(foodRepo.findAll()).thenAnswer(inv -> thucDong());
        when(foodRepo.findAllById(any())).thenAnswer(inv -> {
            Iterable<Long> ids = inv.getArgument(0);
            List<Long> wanted = new ArrayList<>();
            ids.forEach(wanted::add);
            return thucDong().stream().filter(f -> wanted.contains(f.getId())).toList();
        });
        when(settingRepo.findById(anyString())).thenReturn(Optional.empty());
        // Mặc định coi như đã có khóa AI; test thiếu khóa tự đổi thành false.
        when(ai.isConfigured()).thenReturn(true);

        service = new ChatbotService(ai, foodRepo, categoryRepo, chatRepo, userRepo,
                settingRepo);
    }

    @Test
    @DisplayName("Tư vấn theo số người: số phần tính theo khẩu phần, tổng cả bộ nằm trong ngân sách")
    void tuVanTheoSoNguoi() {
        // 2 người, ngân sách 200k: món phục vụ 1 người cần 2 phần nên giá x2.
        mockExtract("""
                {"categories":[],"maxSpicyLevel":null,"maxBudget":200000,"people":2,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[]}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("Món ngon dưới 200k cho 2 người", "s1", null, null));

        assertThat(res.foods()).isNotEmpty().hasSizeLessThanOrEqualTo(5);
        long tong = res.foods().stream().mapToLong(c -> Long.parseLong(c.totalPrice())).sum();
        assertThat(tong).isGreaterThan(0).isLessThanOrEqualTo(200000L);
        // Mọi thẻ đều có tổng tiền = giá một phần × số phần, và tổng bộ không vượt ngân sách.
        assertThat(res.foods()).allSatisfy(c -> {
            assertThat(c.portions()).isGreaterThanOrEqualTo(1);
            assertThat(Long.parseLong(c.totalPrice()))
                    .isEqualTo(Long.parseLong(c.price()) * c.portions());
        });
        assertThat(res.foods()).anySatisfy(c -> assertThat(c.portions()).isEqualTo(2));
    }

    @Test
    @DisplayName("Tư vấn kết hợp món: mỗi loại một món và tổng tiền không vượt ngân sách")
    void tuVanKetHopMon() {
        // 1 món chính + 1 món uống, tổng 150k.
        mockExtract("""
                {"categories":[{"name":"Món Việt","count":1},{"name":"Đồ uống","count":1}],
                 "maxSpicyLevel":null,"maxBudget":150000,"people":null,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[]}
                """);

        ChatResponse res = service.chat(null,
                new ChatRequest("1 món chính và 1 món uống khoảng 150k", "s2", null, null));

        assertThat(res.foods()).hasSize(2);
        long tong = res.foods().stream().mapToLong(c -> Long.parseLong(c.totalPrice())).sum();
        assertThat(tong).isLessThanOrEqualTo(150000L);
        // Mỗi món phải đúng loại khách yêu cầu
        assertThat(res.foods()).anySatisfy(c -> assertThat(c.categoryName()).isEqualTo("Món Việt"));
        assertThat(res.foods()).anySatisfy(c -> assertThat(c.categoryName()).isEqualTo("Đồ uống"));
    }

    @Test
    @DisplayName("Ngân sách là tổng của cả bộ gợi ý, không phải giá từng món")
    void nganSachLaTongCuaBoGoiY() {
        mockExtract("""
                {"categories":[],"maxSpicyLevel":null,"maxBudget":100000,"people":null,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[]}
                """);

        ChatResponse res = service.chat(null,
                new ChatRequest("Món ngon trong 100k", "s7", null, null));

        assertThat(res.foods()).isNotEmpty().hasSizeLessThanOrEqualTo(5);
        long tong = res.foods().stream().mapToLong(c -> Long.parseLong(c.totalPrice())).sum();
        assertThat(tong).isLessThanOrEqualTo(100000L);
        // Nhiều món cộng lại chứ không phải mỗi món dưới 100k: dữ liệu mẫu có bộ đúng 100k.
        assertThat(tong).isEqualTo(100000L);
    }

    @Test
    @DisplayName("Không có ngân sách thì vẫn trả tối đa 5 lựa chọn")
    void khongCoNganSachTraToiDa5() {
        mockExtract("""
                {"categories":[],"maxSpicyLevel":null,"maxBudget":null,"people":null,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[]}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("Gợi ý món ngon", "s8", null, null));

        assertThat(res.foods()).hasSize(5);
    }

    @Test
    @DisplayName("Câu hỏi tiếp dùng lastFoodIds: chỉ trả món trong ngữ cảnh, áp ràng buộc mới")
    void hoiTiepDungLastFoodIds() {
        Food pho = food("Phở bò");
        Food bunBo = food("Bún bò Huế");
        mockExtract("""
                {"categories":[],"maxSpicyLevel":0,"maxBudget":null,"people":null,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[]}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("Món đó cay không?", "s9",
                List.of("Gợi ý món cho 2 người"), List.of(pho.getId(), bunBo.getId())));

        // Bún bò Huế cay 3/3 nên bị ràng buộc mới loại; không được quét sang món ngoài context.
        assertThat(res.foods()).hasSize(1);
        assertThat(res.foods().get(0).id()).isEqualTo(pho.getId());
    }

    @Test
    @DisplayName("Câu hỏi mở chủ đề mới bỏ qua lastFoodIds và tìm trên toàn thực đơn")
    void chuDeMoiBoQuaLastFoodIds() {
        Food pho = food("Phở bò");
        Food bunCha = food("Bún chả Hà Nội");
        mockExtract("""
                {"categories":[],"maxSpicyLevel":null,"maxBudget":null,"people":null,
                 "excludeAllergens":[],"dietaryTags":["chay"],"keywords":[]}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("Món đó có món chay không?", "s10",
                null, List.of(pho.getId(), bunCha.getId())));

        assertThat(res.foods()).isNotEmpty();
        assertThat(res.foods()).allSatisfy(c -> {
            Food f = food(c.name());
            assertThat(f.getDietaryTags().toLowerCase()).contains("chay");
        });
        // Có món ngoài context cũ, chứng tỏ không bị giới hạn vào hai món vừa gợi ý.
        assertThat(res.foods()).anySatisfy(c -> assertThat(c.id()).isNotIn(pho.getId(), bunCha.getId()));
    }

    @Test
    @DisplayName("Thiếu khóa API: báo notice, không gọi AI và vẫn gợi ý bằng bộ lọc")
    void thieuApiKeyThiBaoRo() {
        when(ai.isConfigured()).thenReturn(false);

        ChatResponse res = service.chat(null, new ChatRequest("Gợi ý món chay không cay", "s11", null, null));

        assertThat(res.notice()).contains("chưa được cấu hình khóa API");
        assertThat(res.foods()).isNotEmpty();
        assertThat(res.foods()).allSatisfy(c -> {
            Food f = food(c.name());
            assertThat(f.getDietaryTags().toLowerCase()).contains("chay");
            assertThat(f.getSpicyLevel()).isZero();
        });
        // Không gọi mạng khi biết chắc thiếu khóa, tránh chờ hết timeout.
        verify(ai, never()).generate(anyString(), anyString(), anyBoolean());
    }

    @Test
    @DisplayName("AI lỗi thì rơi sang nhánh dự phòng: món gợi ý lấy từ CSDL chứ không do AI bịa")
    void aiLoiRoiSangNhanhDungPhong() {
        when(ai.generate(anyString(), anyString(), anyBoolean())).thenThrow(new RuntimeException("AI lỗi"));

        ChatResponse res = service.chat(null, new ChatRequest("Gợi ý món chay không cay", "s4", null, null));

        assertThat(res.notice()).isNull();
        assertThat(res.foods()).isNotEmpty();
        assertThat(res.foods()).allSatisfy(c -> {
            Food f = food(c.name());
            assertThat(f.getDietaryTags().toLowerCase()).contains("chay");
            assertThat(f.getSpicyLevel()).isZero();
        });
        // Câu trả lời chỉ tóm tắt, không liệt kê lại món (thẻ món đã hiện bên dưới).
        assertThat(res.reply()).startsWith("Mình tìm được 2 món chay, không cay");
        assertThat(res.reply()).doesNotContain("Trà đào cam sả");
        assertThat(res.reply()).contains("Bấm vào thẻ món bên dưới");
    }

    @Test
    @DisplayName("AI lỗi mà câu là hỏi tiếp thì nhánh dự phòng vẫn bám lastFoodIds")
    void aiLoiHoiTiepVanDungContext() {
        when(ai.generate(anyString(), anyString(), anyBoolean())).thenThrow(new RuntimeException("AI lỗi"));
        Food pho = food("Phở bò");
        Food bunBo = food("Bún bò Huế");

        ChatResponse res = service.chat(null, new ChatRequest("Món đó cay không?", "s12",
                null, List.of(pho.getId(), bunBo.getId())));

        assertThat(res.foods()).hasSize(1);
        assertThat(res.foods().get(0).id()).isEqualTo(bunBo.getId());
    }

    @Test
    @DisplayName("AI lỗi và câu hỏi ngoài lề thì không gợi ý món nào")
    void aiLoiCauHoiNgoaiLe() {
        when(ai.generate(anyString(), anyString(), anyBoolean())).thenThrow(new RuntimeException("AI lỗi"));

        ChatResponse res = service.chat(null, new ChatRequest("Ai là Tổng thống Việt Nam?", "s6", null, null));

        assertThat(res.foods()).isEmpty();
        assertThat(res.reply()).contains("Mình chỉ tư vấn được về món ăn của quán");
    }

    @Test
    @DisplayName("AI trả thêm trường lạ thì vẫn dùng được tiêu chí đã nhận")
    void aiTraThemTruongLa() {
        mockExtract("""
                {"categories":[],"maxSpicyLevel":0,"maxBudget":null,"people":null,
                 "excludeAllergens":[],"dietaryTags":[],"keywords":[],"mucDoCay":"khong","note":"abc"}
                """);

        ChatResponse res = service.chat(null, new ChatRequest("món không cay", "s5", null, null));

        assertThat(res.foods()).isNotEmpty();
    }

    /** Mock lần gọi AI đầu tiên (trích tiêu chí) trả về JSON, các lần sau trả về câu trả lời. */
    private void mockExtract(String json) {
        when(ai.generate(anyString(), anyString(), anyBoolean()))
                .thenAnswer(inv -> inv.getArgument(2, Boolean.class) ? json : "Dưới đây là gợi ý của mình.");
    }

    /** Món trong dữ liệu mẫu, dùng để lấy ID thật của entity. */
    private Food food(String name) {
        return thucDong().stream().filter(f -> f.getName().equals(name)).findFirst().orElseThrow();
    }

    /** Dữ liệu món giống hệt phần seed trong DataSeeder để số liệu kiểm thử khớp thực tế. */
    private List<Food> thucDong() {
        List<Food> list = new ArrayList<>();
        list.add(mon("Phở bò", monChinh, 65000, 1, 0, "", "gluten"));
        list.add(mon("Bún chả Hà Nội", monChinh, 60000, 1, 0, "", ""));
        list.add(mon("Cơm gà xối mỡ", monChinh, 55000, 1, 0, "", ""));
        list.add(mon("Bún bò Huế", monChinh, 70000, 1, 3, "", "gluten"));
        list.add(mon("Gỏi cuốn tôm thịt", monChinh, 45000, 2, 0, "", "hải sản,đậu phộng"));
        list.add(mon("Canh chua cá lóc", monChinh, 90000, 3, 1, "ít dầu mỡ", "hải sản"));
        list.add(mon("Lẩu thái hải sản", monChinh, 250000, 4, 3, "", "hải sản"));
        list.add(mon("Bò lúc lắc", monChinh, 120000, 2, 0, "", ""));
        list.add(mon("Mỳ Ý sốt bò băm", monChinh, 85000, 1, 0, "", "gluten"));
        list.add(mon("Trà đào cam sả", doUong, 40000, 1, 0, "chay", ""));
        list.add(mon("Nước cam ép", doUong, 35000, 1, 0, "chay,ít dầu mỡ", ""));
        list.add(mon("Cà phê sữa đá", doUong, 30000, 1, 0, "", "sữa"));
        return list;
    }

    private Food mon(String ten, Category cat, long gia, int khauPhan, int cay, String nhan, String diUng) {
        Food f = new Food();
        f.setId((long) ten.hashCode());
        f.setName(ten);
        f.setCategory(cat);
        f.setPrice(BigDecimal.valueOf(gia));
        f.setServingSize(khauPhan);
        f.setSpicyLevel(cay);
        f.setDietaryTags(nhan);
        f.setAllergens(diUng);
        f.setIngredients("nguyên liệu chung");
        f.setAvailable(true);
        return f;
    }
}
