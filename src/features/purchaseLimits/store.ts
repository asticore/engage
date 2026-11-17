import { type Prior, type Rule, type RuleInput } from './logic'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number; changes?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const run = (d1: D1, sql: string, ...args: unknown[]) => d1.prepare(sql).bind(...args).run()

const toRule = (r: Row): Rule => ({ id: Number(r.id), title: String(r.title ?? ''), productId: r.product_id === null || r.product_id === undefined ? null : Number(r.product_id), maxQty: r.max_qty === null || r.max_qty === undefined ? null : Number(r.max_qty), windowDays: Number(r.window_days ?? 0), cooldownHours: Number(r.cooldown_hours ?? 0), requireVerified: Number(r.require_verified) !== 0, active: Number(r.active) !== 0, message: String(r.message ?? ''), exemptEmails: String(r.exempt_emails ?? '') })

export async function listRules(d1: D1, onlyActive = false): Promise<Rule[]> {
  return (await all(d1, `SELECT * FROM eg_purchase_limit_rules${onlyActive ? ' WHERE active = 1' : ''} ORDER BY id`)).map(toRule)
}
export async function saveRule(d1: D1, id: number | null, v: RuleInput, nowIso: string): Promise<void> {
  const a = [v.title, v.productId, v.maxQty, v.windowDays, v.cooldownHours, v.requireVerified ? 1 : 0, v.active ? 1 : 0, nowIso, v.message, v.exemptEmails]
  if (id) await run(d1, 'UPDATE eg_purchase_limit_rules SET title=?1, product_id=?2, max_qty=?3, window_days=?4, cooldown_hours=?5, require_verified=?6, active=?7, updated_at=?8, message=?9, exempt_emails=?10 WHERE id=?11', ...a, id)
  else await run(d1, 'INSERT INTO eg_purchase_limit_rules (title, product_id, max_qty, window_days, cooldown_hours, require_verified, active, updated_at, created_at, message, exempt_emails) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8,?9,?10)', ...a)
}
export async function deleteRule(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_purchase_limit_rules WHERE id = ?1', id)
}

export type Identity = { emailKeys: string[]; userId: number | null; addressKey: string }

/**
 * Earlier orders for a product that count against a buyer: paid or still waiting for payment (a pending order holds its
 * places), not cancelled, refunded or failed, and not the order already made from this cart. A match is the same
 * account, the same email once +tags and Gmail dots are ignored, or the same delivery address.
 */
export async function priorPurchases(d1: D1, productId: number, who: Identity, excludeCartId: number | null, normalise: (email: string) => string, addressOf: (line1: unknown, postal: unknown) => string, sinceMs: number): Promise<Prior[]> {
  const rows = await all(
    d1,
    `SELECT i.quantity AS quantity, o.created_at AS created_at, o.customer_email AS email, o.customer_id AS customer_id, o.shipping_address_address_line1 AS line1, o.shipping_address_postal_code AS postal, o.cart_id AS cart_id
     FROM eg_orders_items i JOIN eg_orders o ON o.id = i._parent_id
     WHERE i.product_id = ?1 AND o.status NOT IN ('cancelled','refunded','failed') AND o.created_at >= ?2
     ORDER BY o.id DESC LIMIT 2000`,
    productId, new Date(sinceMs).toISOString(),
  )
  const out: Prior[] = []
  for (const r of rows) {
    if (excludeCartId !== null && r.cart_id !== null && Number(r.cart_id) === excludeCartId) continue
    const sameUser = who.userId !== null && r.customer_id !== null && Number(r.customer_id) === who.userId
    const sameEmail = Boolean(r.email) && who.emailKeys.includes(normalise(String(r.email)))
    const key = addressOf(r.line1, r.postal)
    const sameAddress = who.addressKey !== '' && key === who.addressKey
    if (sameUser || sameEmail || sameAddress) out.push({ qty: Number(r.quantity ?? 1), atMs: Date.parse(String(r.created_at)) || 0 })
  }
  return out
}

export async function logBlock(d1: D1, b: { ruleId: number | null; productId: number | null; reason: string; emailKey: string; detail: string }, nowIso: string): Promise<void> {
  await run(d1, 'INSERT INTO eg_purchase_limit_blocks (rule_id, product_id, reason, email_key, detail, created_at) VALUES (?1,?2,?3,?4,?5,?6)', b.ruleId, b.productId, b.reason, b.emailKey, b.detail.slice(0, 500), nowIso)
}
export type Block = { id: number; ruleId: number | null; productId: number | null; reason: string; emailKey: string; detail: string; createdAt: string }
export async function listBlocks(d1: D1, limit = 100): Promise<Block[]> {
  return (await all(d1, `SELECT * FROM eg_purchase_limit_blocks ORDER BY id DESC LIMIT ${Math.max(1, Math.min(limit, 500))}`)).map((r) => ({ id: Number(r.id), ruleId: r.rule_id === null ? null : Number(r.rule_id), productId: r.product_id === null ? null : Number(r.product_id), reason: String(r.reason ?? ''), emailKey: String(r.email_key ?? ''), detail: String(r.detail ?? ''), createdAt: String(r.created_at ?? '') }))
}
export async function blockCounts(d1: D1): Promise<{ today: number; week: number }> {
  const day = new Date(Date.now() - 86_400_000).toISOString()
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const rows = await all(d1, 'SELECT SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END) AS today, COUNT(*) AS week FROM eg_purchase_limit_blocks WHERE created_at >= ?2', day, week)
  return { today: Number(rows[0]?.today ?? 0), week: Number(rows[0]?.week ?? 0) }
}
