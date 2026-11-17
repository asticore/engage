/**
 * Wholesale mode, server side (Task 11d): reads the switches, the application and customer tag tables, and works out the
 * viewer of a page. Reads never throw into a page: a missing table or row means wholesale is off and nobody has tags.
 */

import { cache } from 'react'

import { filterWholesaleVisible, isWholesaleBuyer, minOrderShortfallCents, normaliseTags, normaliseWholesaleConfig, tagType, WHOLESALE_OFF, type ApplicationInput, type ApplicationStatus, type Buyer, type WholesaleConfig } from '../lib/wholesale'

type Engine = { findGlobal(a: unknown): Promise<unknown> }

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

/** One read of the wholesale switches. Never throws: unreadable means off. */
export async function loadWholesaleConfig(engine: Engine): Promise<WholesaleConfig> {
  try {
    return normaliseWholesaleConfig(await engine.findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true }))
  } catch {
    return WHOLESALE_OFF
  }
}

export type ApplicationRow = {
  userId: number
  email: string
  company: string
  taxId: string
  phone: string
  message: string
  status: ApplicationStatus
  organizationId: string | null
  note: string
  appliedAt: string
  decidedAt: string | null
  decidedBy: string
}

const toApplication = (r: Row): ApplicationRow => ({
  userId: Number(r.user_id),
  email: String(r.email ?? ''),
  company: String(r.company ?? ''),
  taxId: String(r.tax_id ?? ''),
  phone: String(r.phone ?? ''),
  message: String(r.message ?? ''),
  status: r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending',
  organizationId: r.organization_id ? String(r.organization_id) : null,
  note: String(r.note ?? ''),
  appliedAt: String(r.applied_at ?? ''),
  decidedAt: r.decided_at ? String(r.decided_at) : null,
  decidedBy: String(r.decided_by ?? ''),
})

const COLS = 'user_id, email, company, tax_id, phone, message, status, organization_id, note, applied_at, decided_at, decided_by'

export async function getApplication(d1: D1, userId: number): Promise<ApplicationRow | null> {
  try {
    const r = (await d1.prepare(`SELECT ${COLS} FROM eg_wholesale_applications WHERE user_id = ?1`).bind(userId).all<Row>()).results[0]
    return r ? toApplication(r) : null
  } catch {
    return null
  }
}

export async function listApplications(d1: D1, status?: ApplicationStatus): Promise<ApplicationRow[]> {
  try {
    const where = status ? ' WHERE status = ?1' : ''
    const rows = (await d1.prepare(`SELECT ${COLS} FROM eg_wholesale_applications${where} ORDER BY applied_at DESC LIMIT 500`).bind(...(status ? [status] : [])).all<Row>()).results
    return rows.map(toApplication)
  } catch {
    return []
  }
}

/**
 * Saves an application. A pending or approved one is left alone (returns that status); a rejected one can be sent again
 * and goes back to pending. Returns 'created' for a new or re-sent application.
 */
export async function submitApplication(d1: D1, user: { id: number; email: string }, input: ApplicationInput, nowIso: string): Promise<'created' | 'pending' | 'approved'> {
  const existing = await getApplication(d1, user.id)
  if (existing?.status === 'pending') return 'pending'
  if (existing?.status === 'approved') return 'approved'
  await d1
    .prepare(
      `INSERT INTO eg_wholesale_applications (user_id, email, company, tax_id, phone, message, status, applied_at) VALUES (?1,?2,?3,?4,?5,?6,'pending',?7)
       ON CONFLICT(user_id) DO UPDATE SET email=?2, company=?3, tax_id=?4, phone=?5, message=?6, status='pending', applied_at=?7, decided_at=NULL, decided_by='', note=''`,
    )
    .bind(user.id, user.email, input.company, input.taxId, input.phone, input.message, nowIso)
    .run()
  return 'created'
}

export async function decideApplication(d1: D1, userId: number, v: { status: 'approved' | 'rejected'; by: string; note: string; organizationId?: string | null }, nowIso: string): Promise<boolean> {
  const before = await getApplication(d1, userId)
  if (!before) return false
  await d1
    .prepare('UPDATE eg_wholesale_applications SET status = ?2, decided_at = ?3, decided_by = ?4, note = ?5, organization_id = COALESCE(?6, organization_id) WHERE user_id = ?1')
    .bind(userId, v.status, nowIso, v.by, v.note.slice(0, 500), v.organizationId ?? null)
    .run()
  return true
}

export async function listTags(d1: D1, userId: number): Promise<string[]> {
  try {
    return (await d1.prepare('SELECT tag FROM eg_customer_tags WHERE user_id = ?1 ORDER BY tag').bind(userId).all<Row>()).results.map((r) => String(r.tag))
  } catch {
    return []
  }
}

/** Replaces the tags of one customer with the cleaned list. */
export async function setTags(d1: D1, userId: number, tags: string[]): Promise<void> {
  await d1.prepare('DELETE FROM eg_customer_tags WHERE user_id = ?1').bind(userId).run()
  for (const tag of normaliseTags(tags)) await d1.prepare('INSERT OR IGNORE INTO eg_customer_tags (user_id, tag) VALUES (?1, ?2)').bind(userId, tag).run()
}

export type TaggedCustomer = { userId: number; email: string; name: string; tags: string[] }

/** Customers who have tags, or the one matching an email. For the Wholesale screen. */
export async function listTaggedCustomers(d1: D1): Promise<TaggedCustomer[]> {
  try {
    const rows = (
      await d1
        .prepare('SELECT t.user_id, t.tag, u.email, u.name FROM eg_customer_tags t LEFT JOIN eg_users u ON u.id = t.user_id ORDER BY t.user_id, t.tag LIMIT 2000')
        .bind()
        .all<Row>()
    ).results
    const byUser = new Map<number, TaggedCustomer>()
    for (const r of rows) {
      const id = Number(r.user_id)
      const entry = byUser.get(id) ?? { userId: id, email: String(r.email ?? ''), name: String(r.name ?? ''), tags: [] }
      entry.tags.push(String(r.tag))
      byUser.set(id, entry)
    }
    return [...byUser.values()]
  } catch {
    return []
  }
}

/** The customer types a user gets from wholesale mode: the wholesale role when approved, and one `tag:<name>` per tag. Never throws. */
export async function wholesaleTypesForUser(userId: number): Promise<string[]> {
  try {
    const [{ rawD1 }, { getEngine }] = await Promise.all([import('./db'), import('@/lib/engine')])
    const d1 = (await rawD1()) as never as D1
    const out = (await listTags(d1, userId)).map(tagType)
    const application = await getApplication(d1, userId)
    if (application?.status === 'approved') out.unshift(normaliseWholesaleConfig(await (await getEngine()).findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true }).catch((): null => null)).role)
    return out
  } catch {
    return []
  }
}

/** A short unique company slug: the name's slug, then -2, -3 and so on. */
export function companySlug(name: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'company'
  const next = async (n: number): Promise<string> => {
    const candidate = n === 1 ? base : `${base}-${n}`
    return n > 50 || !(await taken(candidate)) ? candidate : next(n + 1)
  }
  return next(1)
}

/** Creates the applicant's company account (they become its owner). Returns its id, or null when companies are not available. */
export async function createCompanyFor(user: { id: number }, company: string, nowIso: string): Promise<string | null> {
  try {
    const { defaultOrgStore } = await import('@/features/organizations/store')
    const slug = await companySlug(company, async (s) => Boolean(await defaultOrgStore.getOrgBySlug(s)))
    const id = crypto.randomUUID()
    await defaultOrgStore.insertOrg({ id, name: company.slice(0, 120), slug, logo: null, metadata: null, createdBy: user.id, createdAt: nowIso, updatedAt: nowIso })
    await defaultOrgStore.insertMember({ id: crypto.randomUUID(), organizationId: id, userId: user.id, role: 'owner', createdAt: nowIso })
    return id
  } catch {
    return null
  }
}

/** Who is looking at this server-rendered page, once per request. Never throws: a failure means a signed-out visitor. */
export const currentBuyer = cache(async (): Promise<Buyer> => {
  try {
    const { accountContext } = await import('@/features/accounts/session')
    const context = await accountContext()
    if (!context.user) return { signedIn: false, types: [] }
    const { customerTypesForUser } = await import('./customerTypes')
    return { signedIn: true, types: await customerTypesForUser(context.user as never) }
  } catch {
    return { signedIn: false, types: [] }
  }
})

export const currentWholesaleConfig = cache(async (): Promise<WholesaleConfig> => {
  try {
    const { getEngine } = await import('@/lib/engine')
    return await loadWholesaleConfig((await getEngine()) as never)
  } catch {
    return WHOLESALE_OFF
  }
})

/** The viewer and the switches together, for pages. */
export async function wholesaleViewer(): Promise<{ cfg: WholesaleConfig; buyer: Buyer }> {
  const cfg = await currentWholesaleConfig()
  if (!cfg.enabled) return { cfg, buyer: { signedIn: false, types: [] } }
  return { cfg, buyer: await currentBuyer() }
}

/** The buyer behind a request's headers (add to cart, API routes). Never throws. */
export async function buyerFromHeaders(engine: { auth?: (a: unknown) => Promise<{ user?: unknown }> }, headers: Headers | null | undefined): Promise<Buyer> {
  try {
    if (!headers || !engine.auth) return { signedIn: false, types: [] }
    const { user } = await engine.auth({ headers })
    if (!user) return { signedIn: false, types: [] }
    const { customerTypesForUser } = await import('./customerTypes')
    return { signedIn: true, types: await customerTypesForUser(user as never) }
  } catch {
    return { signedIn: false, types: [] }
  }
}

/** Drops wholesale-only products this visitor may not see. A no-op while wholesale mode is off. */
export async function visibleToViewer<T extends { wholesaleOnly?: unknown }>(docs: T[]): Promise<T[]> {
  const { cfg, buyer } = await wholesaleViewer()
  return filterWholesaleVisible(cfg, docs, buyer)
}

/**
 * The extra read restriction for the products REST and GraphQL read access: with wholesale mode on, anyone who is not an
 * approved wholesale account (or admin) cannot read wholesale-only products. Null means no restriction. Throws are the
 * caller's to turn into a refusal (it fails closed).
 */
export async function wholesaleReadClause(user: { id?: number | string | null; roles?: unknown } | null | undefined): Promise<Record<string, unknown> | null> {
  const { getEngine } = await import('@/lib/engine')
  const cfg = await loadWholesaleConfig((await getEngine()) as never)
  if (!cfg.enabled) return null
  if (user && Array.isArray(user.roles) && user.roles.includes('admin')) return null
  if (user?.id) {
    const { customerTypesForUser } = await import('./customerTypes')
    if (isWholesaleBuyer(cfg, { signedIn: true, types: await customerTypesForUser(user as never) })) return null
  }
  return { wholesaleOnly: { not_equals: true } }
}

/** For the cart quote: the wholesale minimum and how far the cart is under it, or null when it does not apply. Never throws. */
export async function wholesaleMinOrderNotice(engine: Engine, user: { id?: number | string | null; roles?: unknown } | null | undefined, subtotalCents: number): Promise<{ minCents: number; shortfallCents: number } | null> {
  try {
    const cfg = await loadWholesaleConfig(engine)
    if (!cfg.enabled || cfg.minOrderCents === null || !user) return null
    const { customerTypesForUser } = await import('./customerTypes')
    const buyer = { signedIn: true, types: await customerTypesForUser(user as never) }
    if (!isWholesaleBuyer(cfg, buyer)) return null
    return { minCents: cfg.minOrderCents, shortfallCents: minOrderShortfallCents(cfg, buyer, subtotalCents) }
  } catch {
    return null
  }
}

/** Tells an applicant their wholesale application was decided. Never throws: a mail failure must not undo the decision. */
export async function sendDecisionEmail(application: { email: string; company: string }, status: 'approved' | 'rejected', note: string): Promise<void> {
  try {
    if (!application.email) return
    const { sendEmail } = await import('@/features/email')
    const approved = status === 'approved'
    // The applicant's own language when they have chosen one, otherwise English.
    const { localeForRecipient } = await import('@/features/email/recipientLocale')
    const { loadStrings, t: uiT } = await import('@/features/uiStrings')
    const engine = (await import('@/engine')).getEngine
    const locale = await localeForRecipient((await engine()) as never, application.email)
    await loadStrings(locale)
    const kind = approved ? 'approved' : 'rejected'
    const lines = [uiT(`email.wholesale.${kind}.body`, locale, { company: application.company })]
    if (note.trim()) lines.push('', note.trim())
    await sendEmail({ to: application.email, template: 'wholesale.decision', subject: uiT(`email.wholesale.${kind}.subject`, locale), text: lines.join('\n') })
  } catch {
    /* notification only */
  }
}
