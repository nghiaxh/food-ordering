export interface FoodChip {
  label: string
  className: string
}

const SPICY = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay']

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
  if (food.category?.name) chips.push({ label: food.category.name, className: 'bg-amber-50 text-amber-700' })

  const spicyIndex = Math.min(Math.max(food.spicyLevel, 0), SPICY.length - 1)
  chips.push({ label: SPICY[spicyIndex], className: SPICY_CLASSES[spicyIndex] })
  chips.push({ label: `Phục vụ ${food.servingSize} người`, className: 'bg-sky-50 text-sky-700' })

  const dietary = food.dietaryTags ? food.dietaryTags.split(',').map((t) => t.trim()).filter(Boolean) : []
  const hasChili = dietary.some((t) => t.toLowerCase().includes('ớt'))
  const otherTags = dietary.filter((t) => !t.toLowerCase().includes('ớt'))
  if (hasChili) chips.push({ label: 'Có ớt', className: 'bg-red-50 text-red-600' })
  for (const tag of otherTags) chips.push({ label: tag, className: 'bg-emerald-50 text-emerald-700' })

  return chips
}