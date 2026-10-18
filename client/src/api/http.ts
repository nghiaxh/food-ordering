import axios from 'axios'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
})

// Gắn token cho các request đã đăng nhập; các API công khai vẫn dùng chung interceptor này.
// Đọc cả hai kho lưu trữ vì đăng nhập không chọn "ghi nhớ" sẽ để token ở sessionStorage.
http.interceptors.request.use((config) => {
  const raw =
    localStorage.getItem('auth') ??
    sessionStorage.getItem('auth')
  if (raw) {
    const { token } = JSON.parse(raw) as { token: string }
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !location.pathname.startsWith('/login')) {
      localStorage.removeItem('auth')
      sessionStorage.removeItem('auth')
      location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default http