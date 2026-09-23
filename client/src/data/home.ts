export const HERO = {
  badge: 'Nhà hàng đạt chuẩn ẩm thực',
  titleA: 'Tinh hoa món',
  titleHighlight: 'Việt',
  titleB: ', chuẩn vị',
  subtitle:
    'Món Việt truyền thống đến món Âu tinh tế, chế biến bởi đầu bếp giàu kinh nghiệm. Đặt món online nhanh gọn, có chatbot AI tư vấn.',
}

export interface Banner {
  image: string
  tag: string
  title: string
  subtitle: string
}

export const BANNERS: Banner[] = [
  {
    image: '/images/banners/banner-1.jpg',
    tag: 'Ưu đãi cuối tuần',
    title: 'Lẩu thái hải sản: giảm ngay 15%',
    subtitle: 'Áp dụng cho đơn từ 2 phần trở lên, đặt trước 20h mỗi cuối tuần.',
  },
  {
    image: '/images/banners/banner-2.jpg',
    tag: 'Bộ đôi quà tặng',
    title: 'Mua 2 món chính tặng 1 món phụ',
    subtitle: 'Chương trình chỉ áp dụng khi đặt qua website hoặc chatbot.',
  },
  {
    image: '/images/banners/banner-3.jpg',
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
    image: '/images/steps/step-1.jpg',
  },
  {
    no: '02',
    title: 'Đặt món',
    desc: 'Thêm vào giỏ và điền thông tin giao hàng chỉ trong vài thao tác.',
    image: '/images/steps/step-2.jpg',
  },
  {
    no: '03',
    title: 'Nhà hàng xác nhận',
    desc: 'Bếp bắt đầu chế biến ngay sau khi đơn được xác nhận theo thời gian thực.',
    image: '/images/steps/step-3.jpg',
  },
  {
    no: '04',
    title: 'Nhận món & thưởng thức',
    desc: 'Thanh toán linh hoạt khi nhận hàng, món nóng hổi giao tận nơi.',
    image: '/images/steps/step-4.jpg',
  },
]

export const CONTACT = {
  phone: '0246.888.9999',
  email: 'hello@foodordering.vn',
  address: 'Số 1 Phố Ẩm Thực, Quận Hoàn Kiếm, Hà Nội',
  hours: '10:00 – 22:00 (kể cả cuối tuần)',
}