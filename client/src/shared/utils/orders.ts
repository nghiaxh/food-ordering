import type { Order, OrderStatus } from '@/shared/types'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chß╗¥ x├íc nhß║¡n',
  CONFIRMED: '─É├ú x├íc nhß║¡n',
  PREPARING: '─Éang vß║¡n chuyß╗ân',
  COMPLETED: '─É├ú giao',
  CANCELLED: '─É├ú hß╗ºy',
}

/**
 * Nh├ún ph╞░╞íng thß╗⌐c thanh to├ín. Hß╗ç thß╗æng chß╗ë hß╗ù trß╗ú hai c├ích trß║ú tiß╗ün: tiß╗ün mß║╖t khi nhß║¡n
 * (`COD`) v├á qu├⌐t m├ú QR (`QR`). Nh├ún nß║▒m ß╗ƒ mß╗Öt chß╗ù ─æß╗â trang kh├ích v├á trang quß║ún trß╗ï hiß╗çn
 * giß╗æng nhau, kh├┤ng lß╗Ö m├ú th├┤i ra giao diß╗çn.
 */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: 'Tiß╗ün mß║╖t khi nhß║¡n',
  QR: 'Thanh to├ín bß║▒ng m├ú QR',
}

/** C├íc ph╞░╞íng thß╗⌐c thanh to├ín m├á kh├ích v├á quß║ún trß╗ï vi├¬n chß╗ìn khi ─æß║╖t m├│n. */
export const PAYMENT_METHODS = [
  { label: PAYMENT_METHOD_LABEL.COD, value: 'COD' },
  { label: PAYMENT_METHOD_LABEL.QR, value: 'QR' },
]

/**
 * M├ú ho├í ─æ╞ín hiß╗ân thß╗ï cho kh├ích v├á quß║ún trß╗ï vi├¬n: tiß╗ün tß╗æ `FO` k├¿m id ─æß╗çm 4 chß╗» sß╗æ.
 * Mß╗Öt chß╗ù sinh m├ú ─æß╗â hai b├¬n kh├┤ng lß╗çch nhau; id do server cß║Ñp n├¬n kh├┤ng cß║ºn ─æß╗òi dß╗» liß╗çu.
 */
export function orderCode(id: number): string {
  return `FO-${String(id).padStart(4, '0')}`
}

/** Tr├¼nh tß╗▒ quy tr├¼nh cß╗ºa mß╗Öt ─æ╞ín; Hß╗ºy l├á nh├ính ngo├ái n├¬n kh├┤ng nß║▒m trong d├úy n├áy. */
export const ORDER_FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'COMPLETED']

/** Trß║íng th├íi kß║┐ tiß║┐p hß╗úp lß╗ç, hoß║╖c null khi ─æ╞ín ─æ├ú chß╗æt. Server c┼⌐ng kiß╗âm tra lß║íi quy tß║»c n├áy. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(status)
  if (i < 0 || i === ORDER_FLOW.length - 1) return null
  return ORDER_FLOW[i + 1]
}

/** C├íc trß║íng th├íi m├á quß║ún trß╗ï vi├¬n c├│ thß╗â chuyß╗ân tß╗¢i tß╗½ trß║íng th├íi hiß╗çn tß║íi. */
export function allowedNextStatuses(status: OrderStatus): OrderStatus[] {
  const next = nextStatus(status)
  return next ? [next, 'CANCELLED'] : []
}

/**
 * Kh├ích tß╗▒ hß╗ºy ─æ╞░ß╗úc ─æ╞ín chß╗ë khi c├▓n chß╗¥ x├íc nhß║¡n v├á ch╞░a thanh to├ín; true khi ─æß╗º ─æiß╗üu kiß╗çn.
 * OrderService.cancel ├íp c├╣ng r├áng buß╗Öc ß╗ƒ server n├¬n client chß╗ë ß║⌐n n├║t UX, kh├┤ng quyß║┐t ─æß╗ïnh ri├¬ng.
 */
export function canCancelOrder(order: Pick<Order, 'status' | 'paymentStatus'>): boolean {
  return order.status === 'PENDING' && order.paymentStatus !== 'PAID'
}
