import type { ReactNode } from 'react'

export function PageCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-stone-200/70 bg-white ${className ?? ''}`}>
      {children}
    </div>
  )
}