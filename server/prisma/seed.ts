// Seed dữ liệu demo. Chỉ chạy khi bảng users còn trống để tránh nhân đôi dữ liệu;
// muốn nạp lại thì xoá volume db_data rồi chạy lại compose.
import { PrismaPg } from "@prisma/adapter-pg";
import {
  Prisma,
  PrismaClient,
  Role,
  OrderStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  DiscountType,
  PromotionScope,
} from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/lib/password.js";
import { env } from "../src/config/env.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);
const hoursAgo = (n: number) => new Date(Date.now() - n * 3600 * 1000);
const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000);

type UserRef = { id: number; fullName: string | null; phone: string | null; address: string | null };
type FoodRef = { id: number; price: Prisma.Decimal };

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log("Đã có dữ liệu, bỏ qua seed.");
    return;
  }

  // Toàn bộ seed nằm trong một transaction: lỗi giữa chừng không để lại DB nửa vời,
  // lần chạy sau vẫn đủ điều kiện seed lại từ đầu.
  await prisma.$transaction(async (tx) => {
    // Mật khẩu được băm trước vì không lưu plain text, kể cả với tài khoản demo.
    const createUser = async (email: string, password: string, fullName: string, phone: string, address: string, role: Role) =>
      tx.user.create({
        data: { email, password: await hashPassword(password), fullName, phone, address, role },
      });
    // Literal array để Promise.all suy ra tuple; gộp seed user tránh 10 bước lặp tay.
    const [, , tuan, khang, thao, linh, son, trung, duc, tung] = await Promise.all([
      createUser("namnguyen@demo.com", "namnguyen", "Nguyễn Hoàng Nam", "0901000001", "Số 1 Hòa Bình, Ninh Kiều, Cần Thơ", Role.ADMIN),
      createUser("huongtran@demo.com", "huongtran", "Trần Thu Hương", "0901000002", "Số 2 Trần Hưng Đạo, Cái Răng, Cần Thơ", Role.ADMIN),
      createUser("tuanpham@demo.com", "tuanpham", "Phạm Văn Tuấn", "0901000003", "12 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ", Role.CUSTOMER),
      createUser("khangnguyen@demo.com", "khangnguyen", "Nguyễn Minh Khang", "0901000004", "45 Mạc Cửu, Ninh Kiều, Cần Thơ", Role.CUSTOMER),
      createUser("thaotran@demo.com", "thaotran", "Trần Phương Thảo", "0901000005", "78 Trần Hưng Đạo, Cái Răng, Cần Thơ", Role.CUSTOMER),
      createUser("linhduong@demo.com", "linhduong", "Dương Ngọc Linh", "0901000006", "23 Hòa Bình, Bình Thủy, Cần Thơ", Role.CUSTOMER),
      createUser("sonnguyen@demo.com", "sonnguyen", "Nguyễn Thanh Sơn", "0901000007", "56 Lý Tự Trọng, Ninh Kiều, Cần Thơ", Role.CUSTOMER),
      createUser("trungdang@demo.com", "trungdang", "Đặng Quốc Trung", "0901000008", "89 Võ Văn Tần, Ô Môn, Cần Thơ", Role.CUSTOMER),
      createUser("duchoang@demo.com", "duchoang", "Hoàng Minh Đức", "0901000009", "34 Nguyễn Trãi, Thốt Nốt, Cần Thơ", Role.CUSTOMER),
      createUser("tunghoang@demo.com", "tunghoang", "Hoàng Thanh Tùng", "0901000010", "67 Trần Hưng Đạo, Ninh Kiều, Cần Thơ", Role.CUSTOMER),
    ]);

    const viet = await tx.category.create({ data: {
      name: "Món Việt", slug: "mon-viet", imageUrl: "/images/categories/mon-viet.webp",
      description: "Cơm, phở, bún, mì và các món Việt truyền thống" } });
    const au = await tx.category.create({ data: {
      name: "Món Âu", slug: "mon-au", imageUrl: "/images/categories/mon-au.webp",
      description: "Món Ý, phương Tây với thịt và rau củ" } });
    const uong = await tx.category.create({ data: {
      name: "Đồ uống", slug: "do-uong", imageUrl: "/images/categories/do-uong.webp",
      description: "Nước ngọt, trà trái cây và cà phê" } });
    const trangMieng = await tx.category.create({ data: {
      name: "Tráng miệng", slug: "trang-mieng", imageUrl: "/images/categories/trang-mieng.webp",
      description: "Chè và món ngọt sau bữa ăn" } });
    const chay = await tx.category.create({ data: {
      name: "Món chay", slug: "mon-chay", imageUrl: "/images/categories/mon-chay.webp",
      description: "Món không dùng thịt, phục vụ người ăn chay" } });

    const createFood = (name: string, cat: { id: number }, description: string, ingredients: string,
                        price: number, servingSize: number, spicyLevel: number, dietaryTags: string,
                        allergens: string, slug: string, available = true) =>
      tx.food.create({ data: {
        name, categoryId: cat.id, description, ingredients, price, servingSize, spicyLevel,
        dietaryTags, allergens, available, imageUrl: `/images/foods/${slug}.webp` } });

    const pho = await createFood("Phở bò", viet, "Phở bò truyền thống, nước dùng hầm xương 12 giờ",
      "bánh phở, thịt bò, hành, quế, hồi", 65000, 1, 0, "", "gluten", "pho-bo");
    const bunCha = await createFood("Bún chả Hà Nội", viet, "Bún chả nướng than hoa ăn kèm nước mắm chua ngọt",
      "bún, thịt heo, nước mắm, rau sống", 60000, 1, 0, "", "", "bun-cha");
    const comGa = await createFood("Cơm gà xối mỡ", viet, "Cơm gà chiên giòn", "cơm, gà, dưa leo",
      55000, 1, 0, "", "", "com-ga-xoi-mo");
    const bunBoHue = await createFood("Bún bò Huế", viet, "Bún bò cay đặc trưng miền Trung",
      "bún, thịt bò, giò heo, sả, ớt", 70000, 1, 3, "", "gluten", "bun-bo-hue");
    const goiCuon = await createFood("Gỏi cuốn tôm thịt", viet, "Gỏi cuốn tươi mát chấm tương đậu phộng",
      "bánh tráng, tôm, thịt heo, bún, rau", 45000, 2, 0, "", "hải sản,đậu phộng", "goi-cuon");
    const canhChua = await createFood("Canh chua cá lóc", viet, "Canh chua miền Tây với cá lóc, thơm, cà chua",
      "cá lóc, thơm, cà chua, đậu bắp", 90000, 3, 1, "ít dầu mỡ", "hải sản", "canh-chua-ca-loc");
    const rau = await createFood("Rau muống xào tỏi", chay, "Rau muống xào tỏi giòn xanh",
      "rau muống, tỏi", 35000, 2, 0, "chay,ít dầu mỡ", "", "rau-muong-xao-toi");
    const dauHu = await createFood("Đậu hũ sốt cà chua", chay, "Đậu hũ non sốt cà chua thanh đạm",
      "đậu hũ, cà chua, hành", 40000, 2, 0, "chay", "đậu nành", "dau-hu-sot-ca-chua");
    const lauThai = await createFood("Lẩu thái hải sản", viet, "Lẩu chua cay với tôm, mực, nghêu",
      "tôm, mực, nghêu, sả, ớt, nấm", 250000, 4, 3, "", "hải sản", "lau-thai-hai-san", false);
    const boLucLac = await createFood("Bò lúc lắc", viet, "Bò lúc lắc khoai tây chiên",
      "thịt bò, khoai tây, hành tây", 120000, 2, 0, "", "", "bo-luc-lac");
    const myY = await createFood("Mỳ Ý sốt bò bằm", au, "Spaghetti sốt cà chua thịt bò bằm",
      "mỳ Ý, thịt bò, cà chua", 85000, 1, 0, "", "gluten", "my-y-bo-bam");
    const saladCaesar = await createFood("Salad Caesar", au, "Salad rau xà lách, gà nướng, phô mai",
      "xà lách, gà, phô mai, sốt caesar", 75000, 1, 0, "ít dầu mỡ", "sữa,trứng", "salad-caesar", false);
    const traDao = await createFood("Trà đào cam sả", uong, "Trà đào thanh mát", "trà, đào, cam, sả",
      40000, 1, 0, "chay", "", "tra-dao-cam-sa");
    const nuocCam = await createFood("Nước cam ép", uong, "Cam vắt nguyên chất", "cam",
      35000, 1, 0, "chay,ít dầu mỡ", "", "nuoc-cam-ep");
    const caPhe = await createFood("Cà phê sữa đá", uong, "Cà phê phin truyền thống", "cà phê, sữa đặc",
      30000, 1, 0, "", "sữa", "ca-phe-sua-da");
    await createFood("Chè khúc bạch", trangMieng, "Chè khúc bạch hạnh nhân",
      "sữa, hạnh nhân, vải", 45000, 1, 0, "chay", "sữa,hạt", "che-khuc-bach");

    const comTam = await createFood("Cơm tấm sườn nướng", viet, "Cơm tấm hạt, sườn nướng mật ong",
      "cơm tấm, sườn heo, đồ chua, trứng ốp", 55000, 1, 0, "", "trứng", "com-tam-suon");
    const huTieu = await createFood("Hủ tiếu Nam Vang", viet, "Hủ tiếu dai, nước lèo ngọt thanh",
      "bánh hủ tiếu, tôm, thịt heo, trứng cút", 65000, 1, 0, "", "hải sản", "hu-tieu-nam-vang");
    await createFood("Bánh xèo miền Tây", viet, "Bánh xèo giòn, nhân tôm giá",
      "bột gạo, tôm, giá, thịt heo", 50000, 2, 0, "", "hải sản", "banh-xeo", false);
    await createFood("Mì Quảng gà", viet, "Mì vàng nghệ, nước dùng gà ngọt",
      "mì, gà, trứng, rau sống", 55000, 1, 1, "", "trứng", "mi-quang-ga");
    const pizza = await createFood("Pizza phô mai", au, "Đế mỏng, phô mai mozzarella kéo sợi",
      "bột mì, sốt cà chua, phô mai mozzarella", 95000, 2, 0, "", "gluten,sữa", "pizza-pho-mai");
    const burger = await createFood("Burger bò phô mai", au, "Bánh mì burger, bò nướng, phô mai cheddar",
      "bánh mì, thịt bò, phô mai, xà lách, trứng", 85000, 1, 1, "", "gluten,sữa,trứng", "burger-bo");
    await createFood("Mỳ Ý sốt kem nấm", au, "Sốt kem béo, nấm đều miếng",
      "mỳ Ý, kem tươi, nấm, thịt gà", 89000, 1, 0, "", "gluten,sữa", "my-y-sot-kem-nam");
    const saladGa = await createFood("Salad gà nướng", au, "Gà nướng sả, rau trộn giòn",
      "xà lách, gà nướng, cà chua bi, trứng", 70000, 1, 0, "ít dầu mỡ", "trứng", "salad-ga-nuong");
    const traSua = await createFood("Trà sữa trân châu đường đen", uong, "Trà sữa béo, trân châu giòn",
      "trà đen, sữa tươi, trân châu đường đen", 45000, 1, 0, "chay", "sữa", "tra-sua-tran-chau");
    const sinhToBo = await createFood("Sinh tố bơ", uong, "Bơ xay sữa, dẻo béo",
      "bơ, sữa tươi, sữa đặc", 40000, 1, 0, "chay", "sữa", "sinh-to-bo");
    const traChanh = await createFood("Trà chanh giã tay", uong, "Trà chanh chua ngọt, giã tay",
      "trà, chanh, đường, đá bào", 25000, 1, 0, "chay,ít dầu mỡ", "", "tra-chanh-gia-tay");
    await createFood("Nước mía lau", uong, "Mía nguyên chất ép tươi",
      "mía, quất, tắc", 20000, 1, 0, "chay,ít dầu mỡ", "", "nuoc-mia");
    const banhFlan = await createFood("Bánh flan caramel", trangMieng, "Flan mềm, caramel óng ánh",
      "trứng, sữa tươi, sữa đặc, caramel", 25000, 1, 0, "chay", "sữa,trứng", "banh-flan");
    await createFood("Rau câu dừa", trangMieng, "Rau câu trong, vị dừa thơm",
      "dừa, đường, rau câu", 30000, 2, 0, "chay", "", "rau-cau-dua", false);
    const namXao = await createFood("Nấm xào sả ớt", chay, "Nấm đùi gà xào sả ớt thơm",
      "nấm đùi gà, sả, ớt, hành lá", 45000, 2, 2, "chay", "", "nam-xao-sa");
    const bunChaChay = await createFood("Bún chả chay", chay, "Chả chay từ đậu hũ, nước chấm chua ngọt",
      "bún, đậu hũ, nấm mèo, nước mắm chay", 55000, 1, 0, "chay", "gluten,đậu nành", "bun-cha-chay");

    // ----- Khuyến mãi tự động (không có mã, áp theo phạm vi và thời gian) -----
    const promoStart = daysAgo(1);
    const promoEnd = new Date(Date.now() + 183 * 24 * 3600 * 1000);
    await tx.promotion.create({ data: {
      name: "Cuối tuần mát lạnh", description: "Giảm 20% đồ uống thứ Bảy và Chủ Nhật",
      discountType: DiscountType.PERCENT, discountValue: 20, scope: PromotionScope.CATEGORY,
      targetIds: [uong.id], daysOfWeek: "SAT,SUN", startsAt: promoStart, endsAt: promoEnd, active: true } });
    await tx.promotion.create({ data: {
      name: "Món may mắn hôm nay", description: "Ba món ngẫu nhiên giảm 15% mỗi ngày",
      discountType: DiscountType.PERCENT, discountValue: 15, scope: PromotionScope.FOOD,
      targetIds: [pho.id, traSua.id, comTam.id], startsAt: promoStart, endsAt: promoEnd, active: true } });
    await tx.promotion.create({ data: {
      name: "Giảm 10k cho đơn từ 100k", description: "Giảm 10.000đ cho đơn từ 100.000đ",
      discountType: DiscountType.FIXED, discountValue: 10000, scope: PromotionScope.FOOD,
      targetIds: [boLucLac.id, pizza.id, burger.id], minOrderTotal: 100000,
      startsAt: promoStart, endsAt: promoEnd, active: true } });
    await tx.promotion.create({ data: {
      name: "Ưu đãi buổi trưa", description: "Giảm 10% đồ uống khung 11h đến 13h",
      discountType: DiscountType.PERCENT, discountValue: 10, scope: PromotionScope.CATEGORY,
      targetIds: [uong.id], startTime: "11:00", endTime: "13:00",
      startsAt: promoStart, endsAt: promoEnd, active: true } });

    // 15 đơn rải trên 8 khách để đủ 5 trạng thái cho màn hình quản trị.
    type Line = { food: FoodRef; qty: number };
    const L = (food: FoodRef, qty: number): Line => ({ food, qty });
    const createOrder = async (user: UserRef, status: OrderStatus, paymentMethod: string,
                               paymentStatus: PaymentStatus, address: string | null, note: string | null,
                               createdAt: Date, lines: Line[]) => {
      let total = 0;
      for (const line of lines) total += Number(line.food.price) * line.qty;
      const order = await tx.order.create({ data: {
        userId: user.id, status, paymentMethod, paymentStatus, total, discountTotal: 0,
        receiverName: user.fullName ?? "", phone: user.phone ?? "", address: address ?? "", note, createdAt,
        items: { create: lines.map((line) => ({ foodId: line.food.id, quantity: line.qty, price: line.food.price, discountAmount: 0 })) } } });
      await tx.paymentTransaction.create({ data: {
        orderId: order.id, method: paymentMethod, amount: total,
        status: paymentStatus === PaymentStatus.PAID ? PaymentTransactionStatus.PAID : PaymentTransactionStatus.PENDING,
        paidAt: paymentStatus === PaymentStatus.PAID ? new Date(createdAt.getTime() + 5 * 60 * 1000) : null,
        createdAt } });
      return order;
    };

    const o1 = await createOrder(tuan, OrderStatus.COMPLETED, "QR", PaymentStatus.PAID, tuan.address, null, daysAgo(12), [L(pho, 2), L(bunCha, 1)]);
    await createOrder(tuan, OrderStatus.COMPLETED, "COD", PaymentStatus.PAID, tuan.address, null, daysAgo(5), [L(bunBoHue, 1), L(dauHu, 1)]);
    await createOrder(khang, OrderStatus.COMPLETED, "QR", PaymentStatus.PAID, khang.address, null, daysAgo(3), [L(myY, 2), L(traDao, 1)]);
    await createOrder(thao, OrderStatus.COMPLETED, "COD", PaymentStatus.PAID, thao.address, null, daysAgo(8), [L(comGa, 1), L(goiCuon, 1), L(nuocCam, 1)]);
    await createOrder(linh, OrderStatus.COMPLETED, "QR", PaymentStatus.PAID, linh.address, null, daysAgo(2), [L(comTam, 1), L(huTieu, 1)]);
    const o6 = await createOrder(tuan, OrderStatus.PREPARING, "COD", PaymentStatus.UNPAID, tuan.address, "Ít cay, gọi trước 10 phút", hoursAgo(3), [L(bunBoHue, 1), L(dauHu, 2)]);
    const o7 = await createOrder(khang, OrderStatus.PREPARING, "QR", PaymentStatus.UNPAID, khang.address, null, hoursAgo(5), [L(pizza, 1), L(traSua, 1)]);
    const o8 = await createOrder(thao, OrderStatus.PENDING, "QR", PaymentStatus.UNPAID, thao.address, null, minutesAgo(30), [L(rau, 1), L(myY, 1)]);
    await createOrder(linh, OrderStatus.PENDING, "COD", PaymentStatus.UNPAID, linh.address, "Ít đường", minutesAgo(15), [L(banhFlan, 2), L(traChanh, 1)]);
    await createOrder(son, OrderStatus.CONFIRMED, "COD", PaymentStatus.UNPAID, son.address, null, hoursAgo(8), [L(lauThai, 1), L(goiCuon, 1)]);
    const o11 = await createOrder(trung, OrderStatus.CONFIRMED, "QR", PaymentStatus.PAID, trung.address, null, hoursAgo(10), [L(boLucLac, 1), L(sinhToBo, 1)]);
    await createOrder(duc, OrderStatus.PENDING, "COD", PaymentStatus.UNPAID, duc.address, null, hoursAgo(1), [L(bunChaChay, 1), L(namXao, 1)]);
    await createOrder(tung, OrderStatus.CANCELLED, "COD", PaymentStatus.UNPAID, tung.address, "Khách đổi ý", daysAgo(1), [L(canhChua, 1), L(comGa, 1)]);
    await createOrder(linh, OrderStatus.COMPLETED, "QR", PaymentStatus.PAID, linh.address, null, daysAgo(9), [L(saladCaesar, 1), L(saladGa, 1), L(caPhe, 1)]);
    await createOrder(son, OrderStatus.PENDING, "QR", PaymentStatus.UNPAID, son.address, null, minutesAgo(10), [L(burger, 1), L(nuocCam, 1)]);

    // Đánh giá chỉ từ món trong đơn đã hoàn thành, đúng ràng buộc ở review service.
    const review = (user: UserRef, food: FoodRef, rating: number, comment: string | null) =>
      tx.review.create({ data: { userId: user.id, foodId: food.id, rating, comment } });
    await review(tuan, pho, 5, "Nước dùng ngon, đậm đà.");
    await review(tuan, bunCha, 4, "Nướng than rất thơm, chấm nước mắm vừa ăn.");
    await review(tuan, bunBoHue, 5, "Vị cay đậm, sợi bún ngon.");
    await review(tuan, dauHu, 4, "Sốt cà chua vừa miệng.");
    await review(khang, myY, 4, "Sốt bò bằm ngon, sợi mỳ dai.");
    await review(khang, traDao, 5, "Trà đào thanh mát, không quá ngọt.");
    await review(thao, comGa, 4, "Gà chiên giòn, cơm dẻo.");
    await review(thao, goiCuon, 5, "Cuốn tươi, chấm đậu phộng ngon.");
    await review(linh, comTam, 5, "Sườn nướng thơm, đồ chua giòn.");
    await review(linh, huTieu, 4, "Nước lèo ngọt thanh.");
    await review(linh, saladCaesar, 3, "Hơi mặn, nên giảm sốt.");
    await review(linh, saladGa, 5, "Gà nướng mềm, rau tươi.");

    const notify = (user: UserRef, order: { id: number } | null, content: string, read: boolean, createdAt: Date) =>
      tx.notification.create({ data: { userId: user.id, orderId: order?.id ?? null, content, read, createdAt } });
    await notify(tuan, o1, "Đơn hàng của bạn đã được giao. Cảm ơn bạn đã ủng hộ!", true, daysAgo(12));
    await notify(tuan, o6, "Đơn hàng của bạn đang được vận chuyển.", false, hoursAgo(3));
    await notify(khang, o7, "Đơn hàng của bạn đang được vận chuyển.", false, hoursAgo(5));
    await notify(thao, o8, "Quán đã nhận đơn của bạn, đang chờ xác nhận.", true, minutesAgo(30));
    await notify(trung, o11, "Đơn hàng của bạn đã được xác nhận.", false, hoursAgo(10));

    const cart = (user: UserRef, food: FoodRef, quantity: number) =>
      tx.cartItem.create({ data: { userId: user.id, foodId: food.id, quantity } });
    await cart(tuan, pho, 1);
    await cart(tuan, traDao, 1);
    await cart(linh, pizza, 1);
    await cart(linh, banhFlan, 1);

    await tx.aiSetting.createMany({ data: [
      { settingKey: "max_suggestions", settingValue: "5" },
      { settingKey: "provider", settingValue: "gemini" },
      { settingKey: "model", settingValue: "gemini-2.0-flash" },
    ] });
  });

  console.log("Seed dữ liệu demo xong.");
}

main()
  .catch((error) => {
    console.error("Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
