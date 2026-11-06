import type { OrderStatus } from '../types'
import { ORDER_FLOW, ORDER_STATUS_LABEL } from '../utils/orders'
import UiIcon from './UiIcon'

/**
 * Tiến trình đơn tự vẽ thay cho Steps của AntD: Steps cắt nhãn ở màn 360px và luôn hiện
 * đủ bốn bước kể cả khi đơn đã hủy. Ở đây chỉ đánh dấu bước hiện tại, không bịa mốc giờ.
 */
export default function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') {
    return (
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
        <UiIcon name="times" size={13} />
        Đơn đã hủy
      </p>
    )
  }

  const current = ORDER_FLOW.indexOf(status)

  return (
    <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Tiến trình đơn hàng">
      {ORDER_FLOW.map((step, index) => {
        const done = index < current || status === 'COMPLETED'
        const active = index === current && status !== 'COMPLETED'
        return (
          <li key={step} className="flex flex-col items-center gap-1 text-center">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${
                done
                  ? 'bg-amber-700 text-white'
                  : active
                    ? 'bg-white text-amber-800 ring-2 ring-amber-600'
                    : 'bg-stone-100 text-stone-500'
              }`}
            >
              {done ? <UiIcon name="check" size={12} /> : index + 1}
            </span>
            <span
              className={`text-[10px] leading-tight sm:text-xs ${
                active ? 'font-semibold text-amber-800' : done ? 'text-stone-700' : 'text-stone-500'
              }`}
            >
              {ORDER_STATUS_LABEL[step]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
