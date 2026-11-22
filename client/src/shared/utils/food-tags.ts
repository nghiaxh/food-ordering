export interface FoodChip {
  label: string
  className: string
}

export const SPICY_LEVELS = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay']

export function spicyLabel(level: number): string {
  return SPICY_LEVELS[Math.min(Math.max(level, 0), SPICY_LEVELS.length - 1)]
}

// Chuan hoa nhan uu dai thanh cum tu ngan gon tren giao dien.
export function discountText(label?: string | null): string | null {
  if (!label) return null
  if (label.includes('may mắn')) return 'Ưu đãi hôm nay'
  if (label.includes('Cuối tuần')) return 'Ưu đãi cuối tuần'
  return label
}

const SPICY_CLASSES = [
  'bg-stone-100 text-stone-600',
  'bg-orange-50 text-orange-700',
  'bg-red-50 text-red-600',
  'bg-red-100 text-red-700',
]

interface ChipSource {
  category: { name: string } | null
  spicyLevel: number
  servingSize: number
  dietaryTags: string
}

export function foodChips(food: ChipSource): FoodChip[] {
  const chips: FoodChip[] = []
  if (food.category?.name) chips.push({ label: food.category.name, className: 'bg-orange-50 text-orange-700' })

  const spicyIndex = Math.min(Math.max(food.spicyLevel, 0), SPICY_LEVELS.length - 1)
  chips.push({ label: SPICY_LEVELS[spicyIndex], className: SPICY_CLASSES[spicyIndex] })
  chips.push({ label: `Phục vụ ${food.servingSize} người`, className: 'bg-sky-50 text-sky-700' })

  const dietary = food.dietaryTags ? food.dietaryTags.split(',').map((t) => t.trim()).filter(Boolean) : []
  const hasChili = dietary.some((t) => t.toLowerCase().includes('ớt'))
  const otherTags = dietary.filter((t) => !t.toLowerCase().includes('ớt'))
  if (hasChili) chips.push({ label: 'Có ớt', className: 'bg-red-50 text-red-600' })
  for (const tag of otherTags) chips.push({ label: tag, className: 'bg-emerald-50 text-emerald-700' })

  return chips
}