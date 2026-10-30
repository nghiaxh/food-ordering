import type { ReactNode } from 'react'
import { Modal } from 'antd'

/**
 * Modal chứa Form: bấm Lưu vẫn chạy `form.submit()` qua onSubmit. Gom bản lặp của
 * các trang quản trị và CartPage để mọi hộp biểu mẫu có cùng nút Lưu/Hủy + loading.
 */
export default function FormModal(props: {
  title: ReactNode
  open: boolean
  onClose: () => void
  onSubmit: () => void
  saving?: boolean
  width?: number
  children: ReactNode
}) {
  return (
    <Modal
      title={props.title}
      open={props.open}
      onCancel={props.onClose}
      onOk={props.onSubmit}
      confirmLoading={props.saving}
      okText="Lưu"
      cancelText="Hủy"
      width={props.width}
    >
      {props.children}
    </Modal>
  )
}
