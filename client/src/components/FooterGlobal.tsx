import { Link } from 'react-router-dom'
import { CONTACT } from '../data/home'

export default function FooterGlobal() {
  return (
    <footer className="bg-stone-900 text-stone-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-1.5 text-lg font-bold text-white">
            <img src="/favicon.svg" alt="FoodOrdering" className="h-10 w-10 rounded-xl" />
            <span>
              Food<span className="text-amber-500">Ordering</span>
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-stone-400">
            Nhà hàng phục vụ món Việt tinh túy và món Âu cao cấp, đặt món trực tuyến với chatbot AI
            tư vấn thông minh.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Liên hệ</h4>
          <ul className="mt-4 space-y-2 text-sm text-stone-400">
            <li>Hotline: {CONTACT.phone}</li>
            <li>Email: {CONTACT.email}</li>
            <li>{CONTACT.address}</li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Khám phá</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/" className="hover:text-amber-500">Trang chủ</Link></li>
            <li><Link to="/foods" className="hover:text-amber-500">Thực đơn</Link></li>
            <li><Link to="/cart" className="hover:text-amber-500">Giỏ hàng</Link></li>
            <li><Link to="/orders" className="hover:text-amber-500">Đơn hàng</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Giờ mở cửa</h4>
          <ul className="mt-4 space-y-2 text-sm text-stone-400">
            <li>{CONTACT.hours}</li>
            <li>Nhận đặt món online 24/7</li>
            <li className="pt-2 text-stone-500">Bạn muốn biết ăn gì hôm nay? Hỏi chatbot ngay góc phải màn hình!</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-800 py-5 text-center text-sm text-stone-500">
        © {new Date().getFullYear()} FoodOrdering - Niên luận ngành, mọi nội dung chỉ mang tính
        minh họa.
      </div>
    </footer>
  )
}