import type { CSSProperties, ReactNode } from 'react'
import { Button, Card, type ButtonProps } from 'antd'
import UiIcon from './UiIcon'

/** Wrapper ẩn nếu src rỗng — tránh giữ chỗ ảnh rỗng trên giao diện. */
export function UiMaybeImage({ src, ...rest }: { src?: string | null } & Record<string, unknown>) {
  if (!src) return null
  return <UiImg src={src} {...rest} />
}

/**
 * Nút phụ có tone đơn sắc tùy chỉnh — thay cho loạt Button xám nhàm chán.
 */
export function TintedButton({ tone = 'stone', ...props }: ButtonProps & { tone?: 'stone' | 'amber' | 'red' }) {
  const styles: Record<string, string> = {
    stone: 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100',
    red: 'border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100',
  }
  return <Button className={`${styles[tone]} ${props.className ?? ''}`} {...props} />
}

/**
 * Card nền trắng dùng chung cho các trang admin.
 */
export function PageCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200/70 ${className ?? ''}`}>
      {children}
    </div>
  )
}

/**
 * Đầu trang admin: tiêu đề, mô tả và nút hành động chính bên phải.
 */
export function AdminPageHeader({
  title,
  description,
  extra,
}: {
  title: ReactNode
  description?: ReactNode
  extra?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-relaxed text-stone-500">{description}</p> : null}
      </div>
      {extra ? <div className="flex shrink-0 items-center gap-2">{extra}</div> : null}
    </div>
  )
}

/**
 * Thẻ số liệu thống kê: nhãn + giá trị lớn + icon tông nhạt.
 */
export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = 'stone',
}: {
  label: ReactNode
  value: ReactNode
  icon?: string
  hint?: ReactNode
  tone?: 'stone' | 'amber' | 'green' | 'red' | 'blue'
}) {
  const tones: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-sky-50 text-sky-600',
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200/70">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <UiIcon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
        <p className="text-xl font-semibold leading-tight text-stone-900 tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-stone-400">{hint}</p> : null}
      </div>
    </div>
  )
}

/**
 * Dấu chấm trạng thái + nhãn — thay cho Tag màu chói mắt.
 */
export function StatusDot({ label, color, muted = false }: { label: ReactNode; color: string; muted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${muted ? 'opacity-60' : ''}`}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm text-stone-600">{label}</span>
    </span>
  )
}

/**
 * Trạng thái trống có hướng dẫn hành động.
 * icon dùng tên có sẵn trong UiIcon (inbox, search, fire...).
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string
  title: ReactNode
  hint?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-stone-50 text-stone-300">
        <UiIcon name={icon} size={26} />
      </span>
      <p className="font-medium text-stone-700">{title}</p>
      {hint ? <p className="mt-1 max-w-md text-sm text-stone-400">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

/**
 * Khung xương loading cho bảng — thay cho spinner toàn màn.
 */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-6">
      <div className="mb-6 hidden gap-3 md:flex">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 flex-1 animate-pulse rounded-full bg-stone-100" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2 w-6 flex-none animate-pulse rounded-full bg-stone-100" />
            <div className="h-2 flex-1 animate-pulse rounded-full bg-stone-100" style={{ width: `${85 - (i % 5) * 8}%` }} />
            <div className="h-2 w-24 flex-none animate-pulse rounded-full bg-stone-100" />
            <div className="h-2 w-16 flex-none animate-pulse rounded-full bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Section có tiêu đề + nội dung — dùng để chặn các khối trong trang admin.
 */
export function PageSection({
  title,
  subtitle,
  extra,
  children,
  className,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mb-6 rounded-2xl bg-white p-6 ring-1 ring-stone-200/70 ${className ?? ''}`}>
      {(title || extra) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-stone-800">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p> : null}
          </div>
          {extra ? <div className="flex shrink-0 items-center gap-2">{extra}</div> : null}
        </div>
      )}
      {children}
    </div>
  )
}
