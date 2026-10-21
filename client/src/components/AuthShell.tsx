import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AuthShellProps {
  title: string
  maxWidth?: string
  children: ReactNode
}

export default function AuthShell({ title, maxWidth = 'max-w-[400px]', children }: AuthShellProps) {
  return (
    <div
      className="auth-shell relative flex min-h-[100dvh] items-center justify-center overflow-hidden p-4"
      style={{
        backgroundImage: "url('/images/hero.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#1c1917',
      }}
    >
      <div className="absolute inset-0 bg-stone-950/70 backdrop-blur-sm" aria-hidden="true" />

      {/* Hai trang đăng nhập/đăng ký không có thanh điều hướng nên thương hiệu hiện ở đây;
          logo cũng là nút về bảng món nên thay cho nhãn "Trang chủ" cũ. */}
      <Link
        to="/"
        aria-label="Về bảng món"
        className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3.5 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-white/20"
      >
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        <span className="text-sm font-semibold text-white">
          Food<span className="text-amber-400">Ordering</span>
        </span>
      </Link>

      <div
        className={`auth-card relative z-10 w-full ${maxWidth} rounded-3xl bg-white p-6 shadow-2xl shadow-stone-950/40 ring-1 ring-stone-950/5 sm:p-8`}
      >
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-stone-900">{title}</h1>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}