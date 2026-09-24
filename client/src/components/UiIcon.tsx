import type { CSSProperties, ComponentType } from 'react'
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BellOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileTextOutlined,
  FireOutlined,
  HomeOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  LockOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuOutlined,
  MessageOutlined,
  PhoneOutlined,
  PictureOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  StarFilled,
  StarOutlined,
  TagOutlined,
  TeamOutlined,
  UploadOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons'

interface UiIconProps {
  name: string
  size?: string | number
  color?: string
  className?: string
}

type IconComponent = ComponentType<{ className?: string; style?: CSSProperties }>

const iconMap: Record<string, IconComponent | undefined> = {
  'arrow-left': ArrowLeftOutlined,
  'arrow-right': ArrowRightOutlined,
  bell: BellOutlined,
  check: CheckOutlined,
  'check-circle': CheckCircleOutlined,
  clock: ClockCircleOutlined,
  delete: DeleteOutlined,
  edit: EditOutlined,
  envelope: MailOutlined,
  'exclamation-circle': InfoCircleOutlined,
  eye: EyeOutlined,
  'eye-slash': EyeInvisibleOutlined,
  file: FileTextOutlined,
  fire: FireOutlined,
  home: HomeOutlined,
  image: PictureOutlined,
  inbox: InboxOutlined,
  'map-marker': EnvironmentOutlined,
  menu: MenuOutlined,
  message: MessageOutlined,
  phone: PhoneOutlined,
  plus: PlusOutlined,
  search: SearchOutlined,
  send: SendOutlined,
  settings: SettingOutlined,
  'shopping-cart': ShoppingCartOutlined,
  'sign-out': LogoutOutlined,
  star: StarOutlined,
  'star-fill': StarFilled,
  tag: TagOutlined,
  'th-large': HomeOutlined,
  times: CloseOutlined,
  upload: UploadOutlined,
  user: UserOutlined,
  'user-add': UserAddOutlined,
  'user-lock': LockOutlined,
  users: TeamOutlined,
}

function resolveSize(size: string | number | undefined): string | undefined {
  if (size === undefined) return undefined
  if (typeof size === 'number') return `${size}px`
  if (/^\d+$/.test(size)) return `${size}px`
  return size
}

export default function UiIcon({ name, size, color, className }: UiIconProps) {
  const Icon = iconMap[name]
  if (!Icon) return null
  const fontSize = resolveSize(size)
  const style: CSSProperties = {
    ...(fontSize ? { fontSize } : {}),
    ...(color ? { color } : {}),
  }
  return <Icon className={className} style={style} />
}