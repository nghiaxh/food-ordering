import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import HeaderGlobal from '../components/HeaderGlobal'
import ChatbotWidget from '../components/ChatbotWidget'
import ScrollTopButton from '../components/ScrollTopButton'

/**
 * Layout phía khách: chỉ có thanh điều hướng và khung chatbot nổi, không có chân trang.
 * Trang bảng món tự khoá chiều cao đúng 1 màn hình và cuộn trong vùng riêng; các trang còn
 * lại vẫn cuộn theo trang như bình thường.
 */
export default function DefaultLayout() {
  // Trạng thái mở chatbot nâng lên đây để ScrollTopButton biết mà tránh đè lên khung chat.
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <>
      <div className="flex min-h-dvh flex-col bg-stone-50">
        <HeaderGlobal />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
      <ChatbotWidget open={chatOpen} onOpenChange={setChatOpen} />
      <ScrollTopButton blocked={chatOpen} />
    </>
  )
}
