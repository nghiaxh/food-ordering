package com.foodordering.config;

import com.foodordering.entity.*;
import com.foodordering.repository.*;
import com.foodordering.service.AiClient;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {
    private final UserRepository userRepo;
    private final CategoryRepository categoryRepo;
    private final FoodRepository foodRepo;
    private final PromotionRepository promotionRepo;
    private final OrdersRepository orderRepo;
    private final PaymentTransactionRepository paymentTxRepo;
    private final ReviewRepository reviewRepo;
    private final AiSettingRepository settingRepo;
    private final PasswordEncoder encoder;

    public DataSeeder(UserRepository userRepo, CategoryRepository categoryRepo, FoodRepository foodRepo,
                      PromotionRepository promotionRepo,
                      OrdersRepository orderRepo, PaymentTransactionRepository paymentTxRepo,
                      ReviewRepository reviewRepo, AiSettingRepository settingRepo, PasswordEncoder encoder) {
        this.userRepo = userRepo;
        this.categoryRepo = categoryRepo;
        this.foodRepo = foodRepo;
        this.promotionRepo = promotionRepo;
        this.orderRepo = orderRepo;
        this.paymentTxRepo = paymentTxRepo;
        this.reviewRepo = reviewRepo;
        this.settingRepo = settingRepo;
        this.encoder = encoder;
    }

    // Seeder chỉ chạy khi database còn trống, nhờ vậy khởi động lại không nhân đôi dữ liệu demo.
    @Override
    public void run(String... args) {
        if (userRepo.count() > 0) return;

        User admin = createUser("admin@demo.com", "admin123", "Quản trị viên", "0900000001",
                "Số 1 Phố Ẩm Thực, Hà Nội", User.Role.ADMIN);
        User khach = createUser("user@demo.com", "user1234", "Khách hàng Demo", "0900000002",
                "12 Láng, Đống Đa, Hà Nội", User.Role.CUSTOMER);

        Category viet = cat("Món Việt", "mon-viet", "/images/categories/mon-viet.webp",
                "Cơm, phở, bún, mì và các món Việt truyền thống");
        Category au = cat("Món Âu", "mon-au", "/images/categories/mon-au.webp",
                "Món Ý, phương Tây với thịt và rau củ");
        Category uong = cat("Đồ uống", "do-uong", "/images/categories/do-uong.webp",
                "Nước ngọt, trà trái cây và cà phê");
        Category trangMieng = cat("Tráng miệng", "trang-mieng", "/images/categories/trang-mieng.webp",
                "Chè và món ngọt sau bữa ăn");
        Category chay = cat("Món chay", "mon-chay", "/images/categories/mon-chay.webp",
                "Món không dùng thịt, phục vụ người ăn chay");

        Food pho = food("Phở bò", viet, "Phở bò truyền thống, nước dùng hầm xương 12 giờ",
                "bánh phở, thịt bò, hành, quế, hồi", 65000, 1, 0, "", "gluten", "pho-bo");
        Food bunCha = food("Bún chả Hà Nội", viet, "Bún chả nướng than hoa ăn kèm nước mắm chua ngọt",
                "bún, thịt heo, nước mắm, rau sống", 60000, 1, 0, "", "", "bun-cha");
        Food comGa = food("Cơm gà xối mỡ", viet, "Cơm gà chiên giòn ăn kèm dưa leo", "cơm, gà, dưa leo",
                55000, 1, 0, "", "", "com-ga-xoi-mo");
        Food bunBoHue = food("Bún bò Huế", viet, "Bún bò cay đặc trưng miền Trung",
                "bún, thịt bò, giò heo, sả, ớt", 70000, 1, 3, "", "gluten", "bun-bo-hue");
        food("Gỏi cuốn tôm thịt", viet, "Gỏi cuốn tươi mát chấm tương đậu phộng",
                "bánh tráng, tôm, thịt heo, bún, rau", 45000, 2, 0, "", "hải sản,đậu phộng", "goi-cuon");
        food("Canh chua cá lóc", viet, "Canh chua miền Tây với cá lóc, thơm, cà chua",
                "cá lóc, thơm, cà chua, đậu bắp", 90000, 3, 1, "ít dầu mỡ", "hải sản", "canh-chua-ca-loc");
        Food rau = food("Rau muống xào tỏi", chay, "Rau muống xào tỏi giòn xanh",
                "rau muống, tỏi", 35000, 2, 0, "chay,ít dầu mỡ", "", "rau-muong-xao-toi");
        Food dauHu = food("Đậu hũ sốt cà chua", chay, "Đậu hũ non sốt cà chua thanh đạm",
                "đậu hũ, cà chua, hành", 40000, 2, 0, "chay", "đậu nành", "dau-hu-sot-ca-chua");
        food("Lẩu thái hải sản", viet, "Lẩu chua cay với tôm, mực, nghêu",
                "tôm, mực, nghêu, sả, ớt, nấm", 250000, 4, 3, "", "hải sản", "lau-thai-hai-san");
        food("Bò lúc lắc", viet, "Bò lúc lắc khoai tây chiên",
                "thịt bò, khoai tây, hành tây", 120000, 2, 0, "", "", "bo-luc-lac");
        Food myY = food("Mỳ Ý sốt bò bằm", au, "Spaghetti sốt cà chua thịt bò bằm",
                "mỳ Ý, thịt bò, cà chua", 85000, 1, 0, "", "gluten", "my-y-bo-bam");
        food("Salad Caesar", au, "Salad rau xà lách, gà nướng, phô mai",
                "xà lách, gà, phô mai, sốt caesar", 75000, 1, 0, "ít dầu mỡ", "sữa,trứng", "salad-caesar");
        Food traDao = food("Trà đào cam sả", uong, "Trà đào thanh mát", "trà, đào, cam, sả", 40000, 1, 0, "chay", "", "tra-dao-cam-sa");
        Food nuocCam = food("Nước cam ép", uong, "Cam vắt nguyên chất", "cam", 35000, 1, 0, "chay,ít dầu mỡ", "", "nuoc-cam-ep");
        Food caPhe = food("Cà phê sữa đá", uong, "Cà phê phin truyền thống", "cà phê, sữa đặc", 30000, 1, 0, "", "sữa", "ca-phe-sua-da");
        food("Chè khúc bạch", trangMieng, "Chè khúc bạch hạnh nhân", "sữa, hạnh nhân, vải",
                45000, 1, 0, "chay", "sữa,hạt", "che-khuc-bach");

        // ----- Khuyến mãi mẫu (chỉ khuyến mãi tự động, không cần mã) -----
        LocalDateTime now = LocalDateTime.now();
        // Cuối tuần: tự áp cho đồ uống, không cần mã.
        Promotion weekend = promo("Cuối tuần mát lạnh", "Giảm 20% đồ uống thứ Bảy và Chủ Nhật",
                Promotion.DiscountType.PERCENT, 20, Promotion.Scope.CATEGORY, now);
        weekend.setDaysOfWeek("SAT,SUN");
        weekend.setTargetIds(List.of(uong.getId()));
        promotionRepo.save(weekend);
        // Món may mắn mỗi ngày: hai món ngẫu nhiên giảm 15%, tự đổi khi sang ngày mới.
        Promotion daily = promo("Món may mắn hôm nay", "Hai món ngẫu nhiên giảm 15% mỗi ngày",
                Promotion.DiscountType.PERCENT, 15, Promotion.Scope.GLOBAL, now);
        daily.setRandomCount(2);
        promotionRepo.save(daily);

        // Đơn mẫu để màn hình quản trị và luồng đánh giá (chỉ món từ đơn Hoàn thành) có dữ liệu ngay.
        order(khach, Orders.Status.COMPLETED, "QR", Orders.PaymentStatus.PAID,
                khach.getAddress(), null, LocalDateTime.now().minusDays(6), new Line(pho, 2), new Line(bunCha, 1));
        order(khach, Orders.Status.PREPARING, "COD", Orders.PaymentStatus.UNPAID,
                khach.getAddress(), "Ít cay, gọi trước 10 phút", LocalDateTime.now().minusHours(2),
                new Line(bunBoHue, 1), new Line(dauHu, 2));
        order(khach, Orders.Status.PENDING, "QR", Orders.PaymentStatus.UNPAID,
                khach.getAddress(), null, LocalDateTime.now().minusMinutes(20),
                new Line(rau, 1), new Line(myY, 1));

        review(khach, pho, 5, "Nước dùng ngon, phở đúng vị Hà Nội.");
        review(khach, bunCha, 4, "Nướng than rất thơm, chấm nước mắm vừa ăn.");


        setting("max_suggestions", "5");
        setting("provider", AiClient.PROVIDER_GEMINI);
        setting("model", "gemini-2.0-flash");
    }

    private User createUser(String email, String pass, String name, String phone,
                            String address, User.Role role) {
        User u = new User();
        u.setEmail(email);
        u.setPassword(encoder.encode(pass));
        u.setFullName(name);
        u.setPhone(phone);
        u.setAddress(address);
        u.setRole(role);
        return userRepo.save(u);
    }

    private Category cat(String name, String slug, String image, String description) {
        Category c = new Category();
        c.setName(name);
        c.setSlug(slug);
        c.setImageUrl(image);
        c.setDescription(description);
        return categoryRepo.save(c);
    }

    /** Trả về món vừa lưu để seeder tạo đơn và đánh giá tham chiếu đúng món đó. */
    private Food food(String name, Category cat, String desc, String ingredients, long price,
                      int serving, int spicy, String tags, String allergens, String slug) {
        Food f = new Food();
        f.setName(name);
        f.setCategory(cat);
        f.setDescription(desc);
        f.setIngredients(ingredients);
        f.setPrice(BigDecimal.valueOf(price));
        f.setServingSize(serving);
        f.setSpicyLevel(spicy);
        f.setDietaryTags(tags);
        f.setAllergens(allergens);
        f.setImageUrl("/images/foods/" + slug + ".webp");
        return foodRepo.save(f);
    }

    /** Một dòng của đơn mẫu: món kèm số lượng. */
    private record Line(Food food, int qty) {}

    /** Khuyến mãi tự động: không có mã, áp theo phạm vi và thời gian. */
    private Promotion promo(String name, String desc, Promotion.DiscountType type, int value,
                            Promotion.Scope scope, LocalDateTime now) {
        Promotion p = new Promotion();
        p.setName(name);
        p.setDescription(desc);
        p.setDiscountType(type);
        p.setDiscountValue(BigDecimal.valueOf(value));
        p.setScope(scope);
        p.setStartsAt(now.minusDays(1));
        p.setEndsAt(now.plusMonths(6));
        p.setActive(true);
        return p;
    }

    /** Đơn mẫu ghi kèm giao dịch thanh toán đúng như đơn thật do khách đặt. */
    private void order(User user, Orders.Status status, String method, Orders.PaymentStatus paid,
                       String address, String note, LocalDateTime at, Line... lines) {
        Orders o = new Orders();
        o.setUser(user);
        o.setStatus(status);
        o.setPaymentMethod(method);
        o.setPaymentStatus(paid);
        o.setReceiverName(user.getFullName());
        o.setPhone(user.getPhone());
        o.setAddress(address);
        o.setNote(note);
        o.setCreatedAt(at);

        BigDecimal total = BigDecimal.ZERO;
        for (Line line : lines) {
            Food f = line.food();
            OrderItem oi = new OrderItem();
            oi.setOrder(o);
            oi.setFood(f);
            oi.setQuantity(line.qty());
            oi.setPrice(f.getPrice());
            o.getItems().add(oi);
            total = total.add(f.getPrice().multiply(BigDecimal.valueOf(line.qty())));
        }
        o.setTotal(total);
        Orders saved = orderRepo.save(o);

        PaymentTransaction tx = new PaymentTransaction();
        tx.setOrder(saved);
        tx.setMethod(method);
        tx.setAmount(total);
        tx.setStatus(paid == Orders.PaymentStatus.PAID
                ? PaymentTransaction.Status.PAID : PaymentTransaction.Status.PENDING);
        if (paid == Orders.PaymentStatus.PAID) tx.setPaidAt(at.plusMinutes(5));
        paymentTxRepo.save(tx);
    }

    private void review(User user, Food food, int rating, String comment) {
        Review r = new Review();
        r.setUser(user);
        r.setFood(food);
        r.setRating(rating);
        r.setComment(comment);
        reviewRepo.save(r);
    }

    private void setting(String key, String value) {
        AiSetting s = new AiSetting();
        s.setSettingKey(key);
        s.setSettingValue(value);
        settingRepo.save(s);
    }
}
