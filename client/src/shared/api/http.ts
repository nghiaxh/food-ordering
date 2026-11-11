import axios from 'axios'

// Moi request di qua lop HTTP nay de viec gan token va xu ly 401 nhat quan.
// HTTP client: gan Bearer token tu localStorage/sessionStorage, xu ly 401 toan cuc.
const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
})

// Gan token cho cac request da dang nhap; cac API cong khai van dung chung interceptor nay.
// Doc ca hai kho luu tru vi dang nhap khong chon "ghi nho" se de token o sessionStorage.
http.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth') ?? sessionStorage.getItem('auth')
  if (raw) {
    try {
      const { token } = JSON.parse(raw) as { token: string }
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {
      // Storage hong khong duoc lam hong moi request; don sach va coi nhu chua dang nhap.
      localStorage.removeItem('auth')
      sessionStorage.removeItem('auth')
    }
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 nghia la phien khong con hop le; don token va dua nguoi dung ve dang nhap.
    if (err.response?.status === 401 && !location.pathname.startsWith('/login')) {
      localStorage.removeItem('auth')
      sessionStorage.removeItem('auth')
      location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default http
