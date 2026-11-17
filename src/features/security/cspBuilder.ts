import { parsePolicy, validateCustomPolicy } from './customPolicy'

/**
 * Task 19j: the guided Content-Security-Policy builder.
 *
 * Pure (no database, no request) so the admin screen, the middleware and the unit tests all share
 * one definition. The builder holds, per directive, a list of extra sources and whether they REPLACE
 * the default policy's sources for that directive or are ADDED to them. The free-text policy in
 * Security > Headers stays and is merged on top of whatever the builder produces.
 *
 * Modes:
 *  - off:         the builder does nothing.
 *  - report-only: the site keeps enforcing the default (and any free-text) policy; the builder's
 *                 policy is sent as Content-Security-Policy-Report-Only, so a browser reports what it
 *                 would block without blocking anything.
 *  - enforce:     the builder's policy is the enforced one.
 * Admin pages never get the builder's policy (they are policy-free by default, see headers.ts), so a
 * wrong policy cannot lock an admin out of the screen that fixes it.
 */

export type CspMode = 'off' | 'report-only' | 'enforce'

export type DirectiveEntry = { sources: string[]; replace: boolean }

export type CspBuilderConfig = {
  mode: CspMode
  /** Record violation reports sent by browsers to /api/csp-report. */
  collectReports: boolean
  directives: Record<string, DirectiveEntry>
}

export const EMPTY_CSP_BUILDER: CspBuilderConfig = { mode: 'off', collectReports: true, directives: {} }

export const CSP_REPORT_PATH = '/api/csp-report'

/** The directives the picker offers, in the order shown, each with a plain-language label. */
export const PICKER_DIRECTIVES: { name: string; label: string; help: string }[] = [
  { name: 'default-src', label: 'Everything else (default-src)', help: 'Used for any kind of content that has no directive of its own below.' },
  { name: 'script-src', label: 'Scripts (script-src)', help: 'Where JavaScript may load from: analytics, tag managers, chat widgets.' },
  { name: 'style-src', label: 'Styles (style-src)', help: 'Where stylesheets may load from, such as Google Fonts CSS.' },
  { name: 'img-src', label: 'Images (img-src)', help: 'Where pictures may load from.' },
  { name: 'font-src', label: 'Fonts (font-src)', help: 'Where font files may load from.' },
  { name: 'connect-src', label: 'Network calls (connect-src)', help: 'Where scripts may send requests: APIs, analytics beacons.' },
  { name: 'media-src', label: 'Audio and video (media-src)', help: 'Where audio and video files may load from.' },
  { name: 'frame-src', label: 'Embedded frames (frame-src)', help: 'Which sites may be shown inside a frame on your pages: videos, maps, booking widgets.' },
  { name: 'worker-src', label: 'Workers (worker-src)', help: 'Where web workers and service workers may load from.' },
  { name: 'object-src', label: 'Plugins (object-src)', help: "Legacy plugins. 'none' is the safe choice." },
  { name: 'base-uri', label: 'Base address (base-uri)', help: 'Which addresses a page may set as its base.' },
  { name: 'form-action', label: 'Form targets (form-action)', help: 'Where forms on your pages may send their data.' },
  { name: 'frame-ancestors', label: 'Who may frame you (frame-ancestors)', help: 'Which sites may show your pages inside a frame.' },
]

const PICKER_NAMES = new Set(PICKER_DIRECTIVES.map((d) => d.name))

/** Keyword sources offered in the picker. */
export const KEYWORD_SOURCES: { value: string; label: string; risky?: boolean }[] = [
  { value: "'self'", label: "Your own site ('self')" },
  { value: "'none'", label: "Nothing ('none')" },
  { value: 'https:', label: 'Any https site (https:)' },
  { value: 'data:', label: 'Inline data (data:)' },
  { value: 'blob:', label: 'Browser blobs (blob:)' },
  { value: "'unsafe-inline'", label: "Inline code ('unsafe-inline')", risky: true },
  { value: "'unsafe-eval'", label: "Runtime code ('unsafe-eval')", risky: true },
  { value: "'strict-dynamic'", label: "Trust scripts a trusted script loads ('strict-dynamic')" },
  { value: '*', label: 'Anywhere (*)', risky: true },
]

/**
 * Hosts the builder knows. `inDefault` hosts are already in the default policy, so listing them is
 * informational; the others are one click away.
 */
export type KnownHost = { host: string; label: string; directives: string[]; inDefault: boolean }

export const KNOWN_HOSTS: KnownHost[] = [
  { host: 'https://fonts.googleapis.com', label: 'Google Fonts (stylesheets)', directives: ['style-src'], inDefault: true },
  { host: 'https://fonts.gstatic.com', label: 'Google Fonts (font files)', directives: ['font-src'], inDefault: true },
  { host: 'https://cdn.jsdelivr.net', label: 'jsDelivr (Effix and other libraries)', directives: ['script-src', 'style-src', 'font-src'], inDefault: true },
  { host: 'https://www.googletagmanager.com', label: 'Google Tag Manager and GA4', directives: ['script-src', 'frame-src'], inDefault: true },
  { host: 'https://www.clarity.ms', label: 'Microsoft Clarity', directives: ['script-src'], inDefault: true },
  { host: 'https://scripts.clarity.ms', label: 'Microsoft Clarity (scripts)', directives: ['script-src'], inDefault: true },
  { host: 'https://connect.facebook.net', label: 'Meta Pixel', directives: ['script-src'], inDefault: true },
  { host: 'https://js.stripe.com', label: 'Stripe.js', directives: ['script-src', 'frame-src'], inDefault: false },
  { host: 'https://challenges.cloudflare.com', label: 'Cloudflare Turnstile', directives: ['script-src', 'frame-src'], inDefault: false },
  { host: 'https://www.google.com', label: 'Google reCAPTCHA and Maps', directives: ['script-src', 'frame-src'], inDefault: false },
  { host: 'https://www.gstatic.com', label: 'Google reCAPTCHA (assets)', directives: ['script-src'], inDefault: false },
  { host: 'https://unpkg.com', label: 'unpkg', directives: ['script-src', 'style-src'], inDefault: false },
  { host: 'https://cdnjs.cloudflare.com', label: 'cdnjs', directives: ['script-src', 'style-src', 'font-src'], inDefault: false },
  { host: 'https://embed.tawk.to', label: 'Tawk.to chat', directives: ['script-src', 'frame-src'], inDefault: false },
  { host: 'https://widget.intercom.io', label: 'Intercom', directives: ['script-src'], inDefault: false },
  { host: 'https://js.hs-scripts.com', label: 'HubSpot', directives: ['script-src'], inDefault: false },
]

export const MAX_SOURCES_PER_DIRECTIVE = 60

/** Drops anything that is not a plain directive entry, so a stored or posted value cannot smuggle structure. */
export function normaliseConfig(input: unknown): CspBuilderConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const mode: CspMode = raw.mode === 'enforce' || raw.mode === 'report-only' ? raw.mode : 'off'
  const directives: Record<string, DirectiveEntry> = {}
  const rawDirectives = (raw.directives && typeof raw.directives === 'object' ? raw.directives : {}) as Record<string, unknown>
  for (const [name, value] of Object.entries(rawDirectives)) {
    if (!PICKER_NAMES.has(name) || !value || typeof value !== 'object') continue
    const entry = value as Record<string, unknown>
    const sources = Array.isArray(entry.sources)
      ? [...new Set(entry.sources.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SOURCES_PER_DIRECTIVE)
      : []
    if (sources.length === 0) continue
    directives[name] = { sources, replace: entry.replace === true }
  }
  return { mode, collectReports: raw.collectReports !== false, directives }
}

/** The builder's own directives as policy text (without the default). */
export function builderPolicyText(config: CspBuilderConfig): string {
  return PICKER_DIRECTIVES.filter((d) => config.directives[d.name]?.sources.length)
    .map((d) => `${d.name} ${config.directives[d.name].sources.join(' ')}`)
    .join('; ')
}

/**
 * Validates the builder before it is saved. Returns the first problem as a sentence for the screen, or null.
 * Reuses the free-text validator so a typed host is held to the same rules.
 */
export function validateBuilder(config: CspBuilderConfig): string | null {
  for (const [name, entry] of Object.entries(config.directives)) {
    const none = entry.sources.includes("'none'")
    if (none && entry.sources.length > 1) return `In ${name}: 'none' cannot be combined with other sources. Remove it or the others.`
    const problem = validateCustomPolicy(`${name} ${entry.sources.join(' ')}`)
    if (problem) return problem
  }
  return null
}

/** Non-blocking advice shown beside the preview. */
export function builderWarnings(config: CspBuilderConfig): string[] {
  const out: string[] = []
  for (const [name, entry] of Object.entries(config.directives)) {
    if (entry.sources.includes('*')) out.push(`${name} allows any host, which removes most of the protection for that kind of content.`)
    if (name === 'script-src' && entry.sources.includes("'unsafe-eval'")) out.push("script-src allows 'unsafe-eval', which lets injected text run as code.")
    if (name === 'script-src' && entry.replace && !entry.sources.includes("'unsafe-inline'") && !entry.sources.some((s) => s.startsWith("'nonce-") || s.startsWith("'sha")))
      out.push("script-src replaces the default without 'unsafe-inline', a nonce or a hash: the visual editor and the framework's own inline scripts will be blocked on public pages. Try report-only first.")
    if (entry.replace && entry.sources.includes("'none'") && ['default-src', 'script-src', 'style-src'].includes(name)) out.push(`${name} 'none' blocks every ${name === 'script-src' ? 'script' : name === 'style-src' ? 'style' : 'resource'} on public pages. Try report-only first.`)
  }
  if (config.mode === 'enforce') out.push('Enforce mode blocks content on public pages straight away. Run report-only for a few days and check the violation list first.')
  return out
}

/**
 * Applies the builder to a base policy: a directive marked Replace takes the builder's sources, any other
 * is widened with them. Pure; the base is the default policy (plus the free-text one when merged by the caller).
 */
export function applyBuilder(base: string, config: CspBuilderConfig): string {
  const merged = new Map<string, string[]>()
  for (const { name, sources } of parsePolicy(base)) merged.set(name, [...sources])
  for (const { name } of PICKER_DIRECTIVES) {
    const entry = config.directives[name]
    if (!entry?.sources.length) continue
    const current = merged.get(name)
    if (entry.replace || !current || (current.length === 1 && current[0] === "'none'")) {
      merged.set(name, [...entry.sources])
    } else if (entry.sources.length === 1 && entry.sources[0] === "'none'") {
      merged.set(name, ["'none'"])
    } else {
      const next = [...current]
      for (const source of entry.sources) if (!next.includes(source)) next.push(source)
      merged.set(name, next)
    }
  }
  return [...merged.entries()].map(([name, sources]) => (sources.length ? `${name} ${sources.join(' ')}` : name)).join('; ')
}

/**
 * The header(s) the builder adds on a public page, given the policy the site would otherwise enforce.
 * `enforced` is that policy (default, merged with free text). Returns the replacement enforced policy
 * and/or a report-only policy; both may be empty strings meaning "no change".
 */
export function builderHeaders(enforced: string, config: CspBuilderConfig): { enforce: string; reportOnly: string } {
  if (config.mode === 'off' || Object.keys(config.directives).length === 0) return { enforce: '', reportOnly: '' }
  const candidate = applyBuilder(enforced, config)
  const withReport = config.collectReports ? `${candidate}; report-uri ${CSP_REPORT_PATH}` : candidate
  if (config.mode === 'enforce') return { enforce: withReport, reportOnly: '' }
  return { enforce: '', reportOnly: withReport }
}

// ---------------------------------------------------------------------------------------------
// Violation reports
// ---------------------------------------------------------------------------------------------

export type Violation = {
  /** The directive that fired, e.g. script-src-elem. */
  directive: string
  /** What was blocked: an origin, a scheme such as data:, or inline / eval. */
  blocked: string
  /** The page it happened on (path only). */
  page: string
  disposition: 'enforce' | 'report'
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

/** Reduces a blocked URI to what a policy source can name: an origin or a scheme. */
export function blockedSource(blockedUri: string): string {
  const value = blockedUri.trim()
  if (!value || value === 'inline' || value === 'eval' || value === 'wasm-eval' || value === 'trusted-types-policy') return value || 'inline'
  if (/^(data|blob|filesystem|mediastream):/i.test(value)) return `${value.split(':')[0].toLowerCase()}:`
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'wss:' || url.protocol === 'ws:') return url.origin
    return `${url.protocol}`
  } catch {
    return value.slice(0, 200)
  }
}

const pathOf = (documentUri: string): string => {
  try {
    return new URL(documentUri).pathname.slice(0, 200)
  } catch {
    return documentUri.slice(0, 200)
  }
}

function fromBody(body: Record<string, unknown>): Violation | null {
  const directive = str(body['effective-directive'] ?? body.effectiveDirective ?? body['violated-directive'] ?? body.violatedDirective, 80).split(/\s+/)[0].toLowerCase()
  if (!/^[a-z][a-z-]*$/.test(directive)) return null
  const blockedRaw = str(body['blocked-uri'] ?? body.blockedURL ?? body.blockedUri, 2000)
  const documentRaw = str(body['document-uri'] ?? body.documentURL ?? body.documentUri, 2000)
  const disposition = body.disposition === 'report' ? 'report' : 'enforce'
  return { directive, blocked: blockedSource(blockedRaw), page: pathOf(documentRaw), disposition }
}

/**
 * Reads a posted report in either format: the legacy report-uri body ({"csp-report": {...}}) or the
 * Reporting API ([{ "type": "csp-violation", "body": {...} }]). Returns at most 20 violations; anything
 * that is not a CSP violation is ignored.
 */
export function parseReports(payload: unknown): Violation[] {
  const out: Violation[] = []
  const items = Array.isArray(payload) ? payload : [payload]
  for (const item of items.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const body = obj['csp-report'] && typeof obj['csp-report'] === 'object' ? (obj['csp-report'] as Record<string, unknown>) : obj.type === 'csp-violation' && obj.body && typeof obj.body === 'object' ? (obj.body as Record<string, unknown>) : null
    const violation = body ? fromBody(body) : null
    if (violation) out.push(violation)
  }
  return out
}

/** Browser extension and injected-script noise that is never worth a click. */
export function isReportNoise(v: Violation): boolean {
  return /^(chrome|moz|safari|ms-browser|webkit-masked-url|about|resource|edge)/i.test(v.blocked) || v.blocked === 'trusted-types-policy'
}

/** The picker directive a violation maps to (script-src-elem -> script-src, and so on), or null when it cannot be fixed by a source. */
export function directiveForViolation(directive: string): string | null {
  const base = directive.replace(/-(elem|attr)$/, '')
  return PICKER_NAMES.has(base) ? base : null
}

/**
 * The one-click fix for a violation: which directive to widen and with what source. Null when the block is
 * for inline code or eval (a host cannot fix those; they need 'unsafe-inline' / 'unsafe-eval' or a nonce)
 * or for a directive the picker does not offer.
 */
export function suggestionFor(v: Pick<Violation, 'directive' | 'blocked'>): { directive: string; source: string } | null {
  const directive = directiveForViolation(v.directive)
  if (!directive) return null
  if (v.blocked === 'inline' || v.blocked === 'eval' || v.blocked === 'wasm-eval' || !v.blocked) return null
  return { directive, source: v.blocked }
}

/** Adds one source to a directive of the config (idempotent). Returns a new config. */
export function addSource(config: CspBuilderConfig, directive: string, source: string): CspBuilderConfig {
  const current = config.directives[directive] ?? { sources: [], replace: false }
  if (current.sources.includes(source)) return config
  return { ...config, directives: { ...config.directives, [directive]: { ...current, sources: [...current.sources, source].slice(0, MAX_SOURCES_PER_DIRECTIVE) } } }
}
