import { count } from "drizzle-orm";
import {
  aiSetting,
  cartItems,
  categories,
  chatbotKnowledge,
  chatbotKnowledgeChunk,
  foods,
  notifications,
  orderItems,
  orders,
  paymentTransactions,
  promotions,
  reviews,
  users,
} from "./schema.js";
import { db, pool } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);
const hoursAgo = (n: number) => new Date(Date.now() - n * 3600 * 1000);
const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000);

type UserRef = { id: number; fullName: string | null; phone: string | null; address: string | null };
type FoodRef = { id: number; price: string };

// Seed du lieu demo bang Drizzle ORM. Chi chay khi bang users con trong
// de tranh nhan doi du lieu; muon nap lai thi xoa volume db_data.
async function main() {
  const [totalRes] = await db.select({ value: count() }).from(users);
  if ((totalRes?.value ?? 0) > 0) {
    console.log("Đã có dữ liệu, bỏ qua seed.");
    return;
  }

  await db.transaction(async (tx) => {
    // Mat khau duoc bam truoc vi khong luu plain text, ke ca voi tai khoan demo.
    const createUser = async (
      email: string,
      pass: string,
      fullName: string,
      phone: string,
      address: string,
      role: "ADMIN" | "CUSTOMER",
    ): Promise<UserRef> => {
      const [u] = await tx
        .insert(users)
        .values({ email, password: await hashPassword(pass), fullName, phone, address, role })
        .returning();
      return u!;
    };

    const [, , tuan, khang, thao, linh, son, trung, duc, tung] = await Promise.all([
      createUser("namnguyen@demo.com", "namnguyen", "Nguyễn Hoàng Nam", "0901000001", "Số 1 Hòa Bình, Ninh Kiều, Cần Thơ", "ADMIN"),
      createUser("huongtran@demo.com", "huongtran", "Trần Thu Hương", "0901000002", "Số 2 Trần Hưng Đạo, Cái Răng, Cần Thơ", "ADMIN"),
      createUser("tuanpham@demo.com", "tuanpham", "Phạm Văn Tuấn", "0901000003", "12 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ", "CUSTOMER"),
      createUser("khangnguyen@demo.com", "khangnguyen", "Nguyễn Minh Khang", "0901000004", "45 Mạc Cửu, Ninh Kiều, Cần Thơ", "CUSTOMER"),
      createUser("thaotran@demo.com", "thaotran", "Trần Phương Thảo", "0901000005", "78 Trần Hưng Đạo, Cái Răng, Cần Thơ", "CUSTOMER"),
      createUser("linhduong@demo.com", "linhduong", "Dương Ngọc Linh", "0901000006", "23 Hòa Bình, Bình Thủy, Cần Thơ", "CUSTOMER"),
      createUser("sonnguyen@demo.com", "sonnguyen", "Nguyễn Thanh Sơn", "0901000007", "56 Lý Tự Trọng, Ninh Kiều, Cần Thơ", "CUSTOMER"),
      createUser("trungdang@demo.com", "trungdang", "Đặng Quốc Trung", "0901000008", "89 Võ Văn Tần, Ô Môn, Cần Thơ", "CUSTOMER"),
      createUser("duchoang@demo.com", "duchoang", "Hoàng Minh Đức", "0901000009", "34 Nguyễn Trãi, Thốt Nốt, Cần Thơ", "CUSTOMER"),
      createUser("tunghoang@demo.com", "tunghoang", "Hoàng Thanh Tùng", "0901000010", "67 Trần Hưng Đạo, Ninh Kiều, Cần Thơ", "CUSTOMER"),
    ]);

    const [viet] = await tx.insert(categories).values({
      name: "Món Việt", slug: "mon-viet", imageUrl: "/images/categories/mon-viet.webp",
      description: "Cơm, phở, bún, mì và các món Việt truyền thống",
    }).returning();
    const [au] = await tx.insert(categories).values({
      name: "Món Âu", slug: "mon-au", imageUrl: "/images/categories/mon-au.webp",
      description: "Món Ý, phương Tây với thịt và rau củ",
    }).returning();
    const [uong] = await tx.insert(categories).values({
      name: "Đồ uống", slug: "do-uong", imageUrl: "/images/categories/do-uong.webp",
      description: "Nước ngọt, trà trái cây và cà phê",
    }).returning();
    const [trangMieng] = await tx.insert(categories).values({
      name: "Tráng miệng", slug: "trang-mieng", imageUrl: "/images/categories/trang-mieng.webp",
      description: "Chè và món ngọt sau bữa ăn",
    }).returning();
    const [chay] = await tx.insert(categories).values({
      name: "Món chay", slug: "mon-chay", imageUrl: "/images/categories/mon-chay.webp",
      description: "Món không dùng thịt, phục vụ người ăn chay",
    }).returning();

    const createFood = async (
      name: string, cat: { id: number }, description: string, ingredients: string,
      price: number, servingSize: number, spicyLevel: number, dietaryTags: string,
      allergens: string, slug: string, available = true,
    ): Promise<FoodRef> => {
      const [f] = await tx.insert(foods).values({
        name, categoryId: cat.id, description, ingredients, price: String(price), servingSize, spicyLevel,
        dietaryTags, allergens, available, imageUrl: `/images/foods/${slug}.webp`,
      }).returning();
      return f!;
    };

    const pho = await createFood("Phở bò", viet!, "Phở bò truyền thống, nước dùng hầm xương 12 giờ",
      "bánh phở, thịt bò, hành, quế, hồi", 65000, 1, 0, "", "gluten", "pho-bo");
    const bunCha = await createFood("Bún chả Hà Nội", viet!, "Bún chả nướng than hoa ăn kèm nước mắm chua ngọt",
      "bún, thịt heo, nước mắm, rau sống", 60000, 1, 0, "", "", "bun-cha");
    const comGa = await createFood("Cơm gà xối mỡ", viet!, "Cơm gà chiên giòn", "cơm, gà, dưa leo",
      55000, 1, 0, "", "", "com-ga-xoi-mo");
    const bunBoHue = await createFood("Bún bò Huế", viet!, "Bún bò cay đặc trưng miền Trung",
      "bún, thịt bò, giò heo, sả, ớt", 70000, 1, 3, "", "gluten", "bun-bo-hue");
    const goiCuon = await createFood("Gỏi cuốn tôm thịt", viet!, "Gỏi cuốn tươi mát chấm tương đậu phộng",
      "bánh tráng, tôm, thịt heo, bún, rau", 45000, 2, 0, "", "hải sản,đậu phộng", "goi-cuon");
    const canhChua = await createFood("Canh chua cá lóc", viet!, "Canh chua miền Tây với cá lóc, thơm, cà chua",
      "cá lóc, thơm, cà chua, đậu bắp", 90000, 3, 1, "ít dầu mỡ", "hải sản", "canh-chua-ca-loc");
    const rau = await createFood("Rau muống xào tỏi", chay!, "Rau muống xào tỏi giòn xanh",
      "rau muống, tỏi", 35000, 2, 0, "chay,ít dầu mỡ", "", "rau-muong-xao-toi");
    const dauHu = await createFood("Đậu hũ sốt cà chua", chay!, "Đậu hũ non sốt cà chua thanh đạm",
      "đậu hũ, cà chua, hành", 40000, 2, 0, "chay", "đậu nành", "dau-hu-sot-ca-chua");
    const lauThai = await createFood("Lẩu thái hải sản", viet!, "Lẩu chua cay với tôm, mực, nghêu",
      "tôm, mực, nghêu, sả, ớt, nấm", 250000, 4, 3, "", "hải sản", "lau-thai-hai-san", false);
    const boLucLac = await createFood("Bò lúc lắc", viet!, "Bò lúc lắc khoai tây chiên",
      "thịt bò, khoai tây, hành tây", 120000, 2, 0, "", "", "bo-luc-lac");
    const myY = await createFood("Mỳ Ý sốt bò bằm", au!, "Spaghetti sốt cà chua thịt bò bằm",
      "mỳ Ý, thịt bò, cà chua", 85000, 1, 0, "", "gluten", "my-y-bo-bam");
    const saladCaesar = await createFood("Salad Caesar", au!, "Salad rau xà lách, gà nướng, phô mai",
      "xà lách, gà, phô mai, sốt caesar", 75000, 1, 0, "ít dầu mỡ", "sữa,trứng", "salad-caesar", false);
    const traDao = await createFood("Trà đào cam sả", uong!, "Trà đào thanh mát", "trà, đào, cam, sả",
      40000, 1, 0, "chay", "", "tra-dao-cam-sa");
    const nuocCam = await createFood("Nước cam ép", uong!, "Cam vắt nguyên chất", "cam",
      35000, 1, 0, "chay,ít dầu mỡ", "", "nuoc-cam-ep");
    const caPhe = await createFood("Cà phê sữa đá", uong!, "Cà phê phin truyền thống", "cà phê, sữa đặc",
      30000, 1, 0, "", "sữa", "ca-phe-sua-da");
    await createFood("Chè khúc bạch", trangMieng!, "Chè khúc bạch hạnh nhân",
      "sữa, hạnh nhân, vải", 45000, 1, 0, "chay", "sữa,hạt", "che-khuc-bach");

    const comTam = await createFood("Cơm tấm sườn nướng", viet!, "Cơm tấm hạt, sườn nướng mật ong",
      "cơm tấm, sườn heo, đồ chua, trứng ốp", 55000, 1, 0, "", "trứng", "com-tam-suon");
    const huTieu = await createFood("Hủ tiếu Nam Vang", viet!, "Hủ tiếu dai, nước lèo ngọt thanh",
      "bánh hủ tiếu, tôm, thịt heo, trứng cút", 65000, 1, 0, "", "hải sản", "hu-tieu-nam-vang");
    await createFood("Bánh xèo miền Tây", viet!, "Bánh xèo giòn, nhân tôm giá",
      "bột gạo, tôm, giá, thịt heo", 50000, 2, 0, "", "hải sản", "banh-xeo", false);
    await createFood("Mì Quảng gà", viet!, "Mì vàng nghệ, nước dùng gà ngọt",
      "mì, gà, trứng, rau sống", 55000, 1, 1, "", "trứng", "mi-quang-ga");
    const pizza = await createFood("Pizza phô mai", au!, "Đế mỏng, phô mai mozzarella kéo sợi",
      "bột mì, sốt cà chua, phô mai mozzarella", 95000, 2, 0, "", "gluten,sữa", "pizza-pho-mai");
    const burger = await createFood("Burger bò phô mai", au!, "Bánh mì burger, bò nướng, phô mai cheddar",
      "bánh mì, thịt bò, phô mai, xà lách, trứng", 85000, 1, 1, "", "gluten,sữa,trứng", "burger-bo");
    await createFood("Mỳ Ý sốt kem nấm", au!, "Sốt kem béo, nấm đều miếng",
      "mỳ Ý, kem tươi, nấm, thịt gà", 89000, 1, 0, "", "gluten,sữa", "my-y-sot-kem-nam");
    const saladGa = await createFood("Salad gà nướng", au!, "Gà nướng sả, rau trộn giòn",
      "xà lách, gà nướng, cà chua bi, trứng", 70000, 1, 0, "ít dầu mỡ", "trứng", "salad-ga-nuong");
    const traSua = await createFood("Trà sữa trân châu đường đen", uong!, "Trà sữa béo, trân châu giòn",
      "trà đen, sữa tươi, trân châu đường đen", 45000, 1, 0, "chay", "sữa", "tra-sua-tran-chau");
    const sinhToBo = await createFood("Sinh tố bơ", uong!, "Bơ xay sữa, dẻo béo",
      "bơ, sữa tươi, sữa đặc", 40000, 1, 0, "chay", "sữa", "sinh-to-bo");
    const traChanh = await createFood("Trà chanh giã tay", uong!, "Trà chanh chua ngọt, giã tay",
      "trà, chanh, đường, đá bào", 25000, 1, 0, "chay,ít dầu mỡ", "", "tra-chanh-gia-tay");
    await createFood("Nước mía lau", uong!, "Mía nguyên chất ép tươi",
      "mía, quất, tắc", 20000, 1, 0, "chay,ít dầu mỡ", "", "nuoc-mia");
    const banhFlan = await createFood("Bánh flan caramel", trangMieng!, "Flan mềm, caramel óng ánh",
      "trứng, sữa tươi, sữa đặc, caramel", 25000, 1, 0, "chay", "sữa,trứng", "banh-flan");
    await createFood("Rau câu dừa", trangMieng!, "Rau câu trong, vị dừa thơm",
      "dừa, đường, rau câu", 30000, 2, 0, "chay", "", "rau-cau-dua", false);
    const namXao = await createFood("Nấm xào sả ớt", chay!, "Nấm đùi gà xào sả ớt thơm",
      "nấm đùi gà, sả, ớt, hành lá", 45000, 2, 2, "chay", "", "nam-xao-sa");
    const bunChaChay = await createFood("Bún chả chay", chay!, "Chả chay từ đậu hũ, nước chấm chua ngọt",
      "bún, đậu hũ, nấm mèo, nước mắm chay", 55000, 1, 0, "chay", "gluten,đậu nành", "bun-cha-chay");

    // Khuyen mai
    const promoStart = daysAgo(1);
    const promoEnd = new Date(Date.now() + 183 * 24 * 3600 * 1000);

    await tx.insert(promotions).values([
      {
        name: "Cuối tuần mát lạnh", description: "Giảm 20% đồ uống thứ Bảy và Chủ Nhật",
        discountType: "PERCENT", discountValue: "20", scope: "CATEGORY",
        targetIds: [uong!.id], daysOfWeek: "SAT,SUN", startsAt: promoStart, endsAt: promoEnd, active: true,
      },
      {
        name: "Món may mắn hôm nay", description: "Ba món ngẫu nhiên giảm 15% mỗi ngày",
        discountType: "PERCENT", discountValue: "15", scope: "FOOD",
        targetIds: [pho.id, traSua.id, comTam.id], startsAt: promoStart, endsAt: promoEnd, active: true,
      },
      {
        name: "Giảm 10k cho đơn từ 100k", description: "Giảm 10.000đ cho đơn từ 100.000đ",
        discountType: "FIXED", discountValue: "10000", scope: "FOOD",
        targetIds: [boLucLac.id, pizza.id, burger.id], minOrderTotal: "100000",
        startsAt: promoStart, endsAt: promoEnd, active: true,
      },
      {
        name: "Ưu đãi buổi trưa", description: "Giảm 10% đồ uống khung 11h đến 13h",
        discountType: "PERCENT", discountValue: "10", scope: "CATEGORY",
        targetIds: [uong!.id], startTime: "11:00", endTime: "13:00",
        startsAt: promoStart, endsAt: promoEnd, active: true,
      },
    ]);

    // 15 don rai tren 8 khach
    type Line = { food: FoodRef; qty: number };
    const L = (food: FoodRef, qty: number): Line => ({ food, qty });
    const createOrder = async (
      user: UserRef, status: "PENDING" | "CONFIRMED" | "PREPARING" | "COMPLETED" | "CANCELLED",
      paymentMethod: string, paymentStatus: "UNPAID" | "PAID", address: string | null,
      note: string | null, createdAt: Date, lines: Line[],
    ) => {
      let total = 0;
      for (const line of lines) total += Number(line.food.price) * line.qty;

      const [order] = await tx.insert(orders).values({
        userId: user.id, status, paymentMethod, paymentStatus, total: String(total), discountTotal: "0",
        receiverName: user.fullName ?? "", phone: user.phone ?? "", address: address ?? "", note, createdAt,
      }).returning();

      await tx.insert(orderItems).values(
        lines.map((line) => ({
          orderId: order!.id, foodId: line.food.id, quantity: line.qty,
          price: String(line.food.price), discountAmount: "0",
        })),
      );

      await tx.insert(paymentTransactions).values({
        orderId: order!.id, method: paymentMethod, amount: String(total),
        status: paymentStatus === "PAID" ? "PAID" : "PENDING",
        paidAt: paymentStatus === "PAID" ? new Date(createdAt.getTime() + 5 * 60 * 1000) : null,
        createdAt,
      });

      return order!;
    };

    const o1 = await createOrder(tuan, "COMPLETED", "QR", "PAID", tuan.address, null, daysAgo(12), [L(pho, 2), L(bunCha, 1)]);
    await createOrder(tuan, "COMPLETED", "COD", "PAID", tuan.address, null, daysAgo(5), [L(bunBoHue, 1), L(dauHu, 1)]);
    await createOrder(khang, "COMPLETED", "QR", "PAID", khang.address, null, daysAgo(3), [L(myY, 2), L(traDao, 1)]);
    await createOrder(thao, "COMPLETED", "COD", "PAID", thao.address, null, daysAgo(8), [L(comGa, 1), L(goiCuon, 1), L(nuocCam, 1)]);
    await createOrder(linh, "COMPLETED", "QR", "PAID", linh.address, null, daysAgo(2), [L(comTam, 1), L(huTieu, 1)]);
    const o6 = await createOrder(tuan, "PREPARING", "COD", "UNPAID", tuan.address, "Ít cay, gọi trước 10 phút", hoursAgo(3), [L(bunBoHue, 1), L(dauHu, 2)]);
    const o7 = await createOrder(khang, "PREPARING", "QR", "UNPAID", khang.address, null, hoursAgo(5), [L(pizza, 1), L(traSua, 1)]);
    const o8 = await createOrder(thao, "PENDING", "QR", "UNPAID", thao.address, null, minutesAgo(30), [L(rau, 1), L(myY, 1)]);
    await createOrder(linh, "PENDING", "COD", "UNPAID", linh.address, "Ít đường", minutesAgo(15), [L(banhFlan, 2), L(traChanh, 1)]);
    await createOrder(son, "CONFIRMED", "COD", "UNPAID", son.address, null, hoursAgo(8), [L(lauThai, 1), L(goiCuon, 1)]);
    const o11 = await createOrder(trung, "CONFIRMED", "QR", "PAID", trung.address, null, hoursAgo(10), [L(boLucLac, 1), L(sinhToBo, 1)]);
    await createOrder(duc, "PENDING", "COD", "UNPAID", duc.address, null, hoursAgo(1), [L(bunChaChay, 1), L(namXao, 1)]);
    await createOrder(tung, "CANCELLED", "COD", "UNPAID", tung.address, "Khách đổi ý", daysAgo(1), [L(canhChua, 1), L(comGa, 1)]);
    await createOrder(linh, "COMPLETED", "QR", "PAID", linh.address, null, daysAgo(9), [L(saladCaesar, 1), L(saladGa, 1), L(caPhe, 1)]);
    await createOrder(son, "PENDING", "QR", "UNPAID", son.address, null, minutesAgo(10), [L(burger, 1), L(nuocCam, 1)]);

    // Danh gia
    await tx.insert(reviews).values([
      { userId: tuan.id, foodId: pho.id, rating: 5, comment: "Nước dùng ngon, đậm đà." },
      { userId: tuan.id, foodId: bunCha.id, rating: 4, comment: "Nướng than rất thơm, chấm nước mắm vừa ăn." },
      { userId: tuan.id, foodId: bunBoHue.id, rating: 5, comment: "Vị cay đậm, sợi bún ngon." },
      { userId: tuan.id, foodId: dauHu.id, rating: 4, comment: "Sốt cà chua vừa miệng." },
      { userId: khang.id, foodId: myY.id, rating: 4, comment: "Sốt bò bằm ngon, sợi mỳ dai." },
      { userId: khang.id, foodId: traDao.id, rating: 5, comment: "Trà đào thanh mát, không quá ngọt." },
      { userId: thao.id, foodId: comGa.id, rating: 4, comment: "Gà chiên giòn, cơm dẻo." },
      { userId: thao.id, foodId: goiCuon.id, rating: 5, comment: "Cuốn tươi, chấm đậu phộng ngon." },
      { userId: linh.id, foodId: comTam.id, rating: 5, comment: "Sườn nướng thơm, đồ chua giòn." },
      { userId: linh.id, foodId: huTieu.id, rating: 4, comment: "Nước lèo ngọt thanh." },
      { userId: linh.id, foodId: saladCaesar.id, rating: 3, comment: "Hơi mặn, nên giảm sốt." },
      { userId: linh.id, foodId: saladGa.id, rating: 5, comment: "Gà nướng mềm, rau tươi." },
    ]);

    // Thong bao
    await tx.insert(notifications).values([
      { userId: tuan.id, orderId: o1.id, content: "Đơn hàng của bạn đã được giao. Cảm ơn bạn đã ủng hộ!", read: true, createdAt: daysAgo(12) },
      { userId: tuan.id, orderId: o6.id, content: "Đơn hàng của bạn đang được vận chuyển.", read: false, createdAt: hoursAgo(3) },
      { userId: khang.id, orderId: o7.id, content: "Đơn hàng của bạn đang được vận chuyển.", read: false, createdAt: hoursAgo(5) },
      { userId: thao.id, orderId: o8.id, content: "Quán đã nhận đơn của bạn, đang chờ xác nhận.", read: true, createdAt: minutesAgo(30) },
      { userId: trung.id, orderId: o11.id, content: "Đơn hàng của bạn đã được xác nhận.", read: false, createdAt: hoursAgo(10) },
    ]);

    // Gio hang
    await tx.insert(cartItems).values([
      { userId: tuan.id, foodId: pho.id, quantity: 1 },
      { userId: tuan.id, foodId: traDao.id, quantity: 1 },
      { userId: linh.id, foodId: pizza.id, quantity: 1 },
      { userId: linh.id, foodId: banhFlan.id, quantity: 1 },
    ]);

    // Cau hinh AI
    await tx.insert(aiSetting).values([
      { settingKey: "max_suggestions", settingValue: "5" },
      { settingKey: "provider", settingValue: "gemini" },
      { settingKey: "model", settingValue: "gemini-2.0-flash" },
    ]);

    // Tai lieu quan
    const docs = await tx.insert(chatbotKnowledge).values([
      { title: "Giờ mở cửa", category: "HOURS", keywords: "giờ mở cửa, mấy giờ đóng cửa, mở cửa, đóng cửa", content: "Quán mở cửa từ 07:00 đến 22:00 hằng ngày. Sau 21:30 món có thể hết dần, bạn cân nhắc đặt sớm hơn nhé!", enabled: true, status: "READY" },
      { title: "Địa chỉ quán", category: "SHOP", keywords: "địa chỉ, ở đâu, quán ở đâu", content: "Quán ở Cần Thơ (địa chỉ chi tiết xem ở chân trang). Bạn có thể đặt giao hàng tới địa chỉ của bạn.", enabled: true, status: "READY" },
      { title: "Giao hàng và phí ship", category: "DELIVERY", keywords: "giao hàng, ship, phí ship, thời gian giao", content: "Thời gian giao thường 20-30 phút tùy khoảng cách. Phí ship tính theo khoảng cách, xem chi tiết ở bước thanh toán.", enabled: true, status: "READY" },
      { title: "Thanh toán", category: "PAYMENT", keywords: "thanh toán, trả tiền, cod, qr", content: "Bạn có thể thanh toán COD hoặc QR sau khi tạo đơn. Đơn UNPAID và PENDING mới được hủy.", enabled: true, status: "READY" },
      { title: "Cách đặt món", category: "ORDER", keywords: "cách đặt món, đặt món thế nào, thêm vào giỏ", content: "Thêm món vào giỏ rồi vào trang thanh toán để đặt. Khách vãng lai cần đăng nhập mới thêm được vào giỏ.", enabled: true, status: "READY" },
      { title: "Hủy đơn", category: "ORDER", keywords: "hủy đơn, hủy hàng", content: "Chỉ hủy được đơn đang CHỜ (PENDING) và CHƯA thanh toán (UNPAID). Đơn đã hoàn thành hoặc đã hủy không sửa được.", enabled: true, status: "READY" },
      { title: "Dị ứng và thành phần", category: "ALLERGY", keywords: "dị ứng, thành phần, hải sản", content: "Mỗi món có bảng nguyên liệu và dị ứng. Nếu bạn dị ứng nặng, nhắn cho quán hoặc hỏi nhân viên trước khi đặt.", enabled: true, status: "READY" },
      { title: "Giỏ hàng đăng nhập", category: "ORDER", keywords: "giỏ hàng, đăng nhập, tài khoản", content: "Giỏ hàng cần đăng nhập, khách vãng lai xem món được nhưng chưa thêm vào giỏ được.", enabled: true, status: "READY" },
    ]).returning();

    // Chunk tai lieu cho tsvector RAG
    for (const d of docs) {
      if (d.content) {
        await tx.insert(chatbotKnowledgeChunk).values({
          documentId: d.id,
          chunkIndex: 0,
          content: d.content,
        });
      }
    }
  });

  console.log("Seed dữ liệu demo bằng Drizzle thành công.");
}

main()
  .catch((error) => {
    console.error("Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
