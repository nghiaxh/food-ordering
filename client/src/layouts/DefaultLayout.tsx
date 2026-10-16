import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import HeaderGlobal from '../components/HeaderGlobal'
import FooterGlobal from '../components/FooterGlobal'
import ChatbotWidget from '../components/ChatbotWidget'
import ScrollTopButton from '../components/ScrollTopButton'

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
        <FooterGlobal />
      </div>
      <ChatbotWidget open={chatOpen} onOpenChange={setChatOpen} />
      <ScrollTopButton blocked={chatOpen} />
    </>
  )
}
