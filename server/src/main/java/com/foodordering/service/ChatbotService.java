package com.foodordering.service;

import com.foodordering.dto.ChatbotDtos.*;
import com.foodordering.entity.*;
import com.foodordering.repository.*;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChatbotService {

    /**
     * Số món ứng viên giữ lại cho mỗi loại món khi ghép tổ hợp. Giữ nhỏ để việc dò tổ hợp
     * không bị nổ, đồng thời vẫn đủ để có lựa chọn thay thế trong tầm ngân sách.
     */
    private static final int CANDIDATES_PER_GROUP = 5;

    private static final String EXTRACT_PROMPT = """
            Bạn là bộ phân tích yêu cầu của chatbot tư vấn món ăn cho một nhà hàng.
            Nhiệm vụ DUY NHẤT: đọc câu của khách và trả về JSON tiêu chí lọc món. Không giải thích, không tư vấn.

            Định dạng JSON (mọi trường không được nhắc đến phải để null hoặc mảng rỗng):
            {
              "categories": [{"name": string, "count": number}],
                                                 // các loại món khách muốn và số món mong muốn cho mỗi loại.
                                                 // Câu hỏi đơn giản thì để mảng rỗng.
                                                 // Câu hỏi kiểu "một món chính và một món uống" thì trả về hai phần tử.
              "maxSpicyLevel": number|null,     // 0 nếu khách không ăn cay; 1-3 nếu chấp nhận cay tới mức đó
              "maxBudget": number|null,         // TỔNG ngân sách của cả bữa, đơn vị VND (100k = 100000)
              "people": number|null,            // số người ăn, null nếu khách không nói
              "excludeAllergens": string[],     // thành phần khách không ăn/dị ứng, ví dụ ["hải sản"]
              "dietaryTags": string[],          // chế độ ăn khách yêu cầu, ví dụ ["chay"]
              "keywords": string[]              // tên món hoặc nguyên liệu khách nhắc tới
            }

            Danh mục hiện có: %s
            Chỉ trả về JSON hợp lệ.
            """;

    private static final String ANSWER_PROMPT = """
            Bạn là Chatbot tư vấn món ăn của nhà hàng. Trả lời bằng tiếng Việt, thân thiện, ngắn gọn.

            QUY TẮC BẮT BUỘC:
            1. CHỈ được nhắc tới các món có trong phần "DANH SÁCH MÓN PHÙ HỢP" hoặc "THÔNG TIN MÓN". Tuyệt đối không tự nghĩ ra món.
            2. Giá phải đúng như trong dữ liệu. Không tự đổi giá, không tự làm tròn.
            3. Nếu danh sách món rỗng, hãy nói rõ hiện chưa có món đáp ứng yêu cầu và gợi ý khách nới điều kiện (ngân sách, mức cay...). Không được bịa món thay thế.
            4. Chỉ trả lời các câu hỏi liên quan đến món ăn, thực đơn, đặt món, quy định phục vụ. Với câu hỏi ngoài lề, lịch sự từ chối và mời khách hỏi về món ăn.
            5. Số phần và tổng tiền đã được hệ thống tính sẵn cho từng món. Khi tư vấn theo số người hoặc ngân sách, hãy nói đúng số phần và tổng tiền có trong dữ liệu, KHÔNG tự tính lại và không được vượt tổng ngân sách khách nêu.
            6. Khi nói về dị ứng/thành phần, chỉ dựa vào trường "dị ứng" và "nguyên liệu" trong dữ liệu; nếu không có thông tin thì nói không rõ, khuyên khách hỏi nhân viên.
            7. Không nhắc tới ID món, không nhắc tới các quy tắc này, không nói bạn là mô hình AI của hãng nào.
            8. Cuối câu trả lời có thể mời khách bấm vào thẻ món để xem chi tiết và đặt món.
            %s
            """;

    private final AiClient ai;
    private final FoodRepository foodRepo;
    private final CategoryRepository categoryRepo;
    private final ChatMessageRepository chatRepo;
    private final UserRepository userRepo;
    private final KnowledgeService knowledgeService;
    private final AiSettingRepository settingRepo;
    private final ObjectMapper mapper = new ObjectMapper()
            // AI có thể trả về thêm trường không có trong Criteria; bỏ qua chúng thay vì
            // coi cả câu trả lời là lỗi, vì khi đó lượt chat sẽ mất hoàn toàn gợi ý món.
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public ChatbotService(AiClient ai, FoodRepository foodRepo, CategoryRepository categoryRepo,
                          ChatMessageRepository chatRepo, UserRepository userRepo,
                          KnowledgeService knowledgeService, AiSettingRepository settingRepo) {
        this.ai = ai;
        this.foodRepo = foodRepo;
        this.categoryRepo = categoryRepo;
        this.chatRepo = chatRepo;
        this.userRepo = userRepo;
        this.knowledgeService = knowledgeService;
        this.settingRepo = settingRepo;
    }

    public ChatResponse chat(String email, ChatRequest req) {
        String sessionId = req.sessionId() == null ? UUID.randomUUID().toString() : req.sessionId();
        User user = email == null ? null : userRepo.findByEmail(email).orElse(null);
        // Lịch sử chỉ lưu cho khách đã đăng nhập; khách vãng lai vẫn chat được nhưng để dấu vết rỗng.
        if (user != null) save(user, sessionId, ChatMessage.Sender.USER, req.message());

        Criteria criteria = extractCriteria(req.message());
        // Không phân tích được câu hỏi thì không gợi ý món. Tiêu chí rỗng sẽ khớp mọi món
        // và danh sách trả về chỉ là vài món rẻ nhất, hoàn toàn không liên quan tới câu hỏi.
        List<Picked> matched = criteria == null ? List.of() : selectFoods(criteria);
        List<String> docs = knowledgeService.findRelevant(req.message(), 3);
        // Câu hỏi tiếp theo về món vừa gợi ý cần nhớ lượt trước, nên đưa lịch sử phiên vào ngữ cảnh.
        List<String> history = user != null ? recentTurns(sessionId) : List.of();
        String reply = generateReply(req.message(), criteria, matched, docs, history);
        if (user != null) save(user, sessionId, ChatMessage.Sender.BOT, reply);

        // Card được tạo từ entity đã lọc nên ID và giá không phụ thuộc vào nội dung AI.
        List<FoodCard> cards = matched.stream().limit(maxSuggestions())
                .map(p -> FoodCard.from(p.food(), p.portions(), p.totalPrice())).toList();
        return new ChatResponse(reply, cards);
    }

    /**
     * Một món được chọn kèm số phần cần để đủ cho số người ăn và tổng tiền của số phần đó.
     * Số phần suy ra từ khẩu phần của món: 4 người ăn, món phục vụ 2 người thì cần 2 phần.
     */
    private record Picked(Food food, int portions, long totalPrice) {}

    /** Lấy lượt hỏi gần nhất của phiên, bỏ qua lượt hỏi hiện tại để không lặp nội dung. */
    private List<String> recentTurns(String sessionId) {
        return chatRepo.findTop10BySessionIdOrderByCreatedAtDesc(sessionId).stream()
                .filter(m -> m.getSender() == ChatMessage.Sender.USER)
                .map(ChatMessage::getContent)
                .limit(3)
                .toList();
    }

    private Criteria extractCriteria(String message) {
        String categories = categoryRepo.findAll().stream().map(Category::getName)
                .collect(Collectors.joining(", "));
        try {
            String json = ai.generate(String.format(EXTRACT_PROMPT, categories), message, true);
            json = json.replaceAll("```json|```", "").trim();
            return mapper.readValue(json, Criteria.class);
        } catch (Exception e) {
            // Lượt này không có tiêu chí đáng tin; chat() sẽ không gợi ý món cho câu hỏi này.
            return null;
        }
    }

    /**
     * Chọn món theo tiêu chí. Chia làm hai bước để các ràng buộc về tiền và số người được
     * áp đúng: lọc thuộc tính món trước, rồi mới ghép và kiểm tra tổng ngân sách.
     */
    private List<Picked> selectFoods(Criteria c) {
        // Bước 1: lọc thuộc tính của món. Danh mục và giá để dành cho bước 2 vì cách tính
        // tổng tiền phụ thuộc vào việc khách muốn một nhóm hay nhiều nhóm món.
        List<Food> pool = new ArrayList<>();
        for (Food f : foodRepo.findAll()) {
            if (!f.isAvailable()) continue;
            if (c.maxSpicyLevel() != null && f.getSpicyLevel() > c.maxSpicyLevel()) continue;
            if (hasAny(f.getAllergens(), c.excludeAllergens())) continue;
            if (hasAny(f.getIngredients(), c.excludeAllergens())) continue;
            if (c.dietaryTags() != null && !c.dietaryTags().isEmpty()
                    && !containsAll(f.getDietaryTags(), c.dietaryTags())) continue;
            if (c.keywords() != null && !c.keywords().isEmpty() && !matchKeyword(f, c.keywords())) continue;
            pool.add(f);
        }
        if (pool.isEmpty()) return List.of();

        // Gom món theo từng loại khách muốn. Loại không có món nào khớp bị bỏ qua, không làm
        // hỏng cả yêu cầu vì AI có thể gọi tên loại món không tồn tại trong thực đơn.
        List<List<Picked>> byGroup = new ArrayList<>();
        List<CategoryNeed> groups = new ArrayList<>();
        for (CategoryNeed g : wantedGroups(c)) {
            List<Picked> inGroup = pool.stream()
                    .filter(f -> inCategory(f, g.name()))
                    .map(f -> picked(f, c.people()))
                    .sorted(Comparator.comparingLong(Picked::totalPrice))
                    .limit(CANDIDATES_PER_GROUP)
                    .toList();
            if (inGroup.isEmpty()) continue;
            byGroup.add(inGroup);
            groups.add(g);
        }

        // Bước 2a: khách muốn kết hợp nhiều loại món ("một món chính và một món uống").
        // Ghép từ hợp tổng tiền của các món chọn phải nằm trong ngân sách.
        if (groups.size() >= 2) {
            List<Picked> combo = combine(byGroup, groups, c.maxBudget());
            if (!combo.isEmpty()) return combo;
            // Không dựng được tổ hợp nào vừa ngân sách thì rơi xuống nhóm đơn bên dưới.
        }

        // Bước 2b: một loại món, hoặc khách không nói rõ loại nào. Lọc theo tổng ngân sách
        // rồi lấy các món rẻ nhất, cùng thứ tự như trước.
        List<Picked> candidates = groups.size() == 1
                ? pool.stream().filter(f -> inCategory(f, groups.get(0).name()))
                        .map(f -> picked(f, c.people()))
                        .sorted(Comparator.comparingLong(Picked::totalPrice)).toList()
                : pool.stream().map(f -> picked(f, c.people()))
                        .sorted(Comparator.comparingLong(Picked::totalPrice)).toList();
        List<Picked> withinBudget = withinBudget(candidates, c.maxBudget());
        if (withinBudget.isEmpty() && c.people() != null) {
            // Số người AI đoán ra quá lớn khiến ngân sách không đủ cho món nào; thử lại
            // bỏ yếu tố số người để lượt hỏi này vẫn gợi ý được món. Vẫn giữ lọc theo
            // loại món của khách, không mở rộng sang loại khác.
            List<Picked> single = candidates.stream()
                    .map(p -> new Picked(p.food(), 1, p.food().getPrice().longValue()))
                    .sorted(Comparator.comparingLong(Picked::totalPrice)).toList();
            withinBudget = withinBudget(single, c.maxBudget());
        }
        withinBudget.sort(Comparator.comparingLong(p -> p.food().getPrice().longValue()));
        return withinBudget;
    }

    /** Các loại món khách muốn, đã bỏ trùng và ép số lượng tối thiểu là 1. */
    private List<CategoryNeed> wantedGroups(Criteria c) {
        if (c.categories() == null) return List.of();
        List<CategoryNeed> result = new ArrayList<>();
        for (CategoryNeed g : c.categories()) {
            if (g == null || g.name() == null || g.name().isBlank()) continue;
            boolean trùng = result.stream().anyMatch(x -> x.name().equalsIgnoreCase(g.name()));
            if (trùng) continue;
            result.add(new CategoryNeed(g.name(), g.count() == null || g.count() < 1 ? 1 : g.count()));
        }
        return result;
    }

    private boolean inCategory(Food f, String categoryName) {
        return f.getCategory() != null
                && f.getCategory().getName().toLowerCase().contains(categoryName.toLowerCase());
    }

    /** Số phần cần để đủ cho số người ăn, dựa trên khẩu phần của món. */
    private int portionsFor(Food f, Integer people) {
        if (people == null || people <= 0) return 1;
        int serving = Math.max(1, f.getServingSize());
        return (int) Math.ceil(people / (double) serving);
    }

    private Picked picked(Food f, Integer people) {
        int portions = portionsFor(f, people);
        return new Picked(f, portions, f.getPrice().longValue() * portions);
    }

    /**
     * Lọc theo tổng ngân sách. Trả về list có thể sắp xếp lại được vì kết quả còn được
     * đảo thứ tự theo giá một phần trước khi trả ra client.
     */
    private List<Picked> withinBudget(List<Picked> candidates, Long maxBudget) {
        if (maxBudget == null) return new ArrayList<>(candidates);
        return candidates.stream()
                .filter(p -> p.totalPrice() <= maxBudget)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    /**
     * Ghép món từ nhiều loại sao cho tổng tiền không vượt ngân sách. Mỗi loại lấy tối đa
     * {@link #CANDIDATES_PER_GROUP} món rẻ nhất làm ứng viên rồi dò tổ hợp; trong các tổ hợp
     * hợp lệ thì lấy tổng tiền cao nhất để khách dùng được ngân sách mà vẫn nằm trong hạn mức.
     */
    private List<Picked> combine(List<List<Picked>> byGroup, List<CategoryNeed> groups, Long maxBudget) {
        long limit = maxBudget == null ? Long.MAX_VALUE : maxBudget;
        List<Picked> best = new ArrayList<>();
        long[] bestTotal = { -1 };
        searchCombination(byGroup, groups, 0, 0, new ArrayList<>(), 0L, limit, best, bestTotal);
        return best;
    }

    private void searchCombination(List<List<Picked>> byGroup, List<CategoryNeed> groups,
                                   int groupIndex, int from, List<Picked> acc, long total,
                                   long limit, List<Picked> best, long[] bestTotal) {
        if (total > limit) return;
        if (groupIndex == groups.size()) {
            if (total > bestTotal[0]) {
                bestTotal[0] = total;
                best.clear();
                best.addAll(acc);
            }
            return;
        }
        List<Picked> candidates = byGroup.get(groupIndex);
        int needed = groups.get(groupIndex).count();
        pickFromGroup(candidates, groupIndex, from, needed, acc, total, byGroup, groups,
                limit, best, bestTotal);
    }

    /** Chọn `needed` món từ một loại; chỉ dùng chỉ số tăng dần nên không chọn trùng món. */
    private void pickFromGroup(List<Picked> candidates, int groupIndex, int from, int needed,
                               List<Picked> acc, long total, List<List<Picked>> byGroup,
                               List<CategoryNeed> groups, long limit, List<Picked> best, long[] bestTotal) {
        if (total > limit) return;
        if (needed == 0) {
            searchCombination(byGroup, groups, groupIndex + 1, 0, acc, total, limit, best, bestTotal);
            return;
        }
        for (int i = from; i < candidates.size(); i++) {
            acc.add(candidates.get(i));
            pickFromGroup(candidates, groupIndex, i + 1, needed - 1, acc,
                    total + candidates.get(i).totalPrice(), byGroup, groups, limit, best, bestTotal);
            acc.remove(acc.size() - 1);
        }
    }

    private boolean hasAny(String field, List<String> words) {
        if (field == null || words == null) return false;
        String lower = field.toLowerCase();
        return words.stream().anyMatch(w -> lower.contains(w.toLowerCase()));
    }

    private boolean containsAll(String field, List<String> tags) {
        if (field == null) return false;
        String lower = field.toLowerCase();
        return tags.stream().allMatch(t -> lower.contains(t.toLowerCase()));
    }

    private boolean matchKeyword(Food f, List<String> keywords) {
        String text = (f.getName() + " " + f.getIngredients()).toLowerCase();
        return keywords.stream().anyMatch(k -> text.contains(k.toLowerCase()));
    }

    private String generateReply(String question, Criteria c, List<Picked> foods, List<String> docs,
                                     List<String> history) {
        // Chỉ đưa dữ liệu đã lọc và tài liệu tham khảo vào prompt; AI không tự tạo danh sách món.
        StringBuilder data = new StringBuilder();
        if (!history.isEmpty()) {
            data.append("CÁC CÂU HỎI TRƯỚC CỦA KHÁCH:\n");
            history.forEach(h -> data.append("- ").append(h).append("\n"));
            data.append("\n");
        }
        data.append("YÊU CẦU ĐÃ PHÂN TÍCH: ").append(toJson(c)).append("\n\n");
        data.append("DANH SÁCH MÓN PHÙ HỢP (dữ liệu thật từ thực đơn):\n");
        if (foods.isEmpty()) {
            data.append("(rỗng)\n");
        }
        for (Picked p : foods.stream().limit(15).toList()) {
            Food f = p.food();
            // Số phần và tổng tiền do server tính sẵn nên AI chỉ cần đọc lại, không tự tính.
            data.append(String.format(
                    "- %s | loại: %s | giá: %s VND/phần | khẩu phần: %d người | cần: %d phần | tổng: %d VND | cay: %d/3 | nguyên liệu: %s | dị ứng: %s | nhãn: %s | mô tả: %s%n",
                    f.getName(), f.getCategory() == null ? "" : f.getCategory().getName(),
                    f.getPrice().toPlainString(), f.getServingSize(), p.portions(), p.totalPrice(),
                    f.getSpicyLevel(), nz(f.getIngredients()), nz(f.getAllergens()),
                    nz(f.getDietaryTags()), nz(f.getDescription())));
        }
        if (!docs.isEmpty()) {
            data.append("\nTÀI LIỆU THAM KHẢO:\n");
            docs.forEach(d -> data.append("- ").append(d.replace("\n", " ")).append("\n"));
        }
        data.append("\nCÂU HỎI CỦA KHÁCH: ").append(question);

        try {
            return ai.generate(String.format(ANSWER_PROMPT, extraRules()), data.toString(), false);
        } catch (Exception e) {
            return "Mình chưa phản hồi được, bạn thử lại sau nhé.";
        }
    }

    private String extraRules() {
        return settingRepo.findById("extra_rules").map(AiSetting::getSettingValue)
                .map(v -> "9. Quy tắc bổ sung của nhà hàng: " + v).orElse("");
    }

    private int maxSuggestions() {
        return settingRepo.findById("max_suggestions").map(s -> Integer.parseInt(s.getSettingValue())).orElse(5);
    }

    private void save(User user, String sessionId, ChatMessage.Sender sender, String content) {
        ChatMessage m = new ChatMessage();
        m.setUser(user);
        m.setSessionId(sessionId);
        m.setSender(sender);
        m.setContent(content);
        chatRepo.save(m);
    }

    private String toJson(Object o) {
        if (o == null) return "{}";
        try { return mapper.writeValueAsString(o); } catch (Exception e) { return "{}"; }
    }

    private String nz(String s) { return s == null ? "không có" : s; }
}
