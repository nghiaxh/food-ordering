package com.foodordering.service;

import com.foodordering.dto.ChatbotDtos.*;
import com.foodordering.entity.*;
import com.foodordering.repository.*;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

@Service
public class ChatbotService {

    /** Số ứng viên rẻ nhất xét cho bộ chọn phẳng khi có ngân sách. */
    private static final int FLAT_CANDIDATES = 20;

    /** Câu báo cho khách khi server chưa cấu hình khóa AI; cũng là lý do từ chối chat. */
    private static final String MISSING_KEY_NOTICE =
            "Trợ lý AI chưa được cấu hình, vui lòng thử lại sau.";

    /**

     * Số món ứng viên giữ lại cho mỗi loại món khi ghép tổ hợp. Giữ nhỏ để việc dò tổ hợp
     * không bị nổ, đồng thời vẫn đủ để có lựa chọn thay thế trong tầm ngân sách.
     */
    private static final int CANDIDATES_PER_GROUP = 5;

    /** Quick replies theo tình huống bot gặp; server quyết định để thành chuỗi nhất quán. */
    private static final List<String> QR_FOOD = List.of("Món khác", "Món chay không cay", "Cách đặt món thế nào?");
    private static final List<String> QR_FOOD_EMPTY = List.of("Món khác", "Món chay không cay");
    private static final List<String> QR_INFO = List.of("Gợi ý món cho 2 người", "Cách đặt món thế nào?");
    private static final List<String> QR_GUIDE = List.of("Gợi ý món cho 2 người");
    private static final List<String> QR_DECLINE = List.of("Gợi ý món cho 2 người", "Giờ mở cửa là mấy giờ?");
    private static final List<String> QR_FOLLOWUP = List.of("1 người", "2 người", "4 người");

    /** Câu hỏi gốc bị hoãn khi bot hỏi "mấy người?" để ghép với câu trả lời ngắn của khách. */
    private final ConcurrentMap<String, PendingFollowUp> pendingFollowUp = new ConcurrentHashMap<>();
    /** Câu trả lời vắn tắt chỉ còn giá trị trong khoảng này; sau đó câu hỏi gốc bị bỏ. */
    private static final long FOLLOW_UP_TTL_MS = 10 * 60 * 1000L;
    private record PendingFollowUp(String originalMessage, long expiresAtMs) {}

    /** Nhóm câu hỏi bot phục vụ: gợi ý món, thông tin quán, hướng dẫn đặt hàng, ngoài lề. */
    public enum ChatIntent { FOOD, RESTAURANT_INFO, ORDER_GUIDE, OUT_OF_SCOPE }

    private final AiClient ai;
    private final FoodRepository foodRepo;
    private final CategoryRepository categoryRepo;
    private final ChatMessageRepository chatRepo;
    private final UserRepository userRepo;
    private final AiSettingRepository settingRepo;
    private final ChatbotKnowledgeRepository knowledgeRepo;
    private final VectorSearchService vectorSearch;
    private final ObjectMapper mapper = new ObjectMapper()
            // AI có thể trả về thêm trường không có trong Criteria; bỏ qua chúng thay vì
            // coi cả câu trả lời là lỗi, vì khi đó lượt chat sẽ mất hoàn toàn gợi ý món.
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    /** Constructor giữ tương thích test cũ: thiếu repo tài liệu thì coi như không có tài liệu. */
    public ChatbotService(AiClient ai, FoodRepository foodRepo, CategoryRepository categoryRepo,
                          ChatMessageRepository chatRepo, UserRepository userRepo,
                          AiSettingRepository settingRepo) {
        this(ai, foodRepo, categoryRepo, chatRepo, userRepo, settingRepo, null);
    }

    public ChatbotService(AiClient ai, FoodRepository foodRepo, CategoryRepository categoryRepo,
                          ChatMessageRepository chatRepo, UserRepository userRepo,
                          AiSettingRepository settingRepo, ChatbotKnowledgeRepository knowledgeRepo) {
        this(ai, foodRepo, categoryRepo, chatRepo, userRepo, settingRepo, knowledgeRepo, null);
    }

    // Có nhiều overloaded constructor cho test nên Spring cần biết dùng constructor đầy đủ nhất.
    @Autowired
    public ChatbotService(AiClient ai, FoodRepository foodRepo, CategoryRepository categoryRepo,
                          ChatMessageRepository chatRepo, UserRepository userRepo,
                          AiSettingRepository settingRepo, ChatbotKnowledgeRepository knowledgeRepo,
                          VectorSearchService vectorSearch) {
        this.ai = ai;
        this.foodRepo = foodRepo;
        this.categoryRepo = categoryRepo;
        this.chatRepo = chatRepo;
        this.userRepo = userRepo;
        this.settingRepo = settingRepo;
        this.knowledgeRepo = knowledgeRepo;
        this.vectorSearch = vectorSearch;
    }

    /** Phân loại câu hỏi để đi đúng nhánh: món, thông tin quán, hướng dẫn đặt hàng, ngoài lề. */
    public ChatIntent classifyIntent(String message) {
        return classifyDetailed(message).intent();
    }

    /**
     * Phân loại kèm đoạn tài liệu đã tra (nếu có) để nhánh gọi lại không embed lần thứ hai.
     * Quy tắc keyword trước: nếu khớp thì không tốn mạng; không khớp gì mới tra vector tài liệu.
     */
    private IntentResult classifyDetailed(String message) {
        String plain = plain(message == null ? "" : message);
        if (isOrderGuideQuestion(plain)) return new IntentResult(ChatIntent.ORDER_GUIDE, List.of());
        if (isRestaurantInfoQuestion(plain)) {
            return new IntentResult(ChatIntent.RESTAURANT_INFO, retrieveChunks(message));
        }
        if (isFoodQuestion(plain)) return new IntentResult(ChatIntent.FOOD, List.of());
        // Câu hỏi chung về món (đơn, gợi ý, chưa có từ khóa đặc thù) vẫn là FOOD để gợi ý ngay.
        if (isFollowUp(message) || plain.contains("goi y") || plain.contains("mon")) {
            return new IntentResult(ChatIntent.FOOD, List.of());
        }
        // Câu khớp keyword nào cũng không: hỏi thử tài liệu RAG một lần; khớp thì coi là hỏi
        // thông tin quán, không thì ngoài lề.
        List<VectorSearchService.ScoredChunk> chunks = retrieveChunks(message);
        if (!chunks.isEmpty()) return new IntentResult(ChatIntent.RESTAURANT_INFO, chunks);
        return new IntentResult(ChatIntent.OUT_OF_SCOPE, List.of());
    }

    /** Kết quả phân loại intent, kèm chunks tài liệu đã tra (nếu có). */
    private record IntentResult(ChatIntent intent, java.util.List<VectorSearchService.ScoredChunk> chunks) {}

    private boolean isOrderGuideQuestion(String plain) {
        return plain.contains("cach dat") || plain.contains("dat mon") || plain.contains("dat hang")
                || plain.contains("thanh toan") || plain.contains("huy don") || plain.contains("don hang")
                || plain.contains("trang thai don") || plain.contains("theo doi don")
                || plain.contains("xem don") || plain.contains("don cua toi") || plain.contains("giao hang the nao");
    }

    private boolean isRestaurantInfoQuestion(String plain) {
        return plain.contains("mo cua") || plain.contains("dong cua") || plain.contains("gio mo")
                || plain.contains("gio dong") || plain.contains("o dia chi") || plain.contains("dia chi")
                || plain.contains("phi ship") || plain.contains("thoi gian giao") || plain.contains("giao hang o dau")
                || plain.contains("quan o dau") || plain.contains("sdt") || plain.contains("so dien thoai");
    }

    /** Câu trả lời hướng dẫn đặt hàng: cố định bằng code để không bịa quy trình. */
    public String guideReply() {
        return "Để đặt món, bạn thêm món vào giỏ rồi vào trang thanh toán. Khách vãng lai cần đăng nhập mới thêm được vào giỏ.\n"
                + "\n- Chỉ hủy được đơn đang CHỜ (PENDING) và CHƯA thanh toán (UNPAID). Đơn đã hoàn thành hoặc đã hủy không sửa được.\n"
                + "- Trạng thái PREPARING hiện là \"Đang vận chuyển\". Bạn xem trạng thái đơn ở mục Đơn hàng của bạn.\n"
                + "\nNếu cần, mình cũng gợi ý món theo ngân sách. Bạn cho mình biết số người ăn nhé!";
    }

    /** Câu từ chối ngoài lề, mời khách quay lại 3 nhóm chính. */
    public String declineReply() {
        return "Mình chỉ tư vấn được về món ăn của quán (gợi ý món, thông tin quán, hướng dẫn đặt hàng). "
                + "Bạn muốn mình gợi ý món cho mấy người, hoặc hỏi giờ mở cửa/shipping thì cứ nhắn nhé!";
    }

    /** Trả lời thông tin quán chỉ từ tài liệu do admin nhập; không có thì nói không rõ. */
    public String infoReply(java.util.List<ChatbotKnowledge> docs) {
        if (docs == null || docs.isEmpty()) {
            return "Mình chưa có thông tin xác thực về mục này trong tài liệu của quán. Bạn xem thực đơn bên dưới hoặc hỏi nhân viên nhé!";
        }
        StringBuilder sb = new StringBuilder();
        for (ChatbotKnowledge d : docs) {
            sb.append("- ").append(d.getContent() == null ? "" : d.getContent().trim()).append("\n");
        }
        return sb.toString().trim();
    }

    /**
     * Chấm điểm tài liệu bằng từ khóa; dùng khi vector không dùng được hoặc không có hit.
     * Khớp cụm từ khóa dài (ví dụ "giờ mở cửa") được cộng thêm điểm.
     */
    private java.util.List<ChatbotKnowledge> keywordSearch(String question) {
        if (knowledgeRepo == null) return List.of();
        java.util.List<String> words = significantWords(question == null ? "" : question);
        if (words.isEmpty()) return List.of();
        java.util.List<ChatbotKnowledge> all;
        try {
            all = knowledgeRepo.findByEnabledTrue();
        } catch (Exception e) {
            return List.of();
        }
        List<Map.Entry<ChatbotKnowledge, Integer>> scored = new ArrayList<>();
        for (ChatbotKnowledge d : all) {
            String hay = plain((d.getTitle() == null ? "" : d.getTitle()) + " "
                    + (d.getCategory() == null ? "" : d.getCategory()) + " "
                    + (d.getKeywords() == null ? "" : d.getKeywords()) + " "
                    + (d.getContent() == null ? "" : d.getContent()));
            int s = 0;
            for (String w : words) {
                if (hay.contains(plain(w))) s++;
            }
            if (question != null && d.getKeywords() != null) {
                String q = plain(question);
                for (String kw : d.getKeywords().split(",")) {
                    String k = plain(kw.trim());
                    if (!k.isEmpty() && q.contains(k)) s += 2;
                }
            }
            if (s > 0) scored.add(Map.entry(d, s));
        }
        scored.sort(Comparator.comparingInt((Map.Entry<ChatbotKnowledge, Integer> e) -> e.getValue()).reversed());
        return scored.stream().limit(3).map(Map.Entry::getKey).toList();
    }

    /** Các đoạn vector gần nhất kèm similarity, để trả lời bám đúng đoạn thay vì cả tài liệu dài. */
    public java.util.List<VectorSearchService.ScoredChunk> retrieveChunks(String question) {
        if (vectorSearch == null) return List.of();
        try { return vectorSearch.search(question, 5); } catch (Exception e) { return List.of(); }
    }

    /**
     * Hỏi follow-up từng bước cho người mới khi câu hỏi gợi ý món quá chung.
     * Chỉ hỏi khi thiếu cả số người và ngân sách và câu chưa nhắc ràng buộc nào,
     * để câu "món chay" vẫn gợi ý ngay mà không bị chặn. Khách nói "tùy" thì gợi ý luôn.
     */
    public String followUpQuestion(String message, Filters filters, List<Food> menu) {
        if (message == null) return null;
        String plain = plain(message);
        if (plain.contains("tuy ban") || plain.contains("goi y luon") || plain.contains("cu") || plain.contains("ngon la duoc")) return null;
        if (filters.people() != null || filters.budget() != null) return null;
        // Co rang buoc rieng (chay, cay, hai san) thi goi y ngay, khong hoi.
        if (filters.chay() || filters.maxSpicyLevel() != null || filters.excludeSeafood() || filters.spicyRequired()) return null;
        // Chi hoi khi cau hoi chung chung ve mon.
        if (!isFoodQuestion(plain)) return null;
        // Neu cau hoi da co tu khoa mon cu the (ten mon trong DB) thi goi y ngay.
        String q = plain.toLowerCase();
        boolean hasDishWord = menu != null && menu.stream()
                .map(Food::getName).filter(Objects::nonNull)
                .anyMatch(n -> plain(n).length() > 3 && q.contains(plain(n)));
        if (hasDishWord) return null;
        return "Bạn đang muốn ăn cho mấy người? (Ví dụ: 2 người)";
    }

    /**
     * Luồng cố định: lưu câu hỏi, AI trích tiêu chí, server lọc database, AI viết câu trả lời.
     *
     * <p>Chưa cấu hình khóa API thì từ chối ngay, không lưu lịch sử và không chạy nhánh code:
     * trợ lý chỉ dùng được khi quản trị đã đặt khóa.
     */
    public ChatResponse chat(String email, ChatRequest req) {
        requireConfigured();
        String sessionId = req.sessionId() == null ? UUID.randomUUID().toString() : req.sessionId();
        User user = email == null ? null : userRepo.findByEmail(email).orElse(null);
        List<String> history = requestHistory(req.history());
        // Chỉ khách đã đăng nhập mới lưu lịch sử hội thoại; khách vãng lai dùng history do client gửi.
        if (user != null) {
            save(user, sessionId, ChatMessage.Sender.USER, req.message());
        }

        // Khách vừa được bot hỏi "mấy người?" trả lời gọn ("2", "2 người", "200k"):
        // ghép với câu hỏi gốc thay vì phân loại câu trả lời đứng một mình.
        String classifyMessage = resolveFollowUpAnswer(sessionId, req.message());
        boolean continuedFollowUp = !classifyMessage.equals(req.message());
        String workingMessage = enrichWithLastPicked(classifyMessage, req.lastFoodIds());

        // Phan loai cau hoi de di dung nhanh: thong tin quan va huong dan dat hang
        // tra loi bang tai lieu ma admin nhap, khong goi AI de tranh bia.
        IntentResult classified = classifyDetailed(classifyMessage);
        ChatIntent intent = classified.intent();
        if (intent == ChatIntent.RESTAURANT_INFO) {
            // Chunks đã tra ở bước phân loại được dùng lại; không có thì rơi sang chấm từ khóa.
            java.util.List<VectorSearchService.ScoredChunk> chunks = classified.chunks();
            String reply;
            java.util.List<Citation> cits;
            if (!chunks.isEmpty()) {
                StringBuilder sb = new StringBuilder();
                for (VectorSearchService.ScoredChunk sc : chunks) sb.append("- ").append(truncate(sc.chunk().getContent(), 400)).append("\n");
                reply = sb.toString().trim();
                cits = chunks.stream()
                        .map(sc -> new Citation(sc.document().getTitle(), truncate(sc.chunk().getContent(), 120)))
                        .toList();
            } else {
                // Không có vector hoặc vector không tìm thấy: chấm từ khóa để vẫn trả lời được từ tài liệu.
                List<ChatbotKnowledge> docs = keywordSearch(req.message());
                reply = infoReply(docs);
                cits = docs.stream()
                        .map(d -> new Citation(d.getTitle(), d.getContent() == null ? "" : truncate(d.getContent(), 120)))
                        .toList();
            }
            if (user != null) save(user, sessionId, ChatMessage.Sender.BOT, reply);
            return new ChatResponse(reply, List.of(), intent.name(), cits.isEmpty() ? null : cits, QR_INFO);
        }
        if (intent == ChatIntent.ORDER_GUIDE) {
            String reply = guideReply();
            if (user != null) save(user, sessionId, ChatMessage.Sender.BOT, reply);
            // Quy trình trả lời bằng code nên không trích dẫn tài liệu để tránh dẫn nguồn lệch.
            return new ChatResponse(reply, List.of(), intent.name(), null, QR_GUIDE);
        }
        if (intent == ChatIntent.OUT_OF_SCOPE) {
            String reply = declineReply();
            if (user != null) save(user, sessionId, ChatMessage.Sender.BOT, reply);
            return new ChatResponse(reply, List.of(), intent.name(), null, QR_DECLINE);
        }
        // "Món khác" (thường do khách bấm nút): chọn lại món mới không trùng các món vừa hiển thị,
        // do code quyết định; không gọi AI và không cần tiêu chí.
        if (isDifferentRequest(req.message())) {
            List<Food> menuNow = foodRepo.findAll();
            List<Long> exclude = req.lastFoodIds() == null ? List.of() : req.lastFoodIds();
            List<Picked> fresh = menuNow.stream()
                    .filter(Food::isAvailable)
                    .filter(f -> !exclude.contains(f.getId()))
                    .sorted(Comparator.comparingLong(f -> f.getPrice().longValue()))
                    .limit(maxSuggestions())
                    .map(f -> picked(f, null))
                    .toList();
            String reply = fresh.isEmpty()
                    ? "Mình chưa còn món nào khác phù hợp; bạn thử nói rõ hơn khẩu vị hoặc ngân sách nhé!"
                    : "Mình gợi ý một vài món khác, bấm vào thẻ để xem chi tiết nhé!";
            if (user != null) save(user, sessionId, ChatMessage.Sender.BOT, reply);
            List<FoodCard> cards = fresh.stream()
                    .map(p -> FoodCard.from(p.food(), p.portions(), p.totalPrice())).toList();
            return new ChatResponse(reply, cards, ChatIntent.FOOD.name(), null, quickRepliesFor(cards));
        }
        // FOOD: hoi follow-up tung buoc cho cau hoi chung chung cua nguoi moi.
        List<Food> menu = foodRepo.findAll();
        {
            Filters earlyFilters = readFilters(classifyMessage);
            String fu = followUpQuestion(classifyMessage, earlyFilters, menu);
            if (fu != null) {
                if (user != null) save(user, sessionId, ChatMessage.Sender.BOT, fu);
                // Giữ câu hỏi gốc để lượt sau ghép với câu trả lời ngắn ("2", "200k").
                pendingFollowUp.put(sessionId, new PendingFollowUp(req.message(), System.currentTimeMillis() + FOLLOW_UP_TTL_MS));
                return new ChatResponse(fu, List.of(), ChatIntent.FOOD.name(), null, QR_FOLLOWUP);
            }
        }

        Criteria criteria;
        List<Long> contextIds;
        List<Picked> aiPicked;
        String aiReply;
        try {
            Criteria rawCriteria = extractCriteria(workingMessage, history);
            criteria = rawCriteria == null ? null : normalizeCriteria(rawCriteria);
            // Câu trả lời vắn tắt cho follow-up: ghép ràng buộc server đọc được vào tiêu chí
            // AI trích để "2" vẫn thành people=2 kể cả khi AI bỏ sót.
            if (continuedFollowUp && criteria != null) {
                criteria = withAnsweredConstraints(criteria, req.message());
            }

            // Không phân tích được câu hỏi thì không gợi ý món. Tiêu chí rỗng sẽ khớp mọi món
            // và danh sách trả về chỉ là vài món rẻ nhất, hoàn toàn không liên quan tới câu hỏi.
            contextIds = contextIds(req, criteria);
            aiPicked = criteria == null ? List.of() : selectFoods(criteria, contextIds, menu);
            aiReply = criteria == null ? null : generateReply(req.message(), criteria, aiPicked, history);
        } catch (AiClient.AiKeyRejectedException e) {
            // Khóa có nhưng bị nhà cung cấp từ chối (sai, hết hạn, chưa bật API): coi như chưa
            // cấu hình, để khách nhận đúng câu báo và client khóa khung chat.
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, MISSING_KEY_NOTICE, e);
        }

        // Có khóa và gọi được AI nhưng không có câu trả lời (JSON sai, hết thời gian chờ) thì trả
        // lời bằng nhánh dự phòng: code chấm điểm và lọc món, vẫn ra thẻ món thật từ DB.
        List<Picked> picked;
        String reply;
        if (aiReply != null) {
            picked = aiPicked;
            reply = aiReply;
        } else {
            Filters filters = readFilters(classifyMessage);
            if (contextIds != null) {
                picked = selectContextByCode(contextIds, filters, menu);
            } else {
                picked = aiPicked.isEmpty() ? selectFoodsByCode(workingMessage, filters, menu) : aiPicked;
            }
            reply = fallbackReply(picked, filters);
        }
        if (user != null) {
            save(user, sessionId, ChatMessage.Sender.BOT, reply);
        }

        // Card được tạo từ entity đã lọc nên ID và giá không phụ thuộc vào nội dung AI.
        List<FoodCard> cards = picked.stream().limit(maxSuggestions())
                .map(p -> FoodCard.from(p.food(), p.portions(), p.totalPrice())).toList();
        return new ChatResponse(reply, cards, ChatIntent.FOOD.name(), null, quickRepliesFor(cards));
    }

    /**
     * Trạng thái sẵn dùng cho client; không trả giá trị khóa, chỉ boolean và câu thông báo.
     * Gọi {@code verifyKey()} để khóa sai/hết hạn hiện thông báo ngay khi mở trang.
     */
    public ChatbotStatus status() {
        boolean available = ai.verifyKey();
        return new ChatbotStatus(available, available ? null : MISSING_KEY_NOTICE);
    }

    private void requireConfigured() {
        if (!ai.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, MISSING_KEY_NOTICE);
        }
    }

    /** Khách đòi "Món khác" (thường do bấm nút): không qua AI, chỉ chọn món chưa hiển thị. */
    private boolean isDifferentRequest(String message) {
        if (message == null) return false;
        String p = plain(message).replaceAll("[^\\p{L}\\p{N} ]+", " ").replaceAll("\\s+", " ").trim();
        return p.equals("mon khac") || p.equals("mon khac di") || p.equals("khac di")
                || p.equals("doi mon khac") || p.equals("mon khac nha") || p.equals("mon khac khong");
    }

    /** Quick replies cho tin bot có thẻ món (hoặc không có). */
    private List<String> quickRepliesFor(List<FoodCard> cards) {
        return cards.isEmpty() ? QR_FOOD_EMPTY : QR_FOOD;
    }

    /**
     * Gộp câu trả lời gọn ("2", "2 người", "200k") với câu hỏi gốc đang chờ. Nếu không có gì
     * để gộp (hết hạn, khách đổi chủ đề, hoặc câu không phải trả lời) thì trả câu nguyên bản.
     */
    private String resolveFollowUpAnswer(String sessionId, String message) {
        PendingFollowUp pending = pendingFollowUp.get(sessionId);
        if (pending == null) return message;
        if (pending.expiresAtMs() <= System.currentTimeMillis()) {
            pendingFollowUp.remove(sessionId);
            return message;
        }
        String answer = followUpAnswerClause(message);
        if (answer == null) {
            // Khách đổi chủ đề giữa chừng: bỏ ngữ cảnh chờ, xử lý câu hỏi mới bình thường.
            pendingFollowUp.remove(sessionId);
            return message;
        }
        pendingFollowUp.remove(sessionId);
        return pending.originalMessage() + " " + answer;
    }

    /** Câu trả lời ngắn hợp lệ cho câu hỏi "mấy người/ngân sách"? Trả mẩu để ghép, hoặc null. */
    private String followUpAnswerClause(String message) {
        String trimmed = message == null ? "" : message.trim();
        if (trimmed.isEmpty()) return null;
        Matcher bare = BARE_NUMBER.matcher(trimmed);
        if (bare.matches()) {
            int n = Integer.parseInt(bare.group(1));
            return (n >= 1 && n <= 50) ? "cho " + n + " người" : null;
        }
        if (parsePeople(trimmed) != null || parseBudget(trimmed) != null) return trimmed;
        return null;
    }

    /** Ghép ràng buộc khách nêu vắn tắt trong câu trả lời ("2", "200k") vào tiêu chí AI trích. */
    private Criteria withAnsweredConstraints(Criteria c, String message) {
        Integer people = parsePeople(message);
        if (people == null) {
            Matcher bare = BARE_NUMBER.matcher(message.trim());
            if (bare.matches()) people = Integer.parseInt(bare.group(1));
        }
        Long budget = parseBudget(message);
        return new Criteria(c.categories(), c.maxSpicyLevel(),
                c.maxBudget() != null ? c.maxBudget() : budget,
                c.people() != null ? c.people() : people,
                c.excludeAllergens(), c.dietaryTags(), c.keywords());
    }

    /**
     * ID các món được dùng làm ngữ cảnh cho lượt này, hoặc null nếu phải tìm trên toàn thực đơn.
     * Điều kiện: câu có đại từ tham chiếu, client có gửi lastFoodIds, và tiêu chí không mở
     * chủ đề mới (danh mục, từ khóa, nhãn ăn kiêng, thành phần loại trừ).
     */
    private List<Long> contextIds(ChatRequest req, Criteria criteria) {
        if (!isFollowUp(req.message()) || req.lastFoodIds() == null || req.lastFoodIds().isEmpty()) {
            return null;
        }
        boolean newTopic = criteria != null ? hasNewTopic(criteria) : hasNewTopicByCode(req.message());
        return newTopic ? null : req.lastFoodIds();
    }

    /** Câu hỏi có đại từ/tham chiếu rõ tới lượt gợi ý trước không. */
    private boolean isFollowUp(String message) {
        String plain = plain(message);
        return FOLLOW_UP_PHRASES.stream().anyMatch(plain::contains);
    }

    /**
     * Tiêu chí có mở chủ đề mới không. Cay, ngân sách và số người không tính vì chúng vẫn áp
     * được lên đúng các món vừa gợi ý.
     */
    private boolean hasNewTopic(Criteria c) {
        if (c.categories() != null && !c.categories().isEmpty()) return true;
        if (c.dietaryTags() != null && !c.dietaryTags().isEmpty()) return true;
        if (c.excludeAllergens() != null && !c.excludeAllergens().isEmpty()) return true;
        return c.keywords() != null && c.keywords().stream().anyMatch(k -> !isReferenceKeyword(k));
    }

    /**
     * Từ khóa AI có thể trả cho câu hỏi tiếp ("món đó", "trên"...). Chúng không phải chủ đề
     * mới, nếu tính là chủ đề mới thì mọi câu hỏi tiếp đều mất ngữ cảnh.
     */
    private boolean isReferenceKeyword(String keyword) {
        String plain = plain(keyword).trim();
        if (plain.isEmpty()) return true;
        return FOLLOW_UP_PHRASES.stream().anyMatch(plain::contains)
                || Arrays.stream(plain.split("\\s+")).allMatch(REFERENCE_TOKENS::contains);
    }

    /** Bản dùng cho nhánh dự phòng, khi không có tiêu chí do AI trích xuất. */
    private boolean hasNewTopicByCode(String question) {
        Filters filters = readFilters(question);
        if (filters.chay() || filters.excludeSeafood()) return true;
        String plain = plain(question);
        return categoryRepo.findAll().stream()
                .map(Category::getName)
                .filter(Objects::nonNull)
                .map(this::plain)
                .filter(name -> !name.isBlank())
                .anyMatch(plain::contains);
    }

    /**
     * Câu hỏi trước do client gửi kèm. Giới hạn 3 câu để prompt không phình và không phụ
     * thuộc vào độ dài hội thoại trên giao diện.
     */
    private List<String> requestHistory(List<String> history) {
        if (history == null) return List.of();
        return history.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .limit(3)
                .toList();
    }

    /**
     * Một món được chọn kèm số phần cần để đủ cho số người ăn và tổng tiền của số phần đó.
     * Số phần suy ra từ khẩu phần của món: 4 người ăn, món phục vụ 2 người thì cần 2 phần.
     */
    private record Picked(Food food, int portions, long totalPrice) {}

    private Criteria extractCriteria(String message, List<String> history) {
        String categories = categoryRepo.findAll().stream().map(Category::getName)
                .collect(Collectors.joining(", "));
        String previous = history.isEmpty() ? "(không có)" : String.join("\n", history);
        try {
            String json = ai.generate(String.format(AiPrompts.EXTRACT_PROMPT, previous, categories), message, true);
            json = json.replaceAll("```json|```", "").trim();
            return mapper.readValue(json, Criteria.class);
        } catch (Exception e) {
            // Khóa bị từ chối thì dừng hẳn lượt này (chat() đổi thành 503) thay vì dựng tiêu chí
            // bằng code, vì khách cần thấy thông báo chưa cấu hình.
            if (e instanceof AiClient.AiKeyRejectedException rejected) throw rejected;
            // Lượt này không có tiêu chí đáng tin; chat() sẽ không gợi ý món cho câu hỏi này.
            return null;
        }
    }

    /**
     * Chuẩn hóa tiêu chí AI trích xuất: bỏ giá trị vô lý, trim chuỗi, loại từ khóa tham chiếu thuần.
     */
    private Criteria normalizeCriteria(Criteria c) {
        if (c == null) return null;
        Integer spicy = c.maxSpicyLevel();
        if (spicy != null && (spicy < 0 || spicy > 3)) spicy = null;
        Long budget = c.maxBudget();
        if (budget != null && budget <= 0) budget = null;
        Integer people = c.people();
        if (people != null && (people <= 0 || people > 50)) people = null;
        List<String> allergens = c.excludeAllergens() == null ? List.of() :
                c.excludeAllergens().stream().map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
        List<String> tags = c.dietaryTags() == null ? List.of() :
                c.dietaryTags().stream().map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
        List<String> keywords = c.keywords() == null ? List.of() :
                c.keywords().stream().map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
        // Từ khóa tham chiếu thuần ("món đó"...) không phải chủ đề mới và cũng không lọc được
        // món nào, nên bỏ thẳng thay vì để bộ lọc loại sạch rồi phải thử lại không từ khóa.
        keywords = keywords.stream().filter(k -> !isReferenceKeyword(k)).toList();
        List<CategoryNeed> groups = new ArrayList<>();
        if (c.categories() != null) {
            for (CategoryNeed g : c.categories()) {
                if (g == null || g.name() == null || g.name().isBlank()) continue;
                boolean trung = groups.stream().anyMatch(x -> x.name().equalsIgnoreCase(g.name()));
                if (trung) continue;
                int count = g.count() == null || g.count() < 1 ? 1 : g.count();
                groups.add(new CategoryNeed(g.name().trim(), count));
            }
        }
        return new Criteria(groups.isEmpty() ? null : groups, spicy, budget, people,
                allergens.isEmpty() ? null : allergens, tags.isEmpty() ? null : tags,
                keywords.isEmpty() ? null : keywords);
    }

    /**
     * Giải quyết đại từ tham chiếu: câu hỏi nhắc "món đó" kèm lastFoodIds thì ghép tên các món
     * vừa gợi ý vào để AI trích tiêu chí chính xác hơn.
     */
    private String enrichWithLastPicked(String message, List<Long> lastFoodIds) {
        if (message == null) return "";
        if (!isFollowUp(message) || lastFoodIds == null || lastFoodIds.isEmpty()) return message;
        List<String> names = foodRepo.findAllById(lastFoodIds).stream()
                .map(Food::getName).filter(Objects::nonNull).toList();
        if (names.isEmpty()) return message;
        return "Dựa trên các món vừa gợi ý: " + String.join(", ", names) + ". " + message;
    }

    /**
     * Chọn món theo tiêu chí. Chia làm hai bước để các ràng buộc về tiền và số người được
     * áp đúng: lọc thuộc tính món trước, rồi mới ghép và kiểm tra tổng ngân sách.
     */
    private List<Picked> selectFoods(Criteria c, List<Long> restrictIds, List<Food> menu) {
        // Bước 1: lọc thuộc tính của món. Danh mục và giá để dành cho bước 2 vì cách tính
        // tổng tiền phụ thuộc vào việc khách muốn một nhóm hay nhiều nhóm món.
        List<Food> pool = new ArrayList<>();
        for (Food f : menu) {
            if (!f.isAvailable()) continue;
            if (restrictIds != null && !restrictIds.contains(f.getId())) continue;
            if (c.maxSpicyLevel() != null && f.getSpicyLevel() > c.maxSpicyLevel()) continue;
            if (hasAny(f.getAllergens(), c.excludeAllergens())) continue;
            if (hasAny(f.getIngredients(), c.excludeAllergens())) continue;
            if (c.dietaryTags() != null && !c.dietaryTags().isEmpty()
                    && !containsAll(f.getDietaryTags(), c.dietaryTags())) continue;
            if (c.keywords() != null && !c.keywords().isEmpty() && !matchKeyword(f, c.keywords())) continue;
            pool.add(f);
        }
        if (pool.isEmpty() && c.keywords() != null && !c.keywords().isEmpty()) {
            // Tu khoa AI trich xuat qua chat che khong khop mon nao: bo loc tu khoa, van giu
            // cac rang buoc thuoc tinh (cay, allergen, nhan) de khong mat goi y.
            for (Food f : menu) {
                if (!f.isAvailable()) continue;
                if (c.maxSpicyLevel() != null && f.getSpicyLevel() > c.maxSpicyLevel()) continue;
                if (hasAny(f.getAllergens(), c.excludeAllergens())) continue;
                if (hasAny(f.getIngredients(), c.excludeAllergens())) continue;
                if (c.dietaryTags() != null && !c.dietaryTags().isEmpty()
                        && !containsAll(f.getDietaryTags(), c.dietaryTags())) continue;
                pool.add(f);
            }
        }
        if (pool.isEmpty()) return List.of();

        // Câu hỏi tiếp không mở chủ đề mới nên không gom lại theo danh mục.
        List<CategoryNeed> groups = restrictIds == null ? wantedGroups(c) : List.of();

        // Bước 2a: khách muốn kết hợp nhiều loại món ("một món chính và một món uống").
        // Ghép từ hợp tổng tiền của các món chọn phải nằm trong ngân sách.
        if (groups.size() >= 2) {
            List<List<Picked>> byGroup = new ArrayList<>();
            List<CategoryNeed> found = new ArrayList<>();
            for (CategoryNeed g : groups) {
                List<Picked> inGroup = pool.stream()
                        .filter(f -> inCategory(f, g.name()))
                        .map(f -> picked(f, c.people()))
                        .sorted(Comparator.comparingLong(Picked::totalPrice))
                        .limit(CANDIDATES_PER_GROUP)
                        .toList();
                if (inGroup.isEmpty()) continue;
                byGroup.add(inGroup);
                found.add(g);
            }
            List<Picked> combo = combine(byGroup, found, c.maxBudget());
            if (!combo.isEmpty()) return combo;
            // Có ngân sách mà không ghép được đủ số món mỗi nhóm thì trả rỗng, không lấy
            // lệch loại món khách yêu cầu chỉ để có vài thẻ.
            if (c.maxBudget() != null) return List.of();
            // Không ngân sách và thiếu loại: rơi xuống chọn phẳng như cũ.
        }

        // Bước 2b: một loại món, hoặc khách không nói rõ loại nào.
        List<Picked> candidates = groups.size() == 1
                ? pool.stream().filter(f -> inCategory(f, groups.get(0).name()))
                        .map(f -> picked(f, c.people())).toList()
                : pool.stream().map(f -> picked(f, c.people())).toList();

        if (c.maxBudget() != null) {
            return pickWithinTotalBudget(candidates, c.maxBudget());
        }
        // Không có ngân sách: giữ hành vi cũ, chat() cắt còn tối đa 5 lựa chọn.
        return candidates.stream()
                .sorted(Comparator.comparingLong(p -> p.food().getPrice().longValue()))
                .collect(Collectors.toCollection(ArrayList::new));
    }

    /**
     * Chọn 1..maxSuggestions món sao cho TỔNG tiền không vượt ngân sách và tổng tiền là lớn
     * nhất có thể. Chỉ dò trên 20 món rẻ nhất, đã bỏ trùng theo ID món.
     */
    private List<Picked> pickWithinTotalBudget(List<Picked> candidates, long limit) {
        Map<Long, Picked> byId = new LinkedHashMap<>();
        candidates.forEach(p -> byId.putIfAbsent(p.food().getId(), p));
        List<Picked> cheapest = byId.values().stream()
                .sorted(Comparator.comparingLong(Picked::totalPrice))
                .limit(FLAT_CANDIDATES)
                .toList();
        List<Picked> best = new FlatBudgetPicker(cheapest, limit, maxSuggestions()).find();
        return best.stream()
                .sorted(Comparator.comparingLong(p -> p.food().getPrice().longValue()))
                .collect(Collectors.toCollection(ArrayList::new));
    }

    /** Câu hỏi tiếp ở nhánh dự phòng: chỉ xét các món vừa gợi ý và áp ràng buộc đọc được. */
    private List<Picked> selectContextByCode(List<Long> ids, Filters filters, List<Food> menu) {
        List<Picked> kept = menu.stream()
                .filter(f -> f != null && f.getId() != null && ids.contains(f.getId()))
                .filter(Food::isAvailable)
                .filter(f -> passesFilters(f, filters))
                .map(f -> picked(f, filters.people()))
                .toList();
        if (filters.budget() != null) {
            return pickWithinTotalBudget(kept, filters.budget());
        }
        return kept.stream()
                .sorted(Comparator.comparingLong(p -> p.food().getPrice().longValue()))
                .collect(Collectors.toCollection(ArrayList::new));
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
     * Ghép món từ nhiều loại sao cho tổng tiền không vượt ngân sách. Mỗi loại lấy tối đa
     * {@link #CANDIDATES_PER_GROUP} món rẻ nhất làm ứng viên rồi dò tổ hợp; trong các tổ hợp
     * hợp lệ thì lấy tổng tiền cao nhất để khách dùng được ngân sách mà vẫn nằm trong hạn mức.
     */
    private List<Picked> combine(List<List<Picked>> byGroup, List<CategoryNeed> groups, Long maxBudget) {
        return new BudgetCombiner(byGroup, groups, maxBudget).find();
    }

    /**
     * Dò tổ hợp vì ngân sách dùng backtracking. Toàn bộ trạng thái tìm kiếm (ứng viên theo
     * loại, ngân sách, tổ hợp tốt nhất) gói trong một đối tượng thay vì chuyền qua từng
     * lượt gọi đệ quy như trước, nên tầng gọi ngoài không cần biết chuyện bên trong.
     */
    private static final class BudgetCombiner {
        private final List<List<Picked>> byGroup;
        private final List<CategoryNeed> groups;
        private final long limit;
        private final List<Picked> best = new ArrayList<>();
        private long bestTotal = -1;

        BudgetCombiner(List<List<Picked>> byGroup, List<CategoryNeed> groups, Long maxBudget) {
            this.byGroup = byGroup;
            this.groups = groups;
            this.limit = maxBudget == null ? Long.MAX_VALUE : maxBudget;
        }

        List<Picked> find() {
            search(0, 0, new ArrayList<>(), 0L);
            return best;
        }

        private void search(int groupIndex, int from, List<Picked> acc, long total) {
            if (total > limit) return;
            if (groupIndex == groups.size()) {
                if (total > bestTotal) {
                    bestTotal = total;
                    best.clear();
                    best.addAll(acc);
                }
                return;
            }
            List<Picked> candidates = byGroup.get(groupIndex);
            int needed = groups.get(groupIndex).count();
            pickFrom(candidates, groupIndex, from, needed, acc, total);
        }

        /** Chọn `needed` món từ một loại; chỉ dùng chỉ số tăng dần nên không chọn trùng món. */
        private void pickFrom(List<Picked> candidates, int groupIndex, int from, int needed,
                              List<Picked> acc, long total) {
            if (total > limit) return;
            if (needed == 0) {
                search(groupIndex + 1, 0, acc, total);
                return;
            }
            for (int i = from; i < candidates.size(); i++) {
                acc.add(candidates.get(i));
                pickFrom(candidates, groupIndex, i + 1, needed - 1, acc,
                        total + candidates.get(i).totalPrice());
                acc.remove(acc.size() - 1);
            }
        }
    }

    /**
     * Bộ chọn phẳng cho trường hợp 0/1 nhóm món: chọn không quá {@code maxItems} món sao cho
     * tổng tiền không vượt hạn mức và lớn nhất có thể. Hoà tổng thì ưu tiên nhiều món hơn.
     */
    private static final class FlatBudgetPicker {
        private final List<Picked> candidates;
        private final long limit;
        private final int maxItems;
        private List<Picked> best = List.of();
        private long bestTotal = -1;

        FlatBudgetPicker(List<Picked> candidates, long limit, int maxItems) {
            this.candidates = candidates;
            this.limit = limit;
            this.maxItems = maxItems;
        }

        List<Picked> find() {
            search(0, new ArrayList<>(), 0L);
            return best;
        }

        private void search(int from, List<Picked> acc, long total) {
            if (!acc.isEmpty()
                    && (total > bestTotal || (total == bestTotal && acc.size() > best.size()))) {
                bestTotal = total;
                best = List.copyOf(acc);
            }
            if (acc.size() >= maxItems) return;
            for (int i = from; i < candidates.size(); i++) {
                long next = total + candidates.get(i).totalPrice();
                if (next > limit) continue;
                acc.add(candidates.get(i));
                search(i + 1, acc, next);
                acc.remove(acc.size() - 1);
            }
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

    private String generateReply(String question, Criteria c, List<Picked> foods,
                                 List<String> history) {
        // Chỉ đưa dữ liệu món đã lọc vào prompt; AI không tự tạo danh sách món.
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
        // Tổng bộ gợi ý do server cộng sẵn để AI không nói sai ngân sách, nhất là khi ngân
        // sách là tổng của nhiều món chứ không phải giá từng món.
        long total = foods.stream().mapToLong(Picked::totalPrice).sum();
        data.append("\nTỔNG BỘ GỢI Ý: ").append(total).append(" VND\n");
        if (c.maxBudget() != null) {
            data.append("NGÂN SÁCH: ").append(c.maxBudget()).append(" VND\n");
        }
        data.append("\nCÂU HỎI CỦA KHÁCH: ").append(question);

        try {
            return ai.generate(String.format(AiPrompts.ANSWER_PROMPT, extraRules()), data.toString(), false);
        } catch (Exception e) {
            // Khóa bị từ chối thì không rơi sang nhánh dự phòng; chat() đổi thành 503.
            if (e instanceof AiClient.AiKeyRejectedException rejected) throw rejected;
            // Trả null để lớp gọi biết lượt này không có câu trả lời AI và rơi sang nhánh dự phòng.
            return null;
        }
    }

    // ---------------------------------------------------------------------------------------
    // Nhánh dự phòng: không gọi được AI thì lấy món bằng code và dựng câu trả lời từ dữ liệu món thật.
    // ---------------------------------------------------------------------------------------

    /**
     * Cụm tham chiếu rõ tới lượt gợi ý trước, đã bỏ dấu. Chỉ những cụm này mới coi là câu hỏi
     * tiếp; không dùng độ dài câu để đoán vì "món chay" cũng ngắn.
     */
    private static final List<String> FOLLOW_UP_PHRASES = List.of(
            "mon do", "cai do", "mon nay", "cai nay", "mon vua goi y", "mon vua roi",
            "may mon tren", "trong so do", "cac mon do", "nhung mon do", "mon tren");

    /** Từ đơn không đủ để coi là chủ đề mới khi AI trả về trong {@code keywords} của câu hỏi tiếp. */
    private static final Set<String> REFERENCE_TOKENS = Set.of(
            "mon", "cai", "do", "nay", "vua", "goi", "y", "tren", "may", "trong", "so",
            "cac", "nhung", "roi", "vay");

    /** Từ khóa bỏ qua khi chấm điểm món: chúng nói về cách hỏi chứ không nói về món. */
    private static final Set<String> STOP_WORDS = Set.of(
            "món", "mon", "nào", "nao", "gợi", "ý", "cho", "một", "mot", "các", "của", "cua",
            "hoặc", "không", "khong", "được", "duoc", "với", "voi", "muốn", "muon", "quán",
            "quan", "nhà", "nha", "hàng", "hang", "thế", "gì", "gi", "bao", "nhiêu", "nhieu",
            "dưới", "duoi", "trên", "khoảng", "khoang", "đến", "den", "theo", "người", "nguoi",
            "nhóm", "nhom", "nhé", "nhe", "sao", "đây", "day", "những", "nhung", "rất", "rat",
            "hơn", "hon", "cũng", "cung", "đều", "deu", "nữa", "nua", "vậy", "vay", "ngon",
            "nhất", "nhat", "phải", "phai", "nên", "nen", "hợp", "hop", "lực", "luc", "chọn",
            "chon", "đặt", "dat", "tôi", "toi", "cay", "thức", "thuc", "loại", "loai");

    /** Câu hỏi có chứa từ này thì mới coi là hỏi về món ăn; hỏi ngoài lề thì không gợi ý món. */
    private static final List<String> FOOD_QUESTION_WORDS =
            List.of("mon", "thuc don", "menu", "goi y", "quan", "dat", "food", "dishes");

    /** Số tiền trong câu hỏi: "100.000", "150k", "2 triệu", "50.000 đồng". */
    private static final Pattern MONEY = Pattern.compile(
            "(\\d+(?:\\.\\d{3})+)|(?:(\\d+)\\s*(k|nghìn|nghin|ngan|ngàn|triệu|trieu))|(?:(\\d+)\\s*(đồng|dong|đ))",
            Pattern.CASE_INSENSITIVE);

    /** Số người ăn trong câu hỏi: "2 người", "cho 4 người". */
    private static final Pattern PEOPLE = Pattern.compile("(\\d+)\\s*(người|nguoi|people)", Pattern.CASE_INSENSITIVE);

    /** Số đứng một mình ("2") — chỉ có nghĩa khi bot vừa hỏi "mấy người?". */
    private static final Pattern BARE_NUMBER = Pattern.compile("^\\s*(\\d{1,2})\\s*$");

    /** Món cùng số điểm từ khoá thì món rẻ hơn đứng trước. */
    private record Scored(Food food, int score) {}

    /**
     * Ràng buộc đọc được chắc chắn từ câu hỏi. Đọc một lần rồi dùng cho cả lọc món lẫn câu
     * tóm tắt trong câu trả lời, nên hai chỗ không lệch nhau.
     */
    private record Filters(Integer maxSpicyLevel, boolean spicyRequired, boolean chay,
                           boolean excludeSeafood, Long budget, Integer people) {

        /** Mô tả ngắn các ràng buộc để ghép vào câu tóm tắt. */
        String describe() {
            List<String> parts = new ArrayList<>();
            if (chay) parts.add("chay");
            if (maxSpicyLevel != null && maxSpicyLevel == 0) parts.add("không cay");
            if (spicyRequired) parts.add("cay");
            if (excludeSeafood) parts.add("không chứa hải sản");
            if (budget != null) parts.add("trong ngân sách " + vnd(budget));
            return String.join(", ", parts);
        }
    }

    /**
     * Lọc món bằng code khi không gọi được AI: chấm điểm món theo số từ khoá trùng với câu hỏi
     * rồi áp các ràng buộc đọc được chắc chắn từ câu (không cay, chay, loại trừ hải sản,
     * ngân sách, số người). Món khớp nhiều từ khoá hơn đứng trước.
     */
    private List<Picked> selectFoodsByCode(String question, Filters filters, List<Food> menu) {
        List<String> words = significantWords(question);
        String plain = plain(question);

        List<Scored> scored = new ArrayList<>();
        for (Food f : menu) {
            if (!f.isAvailable()) continue;
            int s = keywordScore(f, words);
            // Tên danh mục chỉ tính khi câu hỏi có nguyên cụm tên danh mục, không tính từng từ:
            // hỏi "Việt Nam" không được khớp danh mục "Món Việt".
            if (mentionsCategory(f, plain)) s++;
            if (s > 0) scored.add(new Scored(f, s));
        }
        // Không từ khoá nào trùng món nào: câu hỏi chung về món ăn vẫn gợi ý được vài món đang
        // phục vụ, còn câu hỏi ngoài lề thì không gợi ý gì để khách không bị đẩy món lung tung.
        if (scored.isEmpty()) {
            if (!isFoodQuestion(plain)) return List.of();
            for (Food f : menu) {
                if (f.isAvailable()) scored.add(new Scored(f, 0));
            }
        }

        List<Scored> kept = scored.stream()
                .filter(s -> passesFilters(s.food(), filters))
                .collect(Collectors.toCollection(ArrayList::new));
        if (kept.isEmpty() && !scored.isEmpty()) {
            // Món khớp từ khoá bị bộ lọc loại hết (ví dụ khách hỏi món "không chứa hải sản" mà
            // tên món lại chứa hải sản) thì lấy trong toàn bộ món đang phục vụ, vẫn áp bộ lọc.
            for (Food f : menu) {
                if (f.isAvailable() && passesFilters(f, filters)) {
                    kept.add(new Scored(f, 0));
                }
            }
        }
        kept.sort(Comparator.comparingInt(Scored::score).reversed()
                .thenComparingLong(s -> s.food().getPrice().longValue()));
        List<Picked> picked = kept.stream().map(s -> picked(s.food(), filters.people())).toList();
        // Ngân sách là tổng cả bộ gợi ý, kể cả ở nhánh dự phòng.
        if (filters.budget() != null) {
            return pickWithinTotalBudget(picked, filters.budget());
        }
        return picked.stream().limit(maxSuggestions()).toList();
    }

    /**
     * Câu trả lời dựng bằng code khi không gọi được AI. Chỉ tóm tắt ngắn gọn vì thẻ món ngay
     * dưới đã hiện tên, giá và số phần của từng món, không cần liệt kê lại trong chữ.
     */
    private String fallbackReply(List<Picked> dishes, Filters filters) {
        if (dishes.isEmpty()) {
            if (filters.budget() != null) {
                return "Mình chưa tìm được món nào trong ngân sách " + vnd(filters.budget())
                        + ". Bạn thử nới ngân sách hoặc bỏ bớt điều kiện nhé!";
            }
            return "Mình chỉ tư vấn được về món ăn của quán. Bạn xem thực đơn bên dưới nhé!";
        }

        long total = dishes.stream().mapToLong(Picked::totalPrice).sum();
        String described = filters.describe();
        StringBuilder sb = new StringBuilder("Mình tìm được ").append(dishes.size()).append(" món");
        if (!described.isEmpty()) {
            sb.append(" ").append(described);
        }
        if (filters.budget() != null) {
            // "trong ngân sách X" đã nằm trong describe(); chỉ cần thêm tổng thực tế.
            sb.append(", tổng ").append(vnd(total)).append(".");
        } else {
            long minPrice = dishes.stream().mapToLong(p -> p.food().getPrice().longValue()).min().orElse(0);
            sb.append(", giá từ ").append(vnd(minPrice)).append(".");
        }
        sb.append("\n\nBấm vào thẻ món bên dưới để xem chi tiết và đặt món nhé!");
        return sb.toString();
    }

    /** Từ khoá của câu hỏi sau khi bỏ từ dừng và từ quá ngắn. */
    private List<String> significantWords(String question) {
        return Arrays.stream(question.toLowerCase().split("[^\\p{L}\\p{N}]+"))
                .filter(w -> w.length() > 2 && !STOP_WORDS.contains(w))
                .distinct()
                .toList();
    }

    /** Số từ khoá của câu hỏi xuất hiện trong tên món, nguyên liệu hoặc nhãn của món. */
    private int keywordScore(Food f, List<String> words) {
        // Mô tả không tính vào điểm: câu "Ai là Tổng thống Việt Nam" sẽ khớp chữ "thống" trong
        // "truyền thống" và biến câu hỏi ngoài lề thành câu hỏi về món.
        String hay = (f.getName() + " " + nz(f.getIngredients()) + " " + nz(f.getDietaryTags())).toLowerCase();
        int score = 0;
        for (String w : words) {
            if (hay.contains(w)) score++;
        }
        return score;
    }

    /** Câu hỏi có nhắc đúng tên danh mục của món không; so cả hai theo dạng bỏ dấu. */
    private boolean mentionsCategory(Food f, String plainQuestion) {
        return f.getCategory() != null
                && f.getCategory().getName() != null
                && !f.getCategory().getName().isBlank()
                && plainQuestion.contains(plain(f.getCategory().getName()));
    }

    /**
     * Đọc các ràng buộc trong câu hỏi. So khớp bỏ dấu để "khong cay" và "không cay" là một,
     * dữ liệu món cũng so theo dạng bỏ dấu.
     */
    private Filters readFilters(String question) {
        String plain = plain(question);
        boolean noSpicy = plain.contains("khong cay");
        boolean spicy = !noSpicy && plain.contains("cay");
        boolean excludeSeafood = plain.contains("hai san")
                && (plain.contains("khong") || plain.contains("di ung") || plain.contains("tranh"));
        return new Filters(noSpicy ? 0 : null, spicy, plain.contains("chay"), excludeSeafood,
                parseBudget(question), parsePeople(question));
    }

    /** Món có vượt các ràng buộc khách nêu trong câu hỏi không. */
    private boolean passesFilters(Food f, Filters filters) {
        if (filters.maxSpicyLevel() != null && f.getSpicyLevel() > filters.maxSpicyLevel()) return false;
        if (filters.spicyRequired() && f.getSpicyLevel() == 0) return false;
        if (filters.chay() && !containsPlain(f.getDietaryTags(), "chay")) return false;
        if (filters.excludeSeafood()
                && (containsPlain(f.getAllergens(), "hải sản") || containsPlain(f.getIngredients(), "hải sản"))) {
            return false;
        }
        if (filters.budget() != null) {
            int people = filters.people() == null ? 1 : portionsFor(f, filters.people());
            if (f.getPrice().longValue() * people > filters.budget()) return false;
        }
        return true;
    }

    /** Câu hỏi có phải hỏi về món ăn không, xét trên dạng bỏ dấu. */
    private boolean isFoodQuestion(String plain) {
        return FOOD_QUESTION_WORDS.stream().anyMatch(plain::contains);
    }

    /** Số người ăn nằm trong câu hỏi, hoặc null nếu khách không nói. */
    private Integer parsePeople(String question) {
        Matcher m = PEOPLE.matcher(question);
        if (!m.find()) return null;
        int people = Integer.parseInt(m.group(1));
        return people > 0 ? people : null;
    }

    /** Ngân sách trong câu hỏi, hoặc null nếu khách không nói. Nhiều mức thì lấy mức cao nhất. */
    private Long parseBudget(String question) {
        Matcher m = MONEY.matcher(question);
        Long best = null;
        while (m.find()) {
            long value;
            if (m.group(1) != null) {
                value = Long.parseLong(m.group(1).replace(".", ""));
            } else if (m.group(2) != null) {
                long base = Long.parseLong(m.group(2));
                String unit = m.group(3).toLowerCase();
                value = (unit.equals("triệu") || unit.equals("trieu")) ? base * 1_000_000 : base * 1_000;
            } else {
                value = Long.parseLong(m.group(4));
            }
            if (best == null || value > best) best = value;
        }
        return best;
    }

    /**
     * Bỏ dấu tiếng Việt và chuyển chữ thường để so khớp không phân biệt dấu. "đ" không có
     * dạng NFD nên phải đổi riêng, nếu không "món đó" sẽ không khớp cụm "mon do".
     */
    private String plain(String text) {
        if (text == null) return "";
        return Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'd')
                .toLowerCase();
    }

    /** Trường của món có chứa từ cần tìm không, so trên dạng bỏ dấu. */
    private boolean containsPlain(String field, String word) {
        return field != null && plain(field).contains(plain(word));
    }

    /** Số tiền kiểu Việt Nam: 65.000đ. */
    private static String vnd(long amount) {
        return String.format("%,d", amount).replace(",", ".") + "đ";
    }

    private String extraRules() {
        return settingRepo.findById("extra_rules").map(AiSetting::getSettingValue)
                .map(v -> "11. Quy tắc bổ sung của nhà hàng: " + v).orElse("");
    }

    /**
     * Số thẻ món tối đa mỗi lượt, luôn nằm trong 1..5 kể cả khi cấu hình cũ đang để 8/10.
     * Giá trị hỏng được coi như mặc định 5 thay vì làm hỏng cả lượt chat.
     */
    private int maxSuggestions() {
        return settingRepo.findById("max_suggestions")
                .map(AiSetting::getSettingValue)
                .map(String::trim)
                .map(v -> {
                    try {
                        return Integer.parseInt(v);
                    } catch (NumberFormatException e) {
                        return 5;
                    }
                })
                .map(v -> Math.max(1, Math.min(5, v)))
                .orElse(5);
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

    private static String truncate(String s, int max) {
        if (s == null) return "";
        String t = s.replaceAll("\\s+", " ").trim();
        return t.length() <= max ? t : t.substring(0, max).trim() + "...";
    }
}
