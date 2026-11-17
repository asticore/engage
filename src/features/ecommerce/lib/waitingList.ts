/**
 * Waiting list with held places. Pure, no I/O. In "ordered" mode a restock does not email everyone at once:
 * the free places go to the people who signed up first, each for a limited hold, and a place nobody takes
 * passes to the next person in line. The database work lives in ../waitingList.ts.
 */

import { normalizeEmail } from './email'
import { effectiveStock } from './backInStock'
import { allowsBackorders, type StockFields } from '../stock'

export type WaitingListMode = 'all' | 'ordered'
export type WaitingListSettings = { mode: WaitingListMode; holdHours: number }

export const DEFAULT_HOLD_HOURS = 24
export const MAX_HOLD_HOURS = 24 * 14

/** Reads the storefront settings. Anything unknown means the original behaviour (email everyone). */
export function normaliseWaitingListSettings(storefront: unknown): WaitingListSettings {
  const s = (storefront ?? {}) as { waitingListMode?: unknown; waitingListHoldHours?: unknown }
  const hours = Number(s.waitingListHoldHours)
  const holdHours = Number.isFinite(hours) && hours >= 1 ? Math.min(Math.floor(hours), MAX_HOLD_HOURS) : DEFAULT_HOLD_HOURS
  return { mode: s.waitingListMode === 'ordered' ? 'ordered' : 'all', holdHours }
}

export type WaitRow = { id: number | string; email: string; variation?: string | null; status?: string | null; holdUntil?: string | null; createdAt?: string | null }

/** An offer still holds a place until its time is up. */
export function isHoldLive(row: WaitRow, now: Date): boolean {
  if (row.status !== 'offered' || !row.holdUntil) return false
  const until = Date.parse(row.holdUntil)
  return Number.isFinite(until) && until > now.getTime()
}

/** Places for sale right now: the managed quantity, or one when stock is a manual status. Never negative. */
export function freePlaces(stock: StockFields): number {
  if (!stock.manageStock) return stock.stockStatus === 'outofstock' ? 0 : 1
  if (allowsBackorders(stock)) return 0
  return Math.max(0, Math.floor(Number(stock.stockQty ?? 0)))
}

/** The variation's own figures, or the product's (as the storefront reads them). */
export function placesFor(variation: StockFields | null, product: StockFields): number {
  return freePlaces(variation ? effectiveStock(variation, product) : product)
}

const keyOf = (row: WaitRow): string => row.variation ?? ''

/** Places on this item that are held for someone else. `buyerEmail` is never counted against itself. */
export function heldForOthers(rows: WaitRow[], variation: string | null | undefined, buyerEmail: string | null | undefined, now: Date): number {
  const buyer = buyerEmail ? normalizeEmail(buyerEmail) : ''
  let held = 0
  for (const row of rows) {
    if (keyOf(row) !== (variation ?? '') || !isHoldLive(row, now)) continue
    if (buyer && normalizeEmail(row.email) === buyer) continue
    held += 1
  }
  return held
}

/**
 * The people to offer places to: pending sign-ups for this item in sign-up order, one place each, as many as
 * there are free places not already held. Several sign-ups from one person count once.
 */
export function pickOffers(rows: WaitRow[], variation: string, free: number, now: Date): WaitRow[] {
  const held = rows.filter((row) => keyOf(row) === variation && isHoldLive(row, now))
  let room = free - held.length
  if (room <= 0) return []
  const seen = new Set(held.map((row) => normalizeEmail(row.email)))
  const pending = rows
    .filter((row) => keyOf(row) === variation && (row.status ?? 'pending') === 'pending')
    .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || Number(a.id) - Number(b.id))
  const out: WaitRow[] = []
  for (const row of pending) {
    if (room <= 0) break
    const who = normalizeEmail(row.email)
    if (seen.has(who)) continue
    seen.add(who)
    out.push(row)
    room -= 1
  }
  return out
}

/** When an offer made now stops holding its place. */
export function holdEnds(now: Date, holdHours: number): string {
  return new Date(now.getTime() + holdHours * 3600_000).toISOString()
}
