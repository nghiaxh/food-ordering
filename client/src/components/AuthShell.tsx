import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import UiIcon from './UiIcon'

interface AuthShellProps {
  title: string
  subtitle?: string
  icon: string
  maxWidth?: string
  children: ReactNode
}

export default function AuthShell({ title, subtitle, icon, maxWidth = 'max-w-[420px]', children }: AuthShellProps) {
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

      <Link
        to="/"
        className="absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-stone-200 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
      >
        <UiIcon name="arrow-left" size={14} />
        Trang chủ
      </Link>

      <div
        className={`auth-card relative z-10 w-full ${maxWidth} rounded-3xl bg-white p-8 shadow-2xl shadow-stone-950/40 ring-1 ring-stone-950/5 sm:p-10`}
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-600 text-2xl text-white shadow-lg shadow-amber-600/30">
            <UiIcon name={icon} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-stone-900">{title}</h1>
          <div className="mt-1.5 w-10 border-t-2 border-amber-500" />
          {subtitle && <p className="mt-3 text-sm leading-relaxed text-stone-500">{subtitle}</p>}
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </div>
  )
}