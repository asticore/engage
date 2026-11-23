'use client'

import { createContext, useContext, type ReactNode } from 'react'

import { DEFAULT_SHOP_BASE, shopPath } from './permalinks'

const ShopBaseContext = createContext<string>(DEFAULT_SHOP_BASE)

/** Gives the shop address (SEO settings, Permalinks) to client components below it. Without a provider it is /shop. */
export function ShopBaseProvider({ base, children }: { base: string; children: ReactNode }) {
  return <ShopBaseContext.Provider value={base}>{children}</ShopBaseContext.Provider>
}

/** `const shop = useShopPath(); shop('/mug')` gives /store/mug when the shop address is store. `shop()` is the shop itself. */
export function useShopPath(): (rest?: string) => string {
  const base = useContext(ShopBaseContext)
  return (rest = '') => shopPath(base, rest)
}
