import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '../api/endpoints'
import type { StoreSettings } from '../types'

const defaults: StoreSettings = {
  name: 'Possing Store',
  address: '',
  phone: '',
  vatPercent: 0,
  currency: 'BDT',
  taxMode: 'Exclusive',
}

/** Shared store settings (currency, VAT, tax mode). */
export function useStoreSettings() {
  const query = useQuery({
    queryKey: ['store-settings'],
    queryFn: settingsApi.store,
    staleTime: 60_000,
  })

  const store = query.data ?? defaults
  return {
    ...query,
    store,
    currency: store.currency || 'BDT',
    vatPercent: store.vatPercent,
    inclusive: store.taxMode === 'Inclusive',
  }
}

export function money(currency: string, amount: number, digits = 2) {
  return `${currency} ${amount.toFixed(digits)}`
}
