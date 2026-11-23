/**
 * Waiting list with held places (database side). With the Shop setting "Waiting list" on "In order", a restock
 * offers the free places to the people who signed up first, each for a limited hold, instead of emailing everyone.
 * While a place is held, other buyers cannot take it at checkout. A place nobody takes in time passes to the next
 * person in line (the scheduled sweep, and every product save). Every function here is best effort and never throws.
 */

import { readShopBase } from '@/features/seo/permalinkStore'
import { shopPath } from '@/features/seo/permalinks'
import { heldForOthers, holdEnds, normaliseWaitingListSettings, pickOffers, placesFor, type WaitRow, type WaitingListSettings } from './lib/waitingList'
import { normalizeEmail } from './lib/email'
import { loadStrings, t } from '@/features/uiStrings'
import { localeForRecipient } from '@/features/email/recipientLocale'
import { configuredSiteOrigin } from '@/utilities/siteOrigin'
import type { StockFields } from './stock'
import type { VariationRow } from './variations'

type Doc = Record<string, unknown>
export type WaitingListEngine = {
  find: (args: Record<string, unknown>) => Promise<{ docs: Doc[] }>
  findByID: (args: Record<string, unknown>) => Promise<Doc | null>
  findGlobal: (args: Record<string, unknown>) => Promise<Doc | null>
  update: (args: Record<string, unknown>) => Promise<Doc>
}
type ProductDoc = StockFields & { id: number | string; title?: string; slug?: string; _status?: string | null; variations?: VariationRow[] | null }

const BATCH = 1000

export async function loadWaitingListSettings(engine: WaitingListEngine): Promise<WaitingListSettings> {
  const settings = await engine.findGlobal({ slug: 'shop-settings', depth: 0, overrideAccess: true }).catch((): null => null)
  const storefront = (settings?.storefront ?? {}) as { backInStock?: boolean | null }
  if (storefront.backInStock === false) return { mode: 'all', holdHours: 24 }
  return normaliseWaitingListSettings(await engine.findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true }).catch((): null => null))
}

const toRow = (doc: Doc): WaitRow => ({
  id: doc.id as number,
  email: String(doc.email ?? ''),
  variation: (doc.variation as string | null) ?? null,
  status: (doc.status as string | null) ?? 'pending',
  holdUntil: (doc.holdUntil as string | null) ?? null,
  createdAt: (doc.createdAt as string | null) ?? null,
})

async function rowsFor(engine: WaitingListEngine, productId: number | string, statuses: string[]): Promise<Doc[]> {
  const { docs } = await engine.find({
    collection: 'stock-subscriptions',
    where: { and: [{ product: { equals: productId } }, { or: statuses.map((status) => ({ status: { equals: status } })) }] },
    sort: 'createdAt',
    limit: BATCH,
    depth: 0,
    overrideAccess: true,
  })
  return docs
}

/** Offers the free places of this product to the next people in line. Returns how many offers went out. */
export async function offerReleasedPlaces(engine: WaitingListEngine, product: ProductDoc, now: Date = new Date()): Promise<number> {
  try {
    if (product._status === 'draft') return 0
    const settings = await loadWaitingListSettings(engine)
    if (settings.mode !== 'ordered') return 0
    const baseUrl = configuredSiteOrigin()
    if (!baseUrl) return 0
    const shopBase = await readShopBase()
    const docs = await rowsFor(engine, product.id, ['pending', 'offered'])
    if (docs.length === 0) return 0
    const rows = docs.map(toRow)
    const byId = new Map(docs.map((doc) => [String(doc.id), doc]))
    const variationIds = new Set(rows.filter((row) => (row.status ?? 'pending') === 'pending').map((row) => row.variation ?? ''))
    const { sendEmail } = await import('@/features/email')
    let offered = 0
    for (const variation of variationIds) {
      const variationRow = variation ? (product.variations ?? []).find((item) => item.id === variation) : undefined
      if (variation && (!variationRow || variationRow.enabled === false)) continue
      const free = placesFor(variationRow ?? null, product)
      for (const pick of pickOffers(rows, variation, free, now)) {
        const doc = byId.get(String(pick.id))
        if (!doc || typeof doc.email !== 'string') continue
        const until = holdEnds(now, settings.holdHours)
        // The hold is written first so a slow email can never leave two people holding the same place.
        await engine.update({ collection: 'stock-subscriptions', id: doc.id as number, data: { status: 'offered', notifiedAt: now.toISOString(), holdUntil: until }, overrideAccess: true })
        pick.status = 'offered'
        pick.holdUntil = until
        const label = `${product.title || 'Product'}${variationRow?.attributeValues ? ` (${variationRow.attributeValues.replace(/\|/g, ', ')})` : ''}`.replace(/[\r\n]+/g, ' ')
        const locale = await localeForRecipient(engine as never, doc.email)
        if (locale) await loadStrings(locale)
        const sent = await sendEmail({
          to: doc.email,
          template: 'stock.back-in-stock',
          subject: t('email.waitingList.subject', locale, { label }),
          text: t('email.waitingList.body', locale, { label, url: `${baseUrl}${shopPath(shopBase, `/${product.slug ?? ''}`)}`, hours: String(settings.holdHours) }),
        }).catch((): { ok: false } => ({ ok: false }))
        if (sent.ok) offered += 1
      }
    }
    return offered
  } catch {
    return 0
  }
}

/** Live holds on the items in a cart, as a map keyed "productId:variationId" to the places held for other people. */
export async function loadHeldForOthers(engine: WaitingListEngine, items: Array<{ product?: unknown; variation?: string | null }>, buyerEmail: string | null | undefined, now: Date = new Date()): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  try {
    const settings = await loadWaitingListSettings(engine)
    if (settings.mode !== 'ordered') return out
    const ids = [...new Set(items.map((i) => (i.product && typeof i.product === 'object' ? (i.product as { id?: unknown }).id : i.product)).filter((id): id is number | string => id != null && id !== ''))]
    for (const id of ids) {
      const docs = await rowsFor(engine, id, ['offered'])
      if (docs.length === 0) continue
      const rows = docs.map(toRow)
      for (const variation of new Set(rows.map((row) => row.variation ?? ''))) {
        const held = heldForOthers(rows, variation, buyerEmail, now)
        if (held > 0) out.set(`${id}:${variation}`, held)
      }
    }
  } catch {
    /* no holds known: checkout behaves as before */
  }
  return out
}

/** An order for an offered place ends the offer (call once per order after its stock is taken). */
export async function markOfferPurchased(engine: WaitingListEngine, email: unknown, lines: Array<{ productId?: number | string; variationId?: string | null }>): Promise<void> {
  try {
    const buyer = normalizeEmail(email)
    if (!buyer) return
    for (const line of lines) {
      if (line.productId == null) continue
      const docs = await rowsFor(engine, line.productId, ['offered'])
      const mine = docs.find((doc) => normalizeEmail(doc.email) === buyer && ((doc.variation as string | null) ?? '') === (line.variationId ?? ''))
      if (mine) await engine.update({ collection: 'stock-subscriptions', id: mine.id as number, data: { status: 'purchased' }, overrideAccess: true })
    }
  } catch {
    /* the hold simply runs out */
  }
}

/** Ends holds whose time is up and offers the released places to the next in line. Returns how many holds ended. */
export async function sweepWaitingList(engine: WaitingListEngine, now: Date = new Date()): Promise<number> {
  try {
    const settings = await loadWaitingListSettings(engine)
    if (settings.mode !== 'ordered') return 0
    const { docs } = await engine.find({ collection: 'stock-subscriptions', where: { and: [{ status: { equals: 'offered' } }, { holdUntil: { less_than: now.toISOString() } }] }, limit: BATCH, depth: 0, overrideAccess: true })
    const products = new Set<string>()
    for (const doc of docs) {
      await engine.update({ collection: 'stock-subscriptions', id: doc.id as number, data: { status: 'expired' }, overrideAccess: true })
      const product = doc.product && typeof doc.product === 'object' ? (doc.product as { id: unknown }).id : doc.product
      products.add(String(product))
    }
    // Places can also be waiting with nobody holding them (stock added after the last offer), so every product with a line is checked.
    const pending = await engine.find({ collection: 'stock-subscriptions', where: { status: { equals: 'pending' } }, limit: BATCH, depth: 0, overrideAccess: true })
    for (const doc of pending.docs) products.add(String(doc.product && typeof doc.product === 'object' ? (doc.product as { id: unknown }).id : doc.product))
    for (const id of products) {
      const product = (await engine.findByID({ collection: 'products', id, depth: 0, overrideAccess: true }).catch((): null => null)) as ProductDoc | null
      if (product) await offerReleasedPlaces(engine, product, now)
    }
    return docs.length
  } catch {
    return 0
  }
}
