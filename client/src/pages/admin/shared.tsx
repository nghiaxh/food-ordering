import type { ReactNode } from 'react'
import UiIcon from '../../components/UiIcon'

/**
 * Card nền trắng dùng chung cho admin. Giữ tên PageCard để đúng import hiện có.
 */
export function PageCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70 ${
        className ?? ''
      }`}
    >
      {children}
    </div>
  )
}

/**
 * Header chuẩn cho trang admin: tiêu đề + mô tả trái, cụm hành động phải.
 * Tạo sự đồng nhất — thay cho 4 kiểu header lỏng lẻo hiện tại.
 */
export function PageHeader({
  title,
  subtitle,
  extra,
}: {
  title: ReactNode
  subtitle?: ReactNode
  extra?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-stone-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
      </div>
      {extra ? <div className="flex shrink-0 items-center gap-2">{extra}</div> : null}
    </div>
  )
}

/**
 * Card trắng chứa 1 section nội dung: header (title/subtitle + extra) + body.
 */
export function PageSection({
  title,
  subtitle,
  extra,
  children,
  className,
  bodyClassName = 'p-5',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <PageCard className={className}>
      {(title || extra) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div className="min-w-0">
            {title ? <h3 className="font-semibold text-stone-800">{title}</h3> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p> : null}
          </div>
          {extra ? <div className="flex shrink-0 items-center gap-2">{extra}</div> : null}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </PageCard>
  )
}

export type Tone = 'stone' | 'amber' | 'green' | 'red' | 'blue' | 'purple'

const toneClass: Record<Tone, string> = {
  stone: 'bg-stone-100 text-stone-500',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-500',
  blue: 'bg-sky-100 text-sky-700',
  purple: 'bg-violet-100 text-violet-600',
}

const toneIcon: Record<Tone, string> = {
  stone: 'inbox',
  amber: 'star-fill',
  green: 'check-circle',
  red: 'fire',
  blue: 'shopping-cart',
  purple: 'users',
}

/** Thẻ số liệu thống kê admin (tổng đơn, doanh thu...) — client-side. */
export function StatCard({
  label,
  value,
  hint,
  tone = 'stone',
  icon,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
  icon?: string
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/60">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${toneClass[tone]}`}>
        <UiIcon name={icon ?? toneIcon[tone]} size={19} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-stone-400">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold tabular-nums tracking-tight text-stone-900">
          {value}
        </p>
        {hint ? <p className="truncate text-xs text-stone-400">{hint}</p> : null}
      </div>
    </div>
  )
}

/** Chấm trạng thái + nhãn — thay thế Tag rực màu AntD mặc định. */
export function StatusDot({
  color,
  label,
  muted = false,
}: {
  color: string
  label: ReactNode
  muted?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className={`text-sm ${muted ? 'text-stone-400' : 'text-stone-700'}`}>{label}</span>
    </span>
  )
}

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
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-stone-50 text-stone-300">
        <UiIcon name={icon} size={26} />
      </span>
      <p className="font-medium text-stone-700">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-stone-400">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function TableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="p-1">
      <div className="mb-6 hidden gap-4 md:flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 flex-1 animate-pulse rounded-full bg-stone-100"
            style={{ width: `${30 + i * 10}%` }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-stone-100 py-2.5">
          <span className="h-8 w-8 flex-none animate-pulse rounded-lg bg-stone-100" />
          <span
            className="h-2.5 flex-1 animate-pulse rounded-full bg-stone-100"
            style={{ width: `${80 - (i % 4) * 14}%` }}
          />
          <span className="h-2.5 w-20 flex-none animate-pulse rounded-full bg-stone-100" />
          <span className="h-5 w-14 flex-none animate-pulse rounded-full bg-stone-100" />
        </div>
      ))}
    </div>
  )
}
