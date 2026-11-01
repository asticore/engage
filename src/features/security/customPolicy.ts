/**
 * The custom Content-Security-Policy typed in Security > Headers.
 *
 * A custom policy is MERGED into the default one rather than replacing it: each
 * source the admin lists is added to the same directive in the default policy
 * (or the directive is added when the default has none). A replacement policy
 * forgot the font, embed and analytics hosts the default already allows, and
 * the site broke without an error. A directive whose only source is 'none'
 * replaces the default for that directive, so a lock-down still works.
 *
 * Validation catches typos before the policy is saved: unknown directive names
 * and source tokens that cannot be a keyword, a scheme, a host or a nonce/hash.
 * It returns the first problem as a sentence that names the directive, because
 * the field is a textarea and a line number would be misleading after the
 * newlines are collapsed.
 */

const KNOWN_DIRECTIVES = new Set([
  'default-src', 'script-src', 'script-src-elem', 'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr',
  'img-src', 'font-src', 'connect-src', 'media-src', 'object-src', 'frame-src', 'child-src', 'worker-src',
  'manifest-src', 'prefetch-src', 'frame-ancestors', 'base-uri', 'form-action', 'navigate-to', 'sandbox',
  'upgrade-insecure-requests', 'block-all-mixed-content', 'plugin-types', 'report-uri', 'report-to',
  'require-trusted-types-for', 'trusted-types',
])

/** Directives that take no sources at all. */
const VALUELESS = new Set(['upgrade-insecure-requests', 'block-all-mixed-content'])

/** Directives whose tokens are not source expressions, so they are not checked as sources. */
const FREE_TOKEN = new Set(['sandbox', 'plugin-types', 'report-uri', 'report-to', 'require-trusted-types-for', 'trusted-types'])

const KEYWORD = /^'(self|none|unsafe-inline|unsafe-eval|unsafe-hashes|strict-dynamic|report-sample|unsafe-allow-redirects|wasm-unsafe-eval|inline-speculation-rules)'$/i
const NONCE_OR_HASH = /^'(nonce-[A-Za-z0-9+/=_-]+|sha(256|384|512)-[A-Za-z0-9+/=]+)'$/
const SCHEME = /^[a-z][a-z0-9+.-]*:$/i
const HOST = /^(https?:\/\/)?(\*\.)?([a-z0-9-]+\.)*[a-z0-9-]+(:(\d{1,5}|\*))?(\/[^\s'"]*)?$/i

type Directive = { name: string; sources: string[] }

/** Splits a policy into directives, lower-casing the names and dropping empty parts. */
function parsePolicy(policy: string): Directive[] {
  return policy
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...sources] = part.split(/\s+/)
      return { name: name.toLowerCase(), sources }
    })
}

function sourceProblem(token: string): string | null {
  if (token === '*') return null
  if (token.startsWith("'")) {
    return KEYWORD.test(token) || NONCE_OR_HASH.test(token) ? null : `"${token}" is not a keyword the browser knows.`
  }
  if (token.includes(',')) return 'Separate sources with spaces, not commas.'
  if (SCHEME.test(token)) return null
  if (HOST.test(token)) return null
  return `"${token}" is not a valid host, scheme or keyword.`
}

/** Returns null when the policy is valid, or the first problem as a sentence for the field error. */
export function validateCustomPolicy(policy: string): string | null {
  const collapsed = policy.replace(/\s+/g, ' ').trim()
  if (!collapsed) return null
  if (/["<>]/.test(collapsed)) return 'Remove quotation marks and angle brackets: a policy is only directive names and sources.'
  for (const { name, sources } of parsePolicy(collapsed)) {
    if (!/^[a-z][a-z-]*$/.test(name) || !KNOWN_DIRECTIVES.has(name)) {
      return `"${name}" is not a directive this policy knows. Check the spelling, for example script-src or img-src.`
    }
    if (VALUELESS.has(name) && sources.length > 0) return `${name} takes no sources. Remove what follows it.`
    if (FREE_TOKEN.has(name)) continue
    for (const token of sources) {
      const problem = sourceProblem(token)
      if (problem) return `In ${name}: ${problem}`
    }
  }
  return null
}

/**
 * Adds the custom policy's sources to the base (default) policy. Only widens a
 * directive, except that a custom directive whose sole source is 'none' takes
 * the place of the base directive. Returns the policy as one header value.
 */
export function mergeCustomPolicy(base: string, custom: string): string {
  const merged = new Map<string, string[]>()
  for (const { name, sources } of parsePolicy(base)) merged.set(name, [...sources])

  for (const { name, sources } of parsePolicy(custom.replace(/\s+/g, ' ').trim())) {
    const current = merged.get(name)
    if (!current) {
      merged.set(name, [...sources])
    } else if (sources.length === 1 && sources[0] === "'none'") {
      merged.set(name, ["'none'"])
    } else if (current.length === 1 && current[0] === "'none'") {
      merged.set(name, [...sources])
    } else {
      for (const source of sources) if (!current.includes(source)) current.push(source)
    }
  }

  return [...merged.entries()].map(([name, sources]) => (sources.length ? `${name} ${sources.join(' ')}` : name)).join('; ')
}

/** Field validator for the Content-Security-Policy setting: true, or the message shown beside the field. */
export const validateCustomPolicyField = (value: unknown): true | string => {
  if (typeof value !== 'string') return true
  return validateCustomPolicy(value) ?? true
}
