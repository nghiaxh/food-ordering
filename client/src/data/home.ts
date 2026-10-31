export const HERO = {
  badge: 'Ẩm thực Việt đương đại',
  titleA: 'Tinh hoa ẩm thực',
  titleHighlight: 'Việt',
  titleB: ', chuẩn vị từng món',
  subtitle:
<<<<<<< HEAD
    'Thực đơn phong phú từ món truyền thống đến quốc tế, được chế biến bởi đầu bếp giàu kinh nghiệm. Đặt món online cực nhanh — chatbot AI tư vấn cho bạn.',
=======
    'Từ món Việt truyền thống đến món Âu tinh tế, mỗi món đều được chế biến bởi đầu bếp giàu kinh nghiệm. Đặt món chỉ vài phút, chatbot AI tư vấn theo khẩu vị của bạn.',
>>>>>>> d21bfc2 (perf: serve local images as webp)
}

export interface Banner {
  image: string
  tag: string
  title: string
  subtitle: string
}

export const BANNERS: Banner[] = [
  {
    image: '/images/banners/banner-1.webp',
    tag: 'Ưu đãi cuối tuần',
    title: 'Lẩu thái hải sản — giảm ngay 15%',
    subtitle: 'Áp dụng cho đơn từ 2 phần trở lên, đặt trước 20h mỗi cuối tuần.',
  },
  {
    image: '/images/banners/banner-2.webp',
    tag: 'Bộ đôi quà tặng',
    title: 'Mua 2 món chính tặng 1 món phụ',
    subtitle: 'Chương trình chỉ áp dụng khi đặt qua website hoặc chatbot.',
  },
  {
    image: '/images/banners/banner-3.webp',
    tag: 'Món mới',
    title: 'Bò lúc lắc cập bến thực đơn',
    subtitle: 'Thịt bò mềm, ướp đậm vị — combo kèm cơm trắng và salad tươi.',
  },
]

export interface Step {
  no: string
  title: string
  desc: string
  image: string
}

export const STEPS: Step[] = [
  {
    no: '01',
    title: 'Chọn món',
    desc: 'Duyệt thực đơn hoặc để chatbot AI gợi ý theo khẩu vị và ngân sách của bạn.',
    image: '/images/steps/step-1.webp',
  },
  {
    no: '02',
    title: 'Đặt món',
    desc: 'Thêm vào giỏ và điền thông tin giao hàng chỉ trong vài thao tác.',
    image: '/images/steps/step-2.webp',
  },
  {
    no: '03',
    title: 'Xác nhận đơn',
    desc: 'Đơn được xác nhận ngay, bếp bắt đầu chế biến và cập nhật trạng thái theo thời gian thực.',
    image: '/images/steps/step-3.webp',
  },
  {
    no: '04',
    title: 'Nhận món & thưởng thức',
<<<<<<< HEAD
    desc: 'Thanh toán linh hoạt khi nhận hàng — món nóng hổi giao tận nơi.',
    image: '/images/steps/step-4.jpg',
=======
    desc: 'Thanh toán linh hoạt khi nhận hàng, món nóng hổi giao tận nơi.',
    image: '/images/steps/step-4.webp',
>>>>>>> d21bfc2 (perf: serve local images as webp)
  },
]

export interface Feature {
  image: string
  title: string
  desc: string
}

export const FEATURES: Feature[] = [
  {
    image: '/images/features/feature-fresh.jpg',
    title: 'Nguyên liệu tươi mỗi ngày',
    desc: 'Nhập rau củ, thịt cá tươi từ nguồn cung đã kiểm định.',
  },
  {
    image: '/images/features/feature-chef.jpg',
    title: 'Đầu bếp chuyên nghiệp',
    desc: 'Đội ngũ đầu bếp 10+ năm kinh nghiệm, chuẩn hương vị truyền thống.',
  },
  {
    image: '/images/features/feature-delivery.jpg',
    title: 'Giao hàng siêu tốc',
    desc: 'Nhận món trong 30–45 phút tại nội thành, đóng gói an toàn.',
  },
  {
    image: '/images/features/feature-support.jpg',
    title: 'Hỗ trợ tận tình',
    desc: 'Hotline và chatbot trực tuyến luôn sẵn sàng giải đáp mọi thắc mắc.',
  },
]

export interface Testimonial {
  quote: string
  name: string
  role: string
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'Món ăn chuẩn vị như nấu tại nhà. Chatbot tư vấn rất khéo, tránh đúng món mình không ăn được.',
    name: 'Thu Hằng',
    role: 'Khách quen tại Cầu Giấy',
  },
  {
    quote: 'Đặt combo cho 4 người nhanh gọn, tổng tiền không vượt ngân sách. Giao đúng giờ, đồ vẫn nóng hổi.',
    name: 'Minh Quân',
    role: 'Nhân viên văn phòng, Đống Đa',
  },
  {
    quote: 'Lần đầu thấy chatbot hiểu được yêu cầu "không cay, không hải sản". Gợi ý đúng gu gia đình mình.',
    name: 'Lan Phương',
    role: 'Khách order hằng tuần',
  },
]

export const CONTACT = {
  phone: '0246.888.9999',
  email: 'hello@foodordering.vn',
  address: 'Số 1 Phố Ẩm Thực, Quận Hoàn Kiếm, Hà Nội',
  hours: '10:00 – 22:00 (kể cả cuối tuần)',
}