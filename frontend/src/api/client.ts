import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('possing_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('possing_token')
      localStorage.removeItem('possing_user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default api

export function getErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string })?.message || error.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}
