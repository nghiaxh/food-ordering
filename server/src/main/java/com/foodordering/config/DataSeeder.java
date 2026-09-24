package com.foodordering.config;

import com.foodordering.entity.*;
import com.foodordering.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class DataSeeder implements CommandLineRunner {
    private final UserRepository userRepo;
    private final CategoryRepository categoryRepo;
    private final FoodRepository foodRepo;
    private final AiSettingRepository settingRepo;
    private final PasswordEncoder encoder;

    public DataSeeder(UserRepository userRepo, CategoryRepository categoryRepo, FoodRepository foodRepo,
                      AiSettingRepository settingRepo, PasswordEncoder encoder) {
        this.userRepo = userRepo;
        this.categoryRepo = categoryRepo;
        this.foodRepo = foodRepo;
        this.settingRepo = settingRepo;
        this.encoder = encoder;
    }

    @Override
    public void run(String... args) {
        if (userRepo.count() > 0) return;

        createUser("admin@demo.com", "admin123", "Quản trị viên", User.Role.ADMIN);
        createUser("user@demo.com", "user123", "Khách hàng Demo", User.Role.CUSTOMER);

        Category viet = cat("Món Việt", "mon-viet", "/images/categories/mon-viet.jpg");
        Category au = cat("Món Âu", "mon-au", "/images/categories/mon-au.jpg");
        Category uong = cat("Đồ uống", "do-uong", "/images/categories/do-uong.jpg");
        Category trangMieng = cat("Tráng miệng", "trang-mieng", "/images/categories/trang-mieng.jpg");
        Category chay = cat("Món chay", "mon-chay", "/images/categories/mon-chay.jpg");

        food("Phở bò", viet, "Phở bò truyền thống, nước dùng hầm xương 12 giờ", "bánh phở, thịt bò, hành, quế, hồi",
                65000, 1, 0, "", "gluten", "pho-bo");
        food("Bún chả Hà Nội", viet, "Bún chả nướng than hoa ăn kèm nước mắm chua ngọt", "bún, thịt heo, nước mắm, rau sống",
                60000, 1, 0, "", "", "bun-cha");
        food("Cơm gà xối mỡ", viet, "Cơm gà chiên giòn ăn kèm dưa leo", "cơm, gà, dưa leo",
                55000, 1, 0, "", "", "com-ga-xoi-mo");
        food("Bún bò Huế", viet, "Bún bò cay đặc trưng miền Trung", "bún, thịt bò, giò heo, sả, ớt",
                70000, 1, 3, "", "gluten", "bun-bo-hue");
        food("Gỏi cuốn tôm thịt", viet, "Gỏi cuốn tươi mát chấm tương đậu phộng", "bánh tráng, tôm, thịt heo, bún, rau",
                45000, 2, 0, "", "hải sản,đậu phộng", "goi-cuon");
        food("Canh chua cá lóc", viet, "Canh chua miền Tây với cá lóc, thơm, cà chua", "cá lóc, thơm, cà chua, đậu bắp",
                90000, 3, 1, "ít dầu mỡ", "hải sản", "canh-chua-ca-loc");
        food("Rau muống xào tỏi", chay, "Rau muống xào tỏi giòn xanh", "rau muống, tỏi",
                35000, 2, 0, "chay,ít dầu mỡ", "", "rau-muong-xao-toi");
        food("Đậu hũ sốt cà chua", chay, "Đậu hũ non sốt cà chua thanh đạm", "đậu hũ, cà chua, hành",
                40000, 2, 0, "chay", "đậu nành", "dau-hu-sot-ca-chua");
        food("Lẩu thái hải sản", viet, "Lẩu chua cay với tôm, mực, nghêu", "tôm, mực, nghêu, sả, ớt, nấm",
                250000, 4, 3, "", "hải sản", "lau-thai-hai-san");
        food("Bò lúc lắc", viet, "Bò lúc lắc khoai tây chiên", "thịt bò, khoai tây, hành tây",
                120000, 2, 0, "", "", "bo-luc-lac");
        food("Mỳ Ý sốt bò bằm", au, "Spaghetti sốt cà chua thịt bò bằm", "mỳ Ý, thịt bò, cà chua",
                85000, 1, 0, "", "gluten", "my-y-bo-bam");
        food("Salad Caesar", au, "Salad rau xà lách, gà nướng, phô mai", "xà lách, gà, phô mai, sốt caesar",
                75000, 1, 0, "ít dầu mỡ", "sữa,trứng", "salad-caesar");
        food("Trà đào cam sả", uong, "Trà đào thanh mát", "trà, đào, cam, sả",
                40000, 1, 0, "chay", "", "tra-dao-cam-sa");
        food("Nước cam ép", uong, "Cam vắt nguyên chất", "cam",
                35000, 1, 0, "chay,ít dầu mỡ", "", "nuoc-cam-ep");
        food("Cà phê sữa đá", uong, "Cà phê phin truyền thống", "cà phê, sữa đặc",
                30000, 1, 0, "", "sữa", "ca-phe-sua-da");
        food("Chè khúc bạch", trangMieng, "Chè khúc bạch hạnh nhân", "sữa, hạnh nhân, vải",
                45000, 1, 0, "chay", "sữa,hạt", "che-khuc-bach");

        AiSetting max = new AiSetting();
        max.setSettingKey("max_suggestions");
        max.setSettingValue("5");
        settingRepo.save(max);
    }

    private void createUser(String email, String pass, String name, User.Role role) {
        User u = new User();
        u.setEmail(email);
        u.setPassword(encoder.encode(pass));
        u.setFullName(name);
        u.setRole(role);
        userRepo.save(u);
    }

    private Category cat(String name, String slug, String image) {
        Category c = new Category();
        c.setName(name);
        c.setSlug(slug);
        c.setImageUrl(image);
        return categoryRepo.save(c);
    }

    private void food(String name, Category cat, String desc, String ingredients, long price,
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
        f.setImageUrl("/images/foods/" + slug + ".jpg");
        foodRepo.save(f);
    }
}