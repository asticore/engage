/** Rules for purchase limits. Pure: the checkout hook feeds in what the person already bought and gets a sentence back or null. */

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const int = (v: unknown, min: number, max: number): number | null => {
  const n = Math.floor(Number(v))
  return v !== '' && v !== null && v !== undefined && Number.isFinite(n) && n >= min && n <= max ? n : null
}

export type Rule = { id: number; title: string; productId: number | null; maxQty: number | null; windowDays: number; cooldownHours: number; requireVerified: boolean; active: boolean; message: string; exemptEmails: string }
export type RuleInput = Omit<Rule, 'id'>

/** One person, however they type their address: lower case, no +tag, no dots at Gmail. */
export function normaliseEmail(email: string): string {
  const [localRaw, domainRaw = ''] = email.trim().toLowerCase().split('@')
  const domain = domainRaw === 'googlemail.com' ? 'gmail.com' : domainRaw
  let local = localRaw.split('+')[0]
  if (domain === 'gmail.com') local = local.replace(/\./g, '')
  return `${local}@${domain}`
}

/** A delivery address as one comparable key, or '' when there is not enough to compare. */
export function addressKey(line1: unknown, postalCode: unknown): string {
  const a = String(line1 ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const p = String(postalCode ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return a.length >= 4 && p.length >= 3 ? `${a}|${p}` : ''
}

export function parseRule(raw: unknown): { ok: true; value: RuleInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const title = text(r.title, 120)
  if (!title) return { ok: false, error: 'Give the rule a name.' }
  const product = Number(r.productId)
  const maxQty = int(r.maxQty, 1, 100000)
  const windowDays = int(r.windowDays, 0, 3650) ?? 0
  const cooldownHours = int(r.cooldownHours, 0, 8760) ?? 0
  const requireVerified = r.requireVerified === true
  if (maxQty === null && cooldownHours === 0 && !requireVerified) return { ok: false, error: 'Set a most per person, a wait between orders, or require a verified account.' }
  // The exceptions list: one email per line (commas also work), stored in the same normalised form checkout compares.
  const exemptEmails = String(r.exemptEmails ?? '').split(/[\s,;]+/).map((e) => e.trim()).filter((e) => e.includes('@')).map(normaliseEmail).slice(0, 200).join('\n')
  return { ok: true, value: { title, productId: Number.isInteger(product) && product > 0 ? product : null, maxQty, windowDays, cooldownHours, requireVerified, active: r.active !== false, message: text(r.message, 300), exemptEmails } }
}

export type Prior = { qty: number; atMs: number }
export type Context = { productTitle: string; wantQty: number; prior: Prior[]; verified: boolean; now: Date }

const DAY = 86_400_000
const HOUR = 3_600_000

/** True when the buyer's normalised email is on the rule's exceptions list. */
export const isExempt = (rule: Pick<Rule, 'exemptEmails'>, emailKey: string): boolean => Boolean(emailKey) && rule.exemptEmails.split('\n').includes(emailKey)

/** The rule's own wording when it has one ({{product}} is the product name), else the built-in sentence. */
export const ruleMessage = (rule: Pick<Rule, 'message'>, fallback: string, productTitle: string): string => (rule.message ? rule.message.replace(/\{\{\s*product\s*\}\}/g, productTitle) : fallback)

/** The sentence to show the buyer when this rule refuses the order, or null when it allows it. */
export function refusal(rule: Pick<Rule, 'maxQty' | 'windowDays' | 'cooldownHours' | 'requireVerified'> & Partial<Pick<Rule, 'message'>>, ctx: Context): string | null {
  const said = refusalBuiltIn(rule, ctx)
  return said === null ? null : ruleMessage({ message: rule.message ?? '' }, said, ctx.productTitle)
}

function refusalBuiltIn(rule: Pick<Rule, 'maxQty' | 'windowDays' | 'cooldownHours' | 'requireVerified'>, ctx: Context): string | null {
  const now = ctx.now.getTime()
  if (rule.requireVerified && !ctx.verified) return `${ctx.productTitle} can only be bought with a signed-in account whose email is verified.`
  if (rule.cooldownHours > 0) {
    const last = Math.max(0, ...ctx.prior.map((p) => p.atMs))
    if (last > 0 && now < last + rule.cooldownHours * HOUR) {
      const when = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(last + rule.cooldownHours * HOUR))
      return `You ordered ${ctx.productTitle} recently. You can order it again after ${when}.`
    }
  }
  if (rule.maxQty !== null) {
    const since = rule.windowDays > 0 ? now - rule.windowDays * DAY : 0
    const bought = ctx.prior.filter((p) => p.atMs >= since).reduce((n, p) => n + p.qty, 0)
    if (bought + ctx.wantQty > rule.maxQty) {
      const left = Math.max(0, rule.maxQty - bought)
      const span = rule.windowDays > 0 ? ` in ${rule.windowDays} days` : ''
      return left === 0
        ? `The limit for ${ctx.productTitle} is ${rule.maxQty} per person${span}, and you have reached it.`
        : `The limit for ${ctx.productTitle} is ${rule.maxQty} per person${span}. You can order ${left} more.`
    }
  }
  return null
}
