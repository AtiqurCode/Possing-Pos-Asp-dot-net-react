/** Mirror of SaleService.ComputeTax — keep UI totals in sync with the API. */
export function computePosTotals(
  subTotal: number,
  discountPct: number,
  vatPercent: number,
  inclusive: boolean,
) {
  const discountAmount = Math.round(subTotal * (discountPct / 100) * 100) / 100
  const afterDiscount = Math.max(0, subTotal - discountAmount)

  let taxAmount = 0
  if (vatPercent > 0) {
    taxAmount = inclusive
      ? Math.round((afterDiscount * vatPercent) / (100 + vatPercent) * 100) / 100
      : Math.round(afterDiscount * (vatPercent / 100) * 100) / 100
  }

  const total = inclusive ? afterDiscount : afterDiscount + taxAmount
  return { discountAmount, afterDiscount, taxAmount, total }
}

export function parseQtyCode(text: string): { qty: number; lookup: string } | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const mult = trimmed.match(/^(\d+)\*(.+)$/)
  if (mult) {
    return {
      qty: Math.max(1, Number(mult[1]) || 1),
      lookup: mult[2].trim(),
    }
  }

  return { qty: 1, lookup: trimmed }
}
