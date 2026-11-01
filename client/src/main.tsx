import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { message } from 'antd'
import '@fontsource-variable/inter'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import '@fontsource/be-vietnam-pro/800.css'
import './index.css'
import App from './App'

message.config({ maxCount: 1 })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)