interface Props {
  title: string
  subtitle?: string
  align?: 'center' | 'left'
}

export default function SectionHeader({ title, subtitle, align = 'center' }: Props) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : 'text-left'
  return (
    <div className={`max-w-2xl ${alignCls} mb-10`}>
      <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
        FoodOrdering
      </span>
      <h2 className="mt-3 text-3xl font-bold text-stone-900">{title}</h2>
      {subtitle && <p className="mt-3 text-stone-500">{subtitle}</p>}
    </div>
  )
}