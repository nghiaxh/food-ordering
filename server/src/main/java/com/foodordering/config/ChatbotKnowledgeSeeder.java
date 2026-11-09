package com.foodordering.config;

import com.foodordering.entity.ChatbotKnowledge;
import com.foodordering.repository.ChatbotKnowledgeRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Nap tai lieu mau khi bang rong, de DB cu cung co thong tin quan ma khong phai chay lai seed user.
 * Noi dung la placeholder, admin sua o tab Tai lieu sau.
 */
@Component
public class ChatbotKnowledgeSeeder implements CommandLineRunner {
    private final ChatbotKnowledgeRepository repo;

    public ChatbotKnowledgeSeeder(ChatbotKnowledgeRepository repo) {
        this.repo = repo;
    }

    @Override
    public void run(String... args) {
        if (repo.count() > 0) return;
        add("Giờ mở cửa", "HOURS", "giờ mở cửa, mấy giờ đóng cửa, mở cửa, đóng cửa", "Quán mở cửa từ 07:00 đến 22:00 hằng ngày. Sau 21:30 món có thể hết dần, bạn cân nhắc đặt sớm hơn nhé!");
        add("Địa chỉ quán", "SHOP", "địa chỉ, ở đâu, quán ở đâu", "Quán ở Cần Thơ (địa chỉ chi tiết xem ở chân trang). Bạn có thể đặt giao hàng tới địa chỉ của bạn.");
        add("Giao hàng và phí ship", "DELIVERY", "giao hàng, ship, phí ship, thời gian giao", "Thời gian giao thường 20-30 phút tùy khoảng cách. Phí ship tính theo khoảng cách, xem chi tiết ở bước thanh toán.");
        add("Thanh toán", "PAYMENT", "thanh toán, trả tiền, cod, qr", "Bạn có thể thanh toán COD hoặc QR sau khi tạo đơn. Đơn UNPAID và PENDING mới được hủy.");
        add("Cách đặt món", "ORDER", "cách đặt món, đặt món thế nào, thêm vào giỏ", "Thêm món vào giỏ rồi vào trang thanh toán để đặt. Khách vãng lai cần đăng nhập mới thêm được vào giỏ.");
        add("Hủy đơn", "ORDER", "hủy đơn, hủy hàng", "Chỉ hủy được đơn đang CHỜ (PENDING) và CHƯA thanh toán (UNPAID). Đơn đã hoàn thành hoặc đã hủy không sửa được.");
        add("Dị ứng và thành phần", "ALLERGY", "dị ứng, thành phần, hải sản", "Mỗi món có bảng nguyên liệu và dị ứng. Nếu bạn dị ứng nặng, nhắn cho quán hoặc hỏi nhân viên trước khi đặt.");
        add("Giỏ hàng đăng nhập", "ORDER", "giỏ hàng, đăng nhập, tài khoản", "Giỏ hàng cần đăng nhập, khách vãng lai xem món được nhưng chưa thêm vào giỏ được.");
    }

    private void add(String title, String cat, String keys, String content) {
        repo.save(new ChatbotKnowledge(title, cat, keys, content, true));
    }
}
