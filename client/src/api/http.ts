import axios from 'axios'

// Mọi request đi qua lớp HTTP này để việc gắn token và xử lý 401 nhất quán.
const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
})

// Gắn token cho các request đã đăng nhập; các API công khai vẫn dùng chung interceptor này.
http.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth')
  if (raw) {
    const { token } = JSON.parse(raw) as { token: string }
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 nghĩa là phiên không còn hợp lệ; dọn token và đưa người dùng về đăng nhập.
    if (err.response?.status === 401 && !location.pathname.startsWith('/login')) {
      localStorage.removeItem('auth')
      location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default http