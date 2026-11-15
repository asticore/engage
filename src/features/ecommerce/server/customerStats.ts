/**
 * What a customer has bought before, for pricing rules that look at lifetime spend and order count.
 * Matched by email on paid orders. Never throws: with no database or no orders table the customer is new.
 */
import { rawD1 } from './db'

export type CustomerStats = { lifetimeSpendCents: number; orderCount: number }

export const NO_STATS: CustomerStats = { lifetimeSpendCents: 0, orderCount: 0 }

export async function customerStatsForEmail(email: string | null | undefined): Promise<CustomerStats> {
  const address = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!address) return NO_STATS
  try {
    const d1 = await rawD1()
    const row = (await d1.prepare("SELECT COALESCE(SUM(amount - COALESCE(refunded_total, 0)), 0) AS spend, COUNT(*) AS n FROM eg_orders WHERE lower(customer_email) = ?1 AND status IN ('processing','completed','on-hold')").bind(address).all<{ spend: number; n: number }>()).results[0]
    return { lifetimeSpendCents: Math.max(0, Number(row?.spend ?? 0)), orderCount: Number(row?.n ?? 0) }
  } catch {
    return NO_STATS
  }
}
