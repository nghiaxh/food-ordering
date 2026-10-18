import { Button, type ButtonProps } from 'antd'

/**
 * Nút bấm dùng chung toàn hệ thống. Chỉ có 6 dạng để giao diện không rối:
 *
 * - `primary`    hành động chính của khối giao diện (Thêm vào giỏ, Lưu), cao 44px
 * - `primary-lg` đúng 1 nút trên mỗi màn hình, dùng làm bước cuối (Xác nhận đặt món), cao 52px
 * - `default`    hành động phụ (Sửa, Đặt lại, Thanh toán), cao 44px
 * - `danger`     hành động không thể hoàn tác dễ (Xóa, Hủy đơn), cao 44px
 * - `icon`       nút tròn trong thanh công cụ, luôn kèm aria-label, cao 40px
 * - `fab`        nút tròn nổi duy nhất của màn hình (mở chatbot), cao 64px
 *
 * Kích thước ghi bằng tiền tố `!` vì AntD nạp CSS-in-JS sau Tailwind và ghi đè được
 * chiều cao của nút. Dùng class thường sẽ bị bỏ qua, đã xảy ra với nút chatbot một lần.
 *
 * Tên prop là `kind` vì AntD đã dùng `variant` cho kiểu nút (`solid`, `outlined`, `link`).
 */
export type UiButtonKind = 'primary' | 'primary-lg' | 'default' | 'danger' | 'icon' | 'fab'

interface Preset {
  type?: ButtonProps['type']
  danger?: boolean
  shape?: ButtonProps['shape']
  className: string
}

const PRESETS: Record<UiButtonKind, Preset> = {
  primary: { type: 'primary', className: '!rounded-xl' },
  'primary-lg': { type: 'primary', className: '!rounded-xl !text-base !font-semibold' },
  default: { className: '!rounded-xl !font-medium' },
  danger: { danger: true, className: '!rounded-xl !font-medium' },
  icon: { shape: 'circle', className: '' },
  fab: { type: 'primary', shape: 'circle', className: '!text-2xl !shadow-lg !shadow-amber-900/25' },
}

/**
 * Chiều cao tách riêng khỏi kiểu dáng, và mỗi cỡ nằm ở một ô riêng. Gộp chung rồi ghi đè
 * bằng class khác sẽ không ăn: hai class `!h-*` có cùng độ ưu tiên nên Tailwind quyết định
 * theo thứ tự sinh CSS, không phải theo thứ tự truyền vào. Ghi đè kiểu vậy đã làm nút trong
 * thanh điều hướng không nhỏ lại dù đã truyền class.
 */
const HEIGHTS: Record<UiButtonKind, { normal: string; small: string }> = {
  primary: { normal: '!h-11', small: '!h-9' },
  'primary-lg': { normal: '!h-13', small: '!h-9' },
  default: { normal: '!h-11', small: '!h-9' },
  danger: { normal: '!h-11', small: '!h-9' },
  icon: { normal: '!h-10 !w-10', small: '!h-9 !w-9' },
  fab: { normal: '!h-16 !w-16', small: '!h-16 !w-16' },
}

interface UiButtonProps extends Omit<ButtonProps, 'type' | 'shape' | 'variant'> {
  kind?: UiButtonKind
}

export default function UiButton({ kind = 'default', size = 'large', danger, className, ...rest }: UiButtonProps) {
  const preset = PRESETS[kind]
  return (
    <Button
      size={size}
      danger={danger ?? preset.danger}
      type={preset.type}
      shape={preset.shape}
      {...rest}
      className={[preset.className, HEIGHTS[kind][size === 'small' ? 'small' : 'normal'], className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}