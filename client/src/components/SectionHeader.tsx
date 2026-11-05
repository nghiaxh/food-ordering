interface Props {
  title: string
  subtitle?: string
  align?: 'center' | 'left'
  eyebrow?: string
}

export default function SectionHeader({ title, subtitle, align = 'center', eyebrow }: Props) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : 'text-left'
  return (
    <div className={`max-w-2xl ${alignCls} mb-6`}>
      {eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">{eyebrow}</span>
      )}
      <h2 className="mt-1.5 text-xl font-bold tracking-tight text-stone-900">{title}</h2>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-stone-500">{subtitle}</p>}
    </div>
  )
}