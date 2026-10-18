import { useState } from 'react'
import { Button, Input, Upload, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { adminUploadImage } from '../api/api'
import { apiErrorMessage } from '../utils/api-error'
import UiImg from './UiImg'

interface ImageFieldProps {
  value?: string
  onChange?: (url: string) => void
  label?: string
}

/**
 * Ô nhập ảnh dùng chung cho biểu mẫu món ăn và danh mục: chọn tệp để tải lên máy chủ, hoặc dán
 * URL ngoài. Tải lên trả về URL tuyệt đối nên ảnh hiển thị được ở cả bản dev lẫn bản build.
 */
export default function ImageField({ value, onChange, label = 'URL Ảnh' }: ImageFieldProps) {
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ảnh vượt quá 2 MB')
      return
    }
    try {
      setUploading(true)
      const { url } = await adminUploadImage(file)
      onChange?.(url)
      message.success('Đã tải ảnh lên')
    } catch (e) {
      message.error(apiErrorMessage(e) ?? 'Tải ảnh thất bại')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-xs font-medium text-stone-400">{label}</label>
          <Input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder="https://..." allowClear />
        </div>
        <Upload
          accept="image/jpeg,image/png,image/webp"
          showUploadList={false}
          beforeUpload={(file) => {
            void upload(file)
            // Chặn Upload tự gửi lên lần nữa; ta gọi API riêng để kiểm soát lỗi.
            return false
          }}
        >
          <Button icon={<UploadOutlined />} loading={uploading}>
            Chọn ảnh
          </Button>
        </Upload>
      </div>
      <div className="mt-2">
        {value ? (
          <UiImg
            src={value}
            alt="Xem trước ảnh"
            className="aspect-[4/3] w-full max-w-xs rounded-xl border border-stone-100"
          />
        ) : (
          <div className="grid aspect-[4/3] w-full max-w-xs place-items-center rounded-xl border border-dashed border-stone-200 text-stone-300">
            <span className="text-xs">Chưa có ảnh</span>
          </div>
        )}
      </div>
    </div>
  )
}