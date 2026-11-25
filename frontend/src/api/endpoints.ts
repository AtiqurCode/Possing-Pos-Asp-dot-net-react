import api from './client'
import type {
  Category,
  Customer,
  DashboardSummary,
  InventorySummary,
  Product,
  ReportAnalytics,
  Sale,
  SaleListItem,
  StockMovement,
  StockMovementType,
  StoreSettings,
  SubCategory,
  User,
} from '../types'

export const authApi = {
  login: async (username: string, password: string) => {
    const { data } = await api.post<{ token: string; user: User }>('/auth/login', { username, password })
    return data
  },
  me: async () => {
    const { data } = await api.get<User>('/auth/me')
    return data
  },
}

export const dashboardApi = {
  summary: async () => {
    const { data } = await api.get<DashboardSummary>('/dashboard/summary')
    return data
  },
}

export const categoriesApi = {
  list: async () => {
    const { data } = await api.get<Category[]>('/categories')
    return data
  },
  create: async (name: string) => {
    const { data } = await api.post<Category>('/categories', { name })
    return data
  },
  update: async (id: string, name: string) => {
    const { data } = await api.put<Category>(`/categories/${id}`, { name })
    return data
  },
  remove: async (id: string) => {
    await api.delete(`/categories/${id}`)
  },
}

export const subCategoriesApi = {
  list: async (categoryId?: string) => {
    const { data } = await api.get<SubCategory[]>('/subcategories', {
      params: categoryId ? { categoryId } : undefined,
    })
    return data
  },
  create: async (categoryId: string, name: string) => {
    const { data } = await api.post<SubCategory>('/subcategories', { categoryId, name })
    return data
  },
  update: async (id: string, categoryId: string, name: string) => {
    const { data } = await api.put<SubCategory>(`/subcategories/${id}`, { categoryId, name })
    return data
  },
  remove: async (id: string) => {
    await api.delete(`/subcategories/${id}`)
  },
}

export const productsApi = {
  list: async (params?: { search?: string; categoryId?: string; lowStockOnly?: boolean }) => {
    const { data } = await api.get<Product[]>('/products', { params })
    return data
  },
  byCode: async (code: string) => {
    const { data } = await api.get<Product>(`/products/by-code/${encodeURIComponent(code)}`)
    return data
  },
  create: async (payload: {
    sku?: string
    name: string
    description?: string
    price: number
    quantity: number
    minStockLevel: number
    subCategoryId: string
    isActive?: boolean
  }) => {
    const { data } = await api.post<Product>('/products', payload)
    return data
  },
  update: async (
    id: string,
    payload: {
      sku: string
      name: string
      description?: string
      price: number
      quantity: number
      minStockLevel: number
      subCategoryId: string
      isActive: boolean
    },
  ) => {
    const { data } = await api.put<Product>(`/products/${id}`, payload)
    return data
  },
  remove: async (id: string) => {
    await api.delete(`/products/${id}`)
  },
  patchStock: async (id: string, price: number, quantity: number) => {
    const { data } = await api.patch<Product>(`/products/${id}/stock`, { price, quantity })
    return data
  },
  uploadImage: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post<Product>(`/products/${id}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
}

export const inventoryApi = {
  movements: async (params?: {
    productId?: string
    type?: StockMovementType
    from?: string
    to?: string
    take?: number
  }) => {
    const { data } = await api.get<StockMovement[]>('/inventory/movements', { params })
    return data
  },
  summary: async (productId?: string) => {
    const { data } = await api.get<InventorySummary>('/inventory/summary', {
      params: productId ? { productId } : undefined,
    })
    return data
  },
  receive: async (payload: { productId: string; quantity: number; note?: string }) => {
    const { data } = await api.post<Product>('/inventory/receive', payload)
    return data
  },
  missing: async (payload: { productId: string; quantity: number; note?: string }) => {
    const { data } = await api.post<Product>('/inventory/missing', payload)
    return data
  },
}

export const customersApi = {
  list: async (search?: string) => {
    const { data } = await api.get<Customer[]>('/customers', { params: search ? { search } : undefined })
    return data
  },
  lookup: async (mobile: string) => {
    const { data } = await api.get<Customer>('/customers/lookup', { params: { mobile } })
    return data
  },
  upsert: async (name: string, mobile: string) => {
    const { data } = await api.post<Customer>('/customers', { name, mobile })
    return data
  },
}

export const settingsApi = {
  store: async () => {
    const { data } = await api.get<StoreSettings>('/settings/store')
    return data
  },
  updateStore: async (payload: StoreSettings) => {
    const { data } = await api.put<StoreSettings>('/settings/store', payload)
    return data
  },
}

export const salesApi = {
  list: async (params?: { from?: string; to?: string }) => {
    const { data } = await api.get<SaleListItem[]>('/sales', { params })
    return data
  },
  get: async (id: string) => {
    const { data } = await api.get<Sale>(`/sales/${id}`)
    return data
  },
  create: async (payload: {
    items: { productId: string; qty: number }[]
    discountType: 'Amount' | 'Percent'
    discountValue: number
    paymentMethod: string
    customerName?: string
    customerMobile?: string
  }) => {
    const { data } = await api.post<Sale>('/sales', payload)
    return data
  },
}

export const reportsApi = {
  analytics: async (year: number, month: number) => {
    const { data } = await api.get<ReportAnalytics>('/reports/analytics', { params: { year, month } })
    return data
  },
  download: async (url: string, filename: string) => {
    const { data } = await api.get(url.replace(/^\/api/, ''), {
      responseType: 'blob',
      baseURL: import.meta.env.VITE_API_URL || '/api',
    })
    const blobUrl = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(blobUrl)
  },
}
