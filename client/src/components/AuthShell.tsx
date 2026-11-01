import type { ReactNode } from 'react'

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
      <div
        className="absolute inset-0 bg-gradient-to-b from-stone-950/45 via-stone-950/65 to-stone-950/80 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      <div
        className={`auth-card relative z-10 w-full ${maxWidth} rounded-3xl bg-white p-6 shadow-2xl shadow-stone-950/40 ring-1 ring-stone-950/5 sm:p-8`}
      >
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-stone-900">{title}</h1>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}