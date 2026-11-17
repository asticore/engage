import { CheckoutError } from '@/features/ecommerce/server/pricing'
import { rawD1 } from '@/features/ecommerce/server/db'
import { hitShared } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'
import { addressKey, isExempt, normaliseEmail, refusal, type Prior, type Rule } from './logic'
import * as store from './store'

export type LimitCheck = {
  lines: { productId: unknown; name: string; quantity: number }[]
  email: string
  user?: { id?: number | string; emailVerifiedAt?: string | null } | null
  address: Record<string, string>
  cartId: number | null
}

const ruleApplies = (rule: Rule, productId: number): boolean => rule.active && (rule.productId === null || rule.productId === productId)

/**
 * Called when an order is priced, before any payment starts. Throws a CheckoutError with the sentence to show when a
 * rule refuses the order, and writes the refusal to the blocked-attempts log. When the feature is off, or the tables
 * cannot be read, it lets the order through: a limit must never stop the shop selling by accident.
 */
export async function enforcePurchaseLimits(check: LimitCheck, now = new Date()): Promise<void> {
  let d1: store.D1
  let rules: Rule[]
  try {
    if (!(await getFeatureFlags()).limits) return
    d1 = (await rawD1()) as never as store.D1
    rules = await store.listRules(d1, true)
  } catch {
    return
  }
  await checkRules(d1, rules, check, now)
}

/**
 * The check itself, on a database and rules already loaded. Places are claimed before they are counted (see
 * store.claimPlace), so two orders racing for the last allowed place cannot both pass.
 */
export async function checkRules(d1: store.D1, rules: Rule[], check: LimitCheck, now = new Date()): Promise<void> {
  const emailKey = normaliseEmail(check.email)
  // A buy-step throttle: one person cannot fire the pricing step again and again to probe or hoard.
  if (rules.length > 0) {
    const limited = await hitShared(`buy-step:${emailKey}`, 20).catch(() => ({ limited: false }))
    if (limited.limited) {
      await store.logBlock(d1, { ruleId: null, productId: null, reason: 'too-fast', emailKey, detail: 'Too many checkout attempts' }, now.toISOString()).catch((): null => null)
      throw new CheckoutError('Too many checkout attempts. Please wait a minute and try again.')
    }
  }
  const userId = check.user?.id !== undefined && check.user?.id !== null ? Number(check.user.id) : null
  const who: store.Identity = { emailKeys: [emailKey], userId, addressKey: addressKey(check.address.addressLine1, check.address.postalCode) }
  const verified = Boolean(check.user && check.user.emailVerifiedAt)
  for (const line of check.lines) {
    const productId = Number(line.productId)
    if (!Number.isInteger(productId) || productId <= 0) continue
    for (const rule of rules.filter((r) => ruleApplies(r, productId) && !isExempt(r, emailKey))) {
      const needed: number[] = []
      if (rule.maxQty !== null) needed.push(rule.windowDays > 0 ? now.getTime() - rule.windowDays * 86_400_000 : 0)
      if (rule.cooldownHours > 0) needed.push(now.getTime() - rule.cooldownHours * 3_600_000)
      // Claim the place first, then count orders and the other carts' claims.
      const claimed = needed.length > 0 && check.cartId !== null
      if (claimed) await store.claimPlace(d1, { cartId: check.cartId as number, productId, qty: line.quantity, who }, now.toISOString())
      const prior: Prior[] = needed.length > 0 ? await store.priorPurchases(d1, productId, who, check.cartId, normaliseEmail, addressKey, Math.min(...needed)).catch((): Prior[] => []) : []
      if (claimed) prior.push(...(await store.concurrentClaims(d1, productId, who, check.cartId as number, now.toISOString())))
      const message = refusal(rule, { productTitle: line.name, wantQty: line.quantity, prior, verified, now })
      if (message) {
        if (claimed) await store.releaseClaim(d1, check.cartId as number, productId)
        await store.logBlock(d1, { ruleId: rule.id, productId, reason: rule.requireVerified && !verified ? 'unverified' : 'limit', emailKey, detail: message }, now.toISOString()).catch((): null => null)
        throw new CheckoutError(message)
      }
    }
  }
}
