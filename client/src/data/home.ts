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
    title: 'Lẩu thái hải sản: giảm ngay 15%',
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
    subtitle: 'Thịt bò mềm, ướp đậm vị, combo kèm cơm trắng và salad tươi.',
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
    desc: 'Thanh toán linh hoạt khi nhận hàng, món nóng hổi giao tận nơi.',
    image: '/images/steps/step-4.jpg',
=======
    desc: 'Thanh toán linh hoạt khi nhận hàng, món nóng hổi giao tận nơi.',
    image: '/images/steps/step-4.webp',
>>>>>>> d21bfc2 (perf: serve local images as webp)
  },
]

export const CONTACT = {
  phone: '0246.888.9999',
  email: 'hello@foodordering.vn',
  address: 'Số 1 Phố Ẩm Thực, Quận Hoàn Kiếm, Hà Nội',
  hours: '10:00 – 22:00 (kể cả cuối tuần)',
}