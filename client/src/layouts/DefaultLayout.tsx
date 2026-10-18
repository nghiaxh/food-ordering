import { Outlet } from 'react-router-dom'
import HeaderGlobal from '../components/HeaderGlobal'
import ChatbotWidget from '../components/ChatbotWidget'

/**
 * Layout phía khách: chỉ có thanh điều hướng và khung chatbot nổi, không có chân trang.
 * Trang bảng món tự khoá chiều cao đúng 1 màn hình và cuộn trong vùng riêng; các trang còn
 * lại vẫn cuộn theo trang như bình thường.
 */
export default function DefaultLayout() {
  return (
    <>
      <div className="flex min-h-screen flex-col bg-stone-50">
        <HeaderGlobal />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
      <ChatbotWidget />
    </>
  )
}