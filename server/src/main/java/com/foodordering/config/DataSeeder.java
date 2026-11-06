package com.foodordering.config;

import com.foodordering.entity.*;
import com.foodordering.repository.*;
import com.foodordering.service.AiClient;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
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
    private final NotificationRepository notificationRepo;
    private final CartItemRepository cartRepo;
    private final AiSettingRepository settingRepo;
    private final PasswordEncoder encoder;

    public DataSeeder(UserRepository userRepo, CategoryRepository categoryRepo, FoodRepository foodRepo,
                      PromotionRepository promotionRepo,
                      OrdersRepository orderRepo, PaymentTransactionRepository paymentTxRepo,
                      ReviewRepository reviewRepo, NotificationRepository notificationRepo,
                      CartItemRepository cartRepo, AiSettingRepository settingRepo,
                      PasswordEncoder encoder) {
        this.userRepo = userRepo;
        this.categoryRepo = categoryRepo;
        this.foodRepo = foodRepo;
        this.promotionRepo = promotionRepo;
        this.orderRepo = orderRepo;
        this.paymentTxRepo = paymentTxRepo;
        this.reviewRepo = reviewRepo;
        this.notificationRepo = notificationRepo;
        this.cartRepo = cartRepo;
        this.settingRepo = settingRepo;
        this.encoder = encoder;
    }

    // Seeder chỉ chạy khi database còn trống, nhờ vậy khởi động lại không nhân đôi dữ liệu demo.
    @Override
    public void run(String... args) {
        if (userRepo.count() > 0) return;

        // 2 admin và 8 khách với tên thật, email không dấu và mật khẩu bằng phần trước @.
        User nam = createUser("namnguyen@demo.com", "namnguyen", "Nguyễn Hoàng Nam", "0901000001",
                "Số 1 Hòa Bình, Ninh Kiều, Cần Thơ", User.Role.ADMIN);
        User huong = createUser("huongtran@demo.com", "huongtran", "Trần Thu Hương", "0901000002",
                "Số 2 Trần Hưng Đạo, Cái Răng, Cần Thơ", User.Role.ADMIN);

        User tuan = createUser("tuanpham@demo.com", "tuanpham", "Phạm Văn Tuấn", "0901000003",
                "12 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ", User.Role.CUSTOMER);
        User khang = createUser("khangnguyen@demo.com", "khangnguyen", "Nguyễn Minh Khang", "0901000004",
                "45 Mạc Cửu, Ninh Kiều, Cần Thơ", User.Role.CUSTOMER);
        User thao = createUser("thaotran@demo.com", "thaotran", "Trần Phương Thảo", "0901000005",
                "78 Trần Hưng Đạo, Cái Răng, Cần Thơ", User.Role.CUSTOMER);
        User linh = createUser("linhduong@demo.com", "linhduong", "Dương Ngọc Linh", "0901000006",
                "23 Hòa Bình, Bình Thủy, Cần Thơ", User.Role.CUSTOMER);
        User son = createUser("sonnguyen@demo.com", "sonnguyen", "Nguyễn Thanh Sơn", "0901000007",
                "56 Lý Tự Trọng, Ninh Kiều, Cần Thơ", User.Role.CUSTOMER);
        User trung = createUser("trungdang@demo.com", "trungdang", "Đặng Quốc Trung", "0901000008",
                "89 Võ Văn Tần, Ô Môn, Cần Thơ", User.Role.CUSTOMER);
        User duc = createUser("duchoang@demo.com", "duchoang", "Hoàng Minh Đức", "0901000009",
                "34 Nguyễn Trãi, Thốt Nốt, Cần Thơ", User.Role.CUSTOMER);
        User tung = createUser("tunghoang@demo.com", "tunghoang", "Hoàng Thanh Tùng", "0901000010",
                "67 Trần Hưng Đạo, Ninh Kiều, Cần Thơ", User.Role.CUSTOMER);

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
        Food comGa = food("Cơm gà xối mỡ", viet, "Cơm gà chiên giòn", "cơm, gà, dưa leo",
                55000, 1, 0, "", "", "com-ga-xoi-mo");
        Food bunBoHue = food("Bún bò Huế", viet, "Bún bò cay đặc trưng miền Trung",
                "bún, thịt bò, giò heo, sả, ớt", 70000, 1, 3, "", "gluten", "bun-bo-hue");
        Food goiCuon = food("Gỏi cuốn tôm thịt", viet, "Gỏi cuốn tươi mát chấm tương đậu phộng",
                "bánh tráng, tôm, thịt heo, bún, rau", 45000, 2, 0, "", "hải sản,đậu phộng", "goi-cuon");
        Food canhChua = food("Canh chua cá lóc", viet, "Canh chua miền Tây với cá lóc, thơm, cà chua",
                "cá lóc, thơm, cà chua, đậu bắp", 90000, 3, 1, "ít dầu mỡ", "hải sản", "canh-chua-ca-loc");
        Food rau = food("Rau muống xào tỏi", chay, "Rau muống xào tỏi giòn xanh",
                "rau muống, tỏi", 35000, 2, 0, "chay,ít dầu mỡ", "", "rau-muong-xao-toi");
        Food dauHu = food("Đậu hũ sốt cà chua", chay, "Đậu hũ non sốt cà chua thanh đạm",
                "đậu hũ, cà chua, hành", 40000, 2, 0, "chay", "đậu nành", "dau-hu-sot-ca-chua");
        Food lauThai = food("Lẩu thái hải sản", viet, "Lẩu chua cay với tôm, mực, nghêu",
                "tôm, mực, nghêu, sả, ớt, nấm", 250000, 4, 3, "", "hải sản", "lau-thai-hai-san");
        lauThai.setAvailable(false);
        foodRepo.save(lauThai);
        Food boLucLac = food("Bò lúc lắc", viet, "Bò lúc lắc khoai tây chiên",
                "thịt bò, khoai tây, hành tây", 120000, 2, 0, "", "", "bo-luc-lac");
        Food myY = food("Mỳ Ý sốt bò bằm", au, "Spaghetti sốt cà chua thịt bò bằm",
                "mỳ Ý, thịt bò, cà chua", 85000, 1, 0, "", "gluten", "my-y-bo-bam");
        Food saladCaesar = food("Salad Caesar", au, "Salad rau xà lách, gà nướng, phô mai",
                "xà lách, gà, phô mai, sốt caesar", 75000, 1, 0, "ít dầu mỡ", "sữa,trứng", "salad-caesar");
        saladCaesar.setAvailable(false);
        foodRepo.save(saladCaesar);
        Food traDao = food("Trà đào cam sả", uong, "Trà đào thanh mát", "trà, đào, cam, sả",
                40000, 1, 0, "chay", "", "tra-dao-cam-sa");
        Food nuocCam = food("Nước cam ép", uong, "Cam vắt nguyên chất", "cam",
                35000, 1, 0, "chay,ít dầu mỡ", "", "nuoc-cam-ep");
        Food caPhe = food("Cà phê sữa đá", uong, "Cà phê phin truyền thống", "cà phê, sữa đặc",
                30000, 1, 0, "", "sữa", "ca-phe-sua-da");
        Food cheKhucBach = food("Chè khúc bạch", trangMieng, "Chè khúc bạch hạnh nhân",
                "sữa, hạnh nhân, vải", 45000, 1, 0, "chay", "sữa,hạt", "che-khuc-bach");

        // 16 món mới để thực đơn đủ 32 món, giá hợp lý theo khu vực Cần Thơ.
        Food comTam = food("Cơm tấm sườn nướng", viet, "Cơm tấm hạt, sườn nướng mật ong",
                "cơm tấm, sườn heo, đồ chua, trứng ốp", 55000, 1, 0, "", "trứng", "com-tam-suon");
        Food huTieu = food("Hủ tiếu Nam Vang", viet, "Hủ tiếu dai, nước lèo ngọt thanh",
                "bánh hủ tiếu, tôm, thịt heo, trứng cút", 65000, 1, 0, "", "hải sản", "hu-tieu-nam-vang");
        Food banhXeo = food("Bánh xèo miền Tây", viet, "Bánh xèo giòn, nhân tôm giá",
                "bột gạo, tôm, giá, thịt heo", 50000, 2, 0, "", "hải sản", "banh-xeo");
        banhXeo.setAvailable(false);
        foodRepo.save(banhXeo);
        Food miQuang = food("Mì Quảng gà", viet, "Mì vàng nghệ, nước dùng gà ngọt",
                "mì, gà, trứng, rau sống", 55000, 1, 1, "", "trứng", "mi-quang-ga");
        Food pizza = food("Pizza phô mai", au, "Đế mỏng, phô mai mozzarella kéo sợi",
                "bột mì, sốt cà chua, phô mai mozzarella", 95000, 2, 0, "", "gluten,sữa", "pizza-pho-mai");
        Food burger = food("Burger bò phô mai", au, "Bánh mì burger, bò nướng, phô mai cheddar",
                "bánh mì, thịt bò, phô mai, xà lách, trứng", 85000, 1, 1, "", "gluten,sữa,trứng", "burger-bo");
        Food myYKem = food("Mỳ Ý sốt kem nấm", au, "Sốt kem béo, nấm đều miếng",
                "mỳ Ý, kem tươi, nấm, thịt gà", 89000, 1, 0, "", "gluten,sữa", "my-y-sot-kem-nam");
        Food saladGa = food("Salad gà nướng", au, "Gà nướng sả, rau trộn giòn",
                "xà lách, gà nướng, cà chua bi, trứng", 70000, 1, 0, "ít dầu mỡ", "trứng", "salad-ga-nuong");
        Food traSua = food("Trà sữa trân châu đường đen", uong, "Trà sữa béo, trân châu giòn",
                "trà đen, sữa tươi, trân châu đường đen", 45000, 1, 0, "chay", "sữa", "tra-sua-tran-chau");
        Food sinhToBo = food("Sinh tố bơ", uong, "Bơ xay sữa, dẻo béo",
                "bơ, sữa tươi, sữa đặc", 40000, 1, 0, "chay", "sữa", "sinh-to-bo");
        Food traChanh = food("Trà chanh giã tay", uong, "Trà chanh chua ngọt, giã tay",
                "trà, chanh, đường, đá bào", 25000, 1, 0, "chay,ít dầu mỡ", "", "tra-chanh-gia-tay");
        Food nuocMia = food("Nước mía lau", uong, "Mía nguyên chất ép tươi",
                "mía, quất, tắc", 20000, 1, 0, "chay,ít dầu mỡ", "", "nuoc-mia");
        Food banhFlan = food("Bánh flan caramel", trangMieng, "Flan mềm, caramel óng ánh",
                "trứng, sữa tươi, sữa đặc, caramel", 25000, 1, 0, "chay", "sữa,trứng", "banh-flan");
        Food rauCau = food("Rau câu dừa", trangMieng, "Rau câu trong, vị dừa thơm",
                "dừa, đường, rau câu", 30000, 2, 0, "chay", "", "rau-cau-dua");
        rauCau.setAvailable(false);
        foodRepo.save(rauCau);
        Food namXao = food("Nấm xào sả ớt", chay, "Nấm đùi gà xào sả ớt thơm",
                "nấm đùi gà, sả, ớt, hành lá", 45000, 2, 2, "chay", "", "nam-xao-sa");
        Food bunChaChay = food("Bún chả chay", chay, "Chả chay từ đậu hũ, nước chấm chua ngọt",
                "bún, đậu hũ, nấm mèo, nước mắm chay", 55000, 1, 0, "chay", "gluten,đậu nành", "bun-cha-chay");

        // ----- Khuyến mãi mẫu (chỉ khuyến mãi tự động, không cần mã) -----
        LocalDateTime now = LocalDateTime.now();
        Promotion weekend = promo("Cuối tuần mát lạnh", "Giảm 20% đồ uống thứ Bảy và Chủ Nhật",
                Promotion.DiscountType.PERCENT, 20, Promotion.Scope.CATEGORY, now);
        weekend.setDaysOfWeek("SAT,SUN");
        weekend.setTargetIds(List.of(uong.getId()));
        promotionRepo.save(weekend);

        Promotion daily = promo("Món may mắn hôm nay", "Ba món ngẫu nhiên giảm 15% mỗi ngày",
                Promotion.DiscountType.PERCENT, 15, Promotion.Scope.FOOD, now);
        daily.setTargetIds(List.of(pho.getId(), traSua.getId(), comTam.getId()));
        promotionRepo.save(daily);

        // Giảm 10k cho đơn từ 100k, nhưng chỉ áp dụng cho 3 món cụ thể.
        Promotion giam10k = promo("Giảm 10k cho đơn từ 100k", "Giảm 10.000đ cho đơn từ 100.000đ",
                Promotion.DiscountType.FIXED, 10000, Promotion.Scope.FOOD, now);
        giam10k.setTargetIds(List.of(boLucLac.getId(), pizza.getId(), burger.getId()));
        giam10k.setMinOrderTotal(BigDecimal.valueOf(100000));
        promotionRepo.save(giam10k);

        // Ưu đãi buổi trưa cho danh mục Đồ uống, có khung giờ cố định.
        Promotion trua = promo("Ưu đãi buổi trưa", "Giảm 10% đồ uống khung 11h đến 13h",
                Promotion.DiscountType.PERCENT, 10, Promotion.Scope.CATEGORY, now);
        trua.setTargetIds(List.of(uong.getId()));
        trua.setStartTime(LocalTime.of(11, 0));
        trua.setEndTime(LocalTime.of(13, 0));
        promotionRepo.save(trua);

        // 15 đơn rải trên 8 khách để đủ 5 trạng thái cho màn hình quản trị.
        Orders o1 = order(tuan, Orders.Status.COMPLETED, "QR", Orders.PaymentStatus.PAID,
                tuan.getAddress(), null, LocalDateTime.now().minusDays(12), new Line(pho, 2), new Line(bunCha, 1));
        Orders o2 = order(tuan, Orders.Status.COMPLETED, "COD", Orders.PaymentStatus.PAID,
                tuan.getAddress(), null, LocalDateTime.now().minusDays(5), new Line(bunBoHue, 1), new Line(dauHu, 1));
        Orders o3 = order(khang, Orders.Status.COMPLETED, "QR", Orders.PaymentStatus.PAID,
                khang.getAddress(), null, LocalDateTime.now().minusDays(3), new Line(myY, 2), new Line(traDao, 1));
        Orders o4 = order(thao, Orders.Status.COMPLETED, "COD", Orders.PaymentStatus.PAID,
                thao.getAddress(), null, LocalDateTime.now().minusDays(8), new Line(comGa, 1), new Line(goiCuon, 1), new Line(nuocCam, 1));
        Orders o5 = order(linh, Orders.Status.COMPLETED, "QR", Orders.PaymentStatus.PAID,
                linh.getAddress(), null, LocalDateTime.now().minusDays(2), new Line(comTam, 1), new Line(huTieu, 1));
        Orders o6 = order(tuan, Orders.Status.PREPARING, "COD", Orders.PaymentStatus.UNPAID,
                tuan.getAddress(), "Ít cay, gọi trước 10 phút", LocalDateTime.now().minusHours(3),
                new Line(bunBoHue, 1), new Line(dauHu, 2));
        Orders o7 = order(khang, Orders.Status.PREPARING, "QR", Orders.PaymentStatus.UNPAID,
                khang.getAddress(), null, LocalDateTime.now().minusHours(5),
                new Line(pizza, 1), new Line(traSua, 1));
        Orders o8 = order(thao, Orders.Status.PENDING, "QR", Orders.PaymentStatus.UNPAID,
                thao.getAddress(), null, LocalDateTime.now().minusMinutes(30),
                new Line(rau, 1), new Line(myY, 1));
        Orders o9 = order(linh, Orders.Status.PENDING, "COD", Orders.PaymentStatus.UNPAID,
                linh.getAddress(), "Ít đường", LocalDateTime.now().minusMinutes(15),
                new Line(banhFlan, 2), new Line(traChanh, 1));
        Orders o10 = order(son, Orders.Status.CONFIRMED, "COD", Orders.PaymentStatus.UNPAID,
                son.getAddress(), null, LocalDateTime.now().minusHours(8),
                new Line(lauThai, 1), new Line(goiCuon, 1));
        Orders o11 = order(trung, Orders.Status.CONFIRMED, "QR", Orders.PaymentStatus.PAID,
                trung.getAddress(), null, LocalDateTime.now().minusHours(10),
                new Line(boLucLac, 1), new Line(sinhToBo, 1));
        Orders o12 = order(duc, Orders.Status.PENDING, "COD", Orders.PaymentStatus.UNPAID,
                duc.getAddress(), null, LocalDateTime.now().minusHours(1),
                new Line(bunChaChay, 1), new Line(namXao, 1));
        Orders o13 = order(tung, Orders.Status.CANCELLED, "COD", Orders.PaymentStatus.UNPAID,
                tung.getAddress(), "Khách đổi ý", LocalDateTime.now().minusDays(1),
                new Line(canhChua, 1), new Line(comGa, 1));
        Orders o14 = order(linh, Orders.Status.COMPLETED, "QR", Orders.PaymentStatus.PAID,
                linh.getAddress(), null, LocalDateTime.now().minusDays(9),
                new Line(saladCaesar, 1), new Line(saladGa, 1), new Line(caPhe, 1));
        Orders o15 = order(son, Orders.Status.PENDING, "QR", Orders.PaymentStatus.UNPAID,
                son.getAddress(), null, LocalDateTime.now().minusMinutes(10),
                new Line(burger, 1), new Line(nuocCam, 1));

        // Đánh giá chỉ từ món trong đơn đã hoàn thành, đúng ràng buộc ở ReviewService.
        review(tuan, pho, 5, "Nước dùng ngon, đậm đà.");
        review(tuan, bunCha, 4, "Nướng than rất thơm, chấm nước mắm vừa ăn.");
        review(tuan, bunBoHue, 5, "Vị cay đậm, sợi bún ngon.");
        review(tuan, dauHu, 4, "Sốt cà chua vừa miệng.");
        review(khang, myY, 4, "Sốt bò bằm ngon, sợi mỳ dai.");
        review(khang, traDao, 5, "Trà đào thanh mát, không quá ngọt.");
        review(thao, comGa, 4, "Gà chiên giòn, cơm dẻo.");
        review(thao, goiCuon, 5, "Cuốn tươi, chấm đậu phộng ngon.");
        review(linh, comTam, 5, "Sườn nướng thơm, đồ chua giòn.");
        review(linh, huTieu, 4, "Nước lèo ngọt thanh.");
        review(linh, saladCaesar, 3, "Hơi mặn, nên giảm sốt.");
        review(linh, saladGa, 5, "Gà nướng mềm, rau tươi.");

        notify(tuan, o1, "Đơn hàng của bạn đã được giao. Cảm ơn bạn đã ủng hộ!", true, LocalDateTime.now().minusDays(12));
        notify(tuan, o6, "Đơn hàng của bạn đang được vận chuyển.", false, LocalDateTime.now().minusHours(3));
        notify(khang, o7, "Đơn hàng của bạn đang được vận chuyển.", false, LocalDateTime.now().minusHours(5));
        notify(thao, o8, "Quán đã nhận đơn của bạn, đang chờ xác nhận.", true, LocalDateTime.now().minusMinutes(30));
        notify(trung, o11, "Đơn hàng của bạn đã được xác nhận.", false, LocalDateTime.now().minusHours(10));

        cart(tuan, pho, 1);
        cart(tuan, traDao, 1);
        cart(linh, pizza, 1);
        cart(linh, banhFlan, 1);

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
    private Orders order(User user, Orders.Status status, String method, Orders.PaymentStatus paid,
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
        return saved;
    }

    private void review(User user, Food food, int rating, String comment) {
        Review r = new Review();
        r.setUser(user);
        r.setFood(food);
        r.setRating(rating);
        r.setComment(comment);
        reviewRepo.save(r);
    }

    private void notify(User user, Orders order, String content, boolean read, LocalDateTime at) {
        Notification n = new Notification();
        n.setUser(user);
        n.setOrderId(order.getId());
        n.setContent(content);
        n.setRead(read);
        n.setCreatedAt(at);
        notificationRepo.save(n);
    }

    private void cart(User user, Food food, int qty) {
        CartItem c = new CartItem();
        c.setUser(user);
        c.setFood(food);
        c.setQuantity(qty);
        cartRepo.save(c);
    }

    private void setting(String key, String value) {
        AiSetting s = new AiSetting();
        s.setSettingKey(key);
        s.setSettingValue(value);
        settingRepo.save(s);
    }
}
