interface Props {
  title: string
  subtitle?: string
  align?: 'center' | 'left'
  eyebrow?: string
}

export default function SectionHeader({ title, subtitle, align = 'center', eyebrow = 'FoodOrdering' }: Props) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : 'text-left'
  return (
    <div className={`max-w-2xl ${alignCls} mb-10`}>
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900">{title}</h2>
      {subtitle && <p className="mt-3 leading-relaxed text-stone-500">{subtitle}</p>}
    </div>
  )
}