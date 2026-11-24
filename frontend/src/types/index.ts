export type User = {
  id: string
  username: string
  role: 'Admin' | 'Cashier'
}

export type Category = {
  id: string
  name: string
  subCategoryCount: number
}

export type SubCategory = {
  id: string
  categoryId: string
  categoryName: string
  name: string
  productCount: number
}

export type Product = {
  id: string
  sku: string
  sequenceNumber: number
  name: string
  description: string
  price: number
  quantity: number
  minStockLevel: number
  imageUrl?: string | null
  subCategoryId: string
  subCategoryName: string
  categoryId: string
  categoryName: string
  isActive: boolean
  isLowStock: boolean
}

export type Customer = {
  id: string
  name: string
  mobile: string
  membershipCode: string
  visitCount: number
  totalSpent: number
  createdAt: string
}

export type SaleListItem = {
  id: string
  invoiceNo: string
  cashier: string
  customerName?: string | null
  customerMobile?: string | null
  total: number
  discount: number
  paymentMethod: string
  createdAt: string
  itemCount: number
}

export type SaleItem = {
  id: string
  productId: string
  productName: string
  sku: string
  sequenceNumber: number
  qty: number
  unitPrice: number
  lineTotal: number
}

export type Sale = {
  id: string
  invoiceNo: string
  cashier: string
  customerId?: string | null
  customerName?: string | null
  customerMobile?: string | null
  subTotal: number
  discountType: 'Amount' | 'Percent'
  discountValue: number
  discount: number
  total: number
  paymentMethod: string
  createdAt: string
  items: SaleItem[]
}

export type ChartPoint = { label: string; value: number }
export type NamedCount = { name: string; count: number; amount: number }

export type DashboardSummary = {
  todaySalesTotal: number
  todaySalesCount: number
  weekSalesTotal: number
  lowStockCount: number
  lowStockProducts: {
    id: string
    name: string
    sku: string
    sequenceNumber: number
    quantity: number
    minStockLevel: number
  }[]
  last7DaysSales: ChartPoint[]
  todayPaymentBreakdown: NamedCount[]
}

export type ReportAnalytics = {
  year: number
  month: number
  totalSales: number
  transactionCount: number
  averageTicket: number
  totalDiscount: number
  dailySales: ChartPoint[]
  paymentBreakdown: NamedCount[]
  categoryBreakdown: NamedCount[]
  topProducts: NamedCount[]
}

export type CartLine = {
  product: Product
  qty: number
}

export type DiscountType = 'Amount' | 'Percent'
