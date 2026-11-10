import axios from 'axios'

// Mọi request đi qua lớp HTTP này để việc gắn token và xử lý 401 nhất quán.
const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
})

// Gắn token cho các request đã đăng nhập; các API công khai vẫn dùng chung interceptor này.
// Đọc cả hai kho lưu trữ vì đăng nhập không chọn "ghi nhớ" sẽ để token ở sessionStorage.
http.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth') ?? sessionStorage.getItem('auth')
  if (raw) {
    try {
      const { token } = JSON.parse(raw) as { token: string }
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {
      // Storage hỏng không được làm hỏng mọi request; dọn sạch và coi như chưa đăng nhập.
      localStorage.removeItem('auth')
      sessionStorage.removeItem('auth')
    }
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 nghĩa là phiên không còn hợp lệ; dọn token và đưa người dùng về đăng nhập.
    if (err.response?.status === 401 && !location.pathname.startsWith('/login')) {
      localStorage.removeItem('auth')
      sessionStorage.removeItem('auth')
      location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default http
