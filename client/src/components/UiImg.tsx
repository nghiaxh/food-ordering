import { Image } from 'antd'
import UiIcon from './UiIcon'

interface UiImgProps {
  src?: string | null
  alt?: string
  /** Classes cho wrapper (kích thước, aspect, bo góc, hover...) */
  className?: string
  /** Classes cho thẻ <img> (object-fit, filter...) — mặc định CSS ép lấp đầy */
  imgClass?: string
  preview?: boolean
}

export default function UiImg({
  src = null,
  alt = '',
  className = 'h-full w-full',
  imgClass = '',
  preview = false,
}: UiImgProps) {
  if (!src) {
    return (
      <div className={`grid place-items-center text-stone-200 ${className}`}>
        <UiIcon name="image" className="text-2xl" />
      </div>
    )
  }
  return (
    <Image
      src={src}
      alt={alt}
      loading="lazy"
      fallback="/images/placeholder.svg"
      preview={preview}
      classNames={{ root: `block shrink-0 overflow-hidden ${className}`, image: imgClass }}
    />
  )
}