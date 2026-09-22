import { Image } from 'antd'
import UiIcon from './UiIcon'

interface UiImgProps {
  src?: string | null
  alt?: string
  imgClass?: string
  className?: string
  preview?: boolean
}

export default function UiImg({
  src = null,
  alt = '',
  imgClass = 'h-full w-full object-cover',
  className,
  preview = false,
}: UiImgProps) {
  if (!src) {
    return (
      <div className={`grid place-items-center text-stone-200 ${imgClass}`}>
        <UiIcon name="image" className="text-2xl" />
      </div>
    )
  }
  const mergedClass = className ? `${imgClass} ${className}` : imgClass
  return (
    <Image
      src={src}
      alt={alt}
      loading="lazy"
      fallback="/images/placeholder.svg"
      preview={preview}
      classNames={{ root: 'block', image: mergedClass }}
    />
  )
}