import { Outlet } from 'react-router-dom'
import HeaderGlobal from '../components/HeaderGlobal'
import FooterGlobal from '../components/FooterGlobal'
import ChatbotWidget from '../components/ChatbotWidget'

export default function DefaultLayout() {
  return (
    <>
      <div className="flex min-h-dvh flex-col bg-stone-50">
        <HeaderGlobal />
        <main className="flex-1">
          <Outlet />
        </main>
        <FooterGlobal />
      </div>
      <ChatbotWidget />
    </>
  )
}