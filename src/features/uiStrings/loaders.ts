import type { AdminUiLocale } from './locales'
import type { UiDictionary } from './keys'

/**
 * Dictionaries are static JSON files (`public/ui-strings/<locale>.json`, written by
 * `scripts/gen-ui-strings.mjs` from `dictionaries/*.ts`), not code. The Worker reads
 * them through the ASSETS binding and the browser fetches them, so no language is
 * bundled into the Worker script.
 *
 * `en` is not here. It is the source table (`keys.ts`), so it is always present and
 * is the final fallback for every other language.
 */
const cache = new Map<string, Promise<UiDictionary>>()

type AssetsBinding = { fetch(request: Request): Promise<Response> }

async function readDictionary(locale: string): Promise<UiDictionary> {
  const path = `/ui-strings/${locale}.json`
  if (typeof window !== 'undefined' && !/jsdom/i.test(navigator.userAgent)) {
    const res = await fetch(path)
    if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status}).`)
    return (await res.json()) as UiDictionary
  }
  // Worker: same context OpenNext's getCloudflareContext() reads.
  const ctx = (globalThis as Record<symbol, unknown>)[Symbol.for('__cloudflare-context__')] as
    | { env?: { ASSETS?: AssetsBinding } }
    | undefined
  const assets = ctx?.env?.ASSETS
  if (assets) {
    const res = await assets.fetch(new Request(`https://assets.invalid${path}`))
    if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status}).`)
    return (await res.json()) as UiDictionary
  }
  // Node (tests, local scripts): read the file from public/.
  const fs = await import(/* webpackIgnore: true */ 'node:fs/promises')
  const nodePath = await import(/* webpackIgnore: true */ 'node:path')
  const file = nodePath.join(process.cwd(), 'public', path)
  return JSON.parse(await fs.readFile(file, 'utf8')) as UiDictionary
}

function load(locale: string): () => Promise<{ default: UiDictionary }> {
  return async () => {
    let pending = cache.get(locale)
    if (!pending) {
      pending = readDictionary(locale)
      cache.set(locale, pending)
      pending.catch(() => cache.delete(locale))
    }
    return { default: await pending }
  }
}

export const DICTIONARY_LOADERS: Record<
  Exclude<AdminUiLocale, 'en'>,
  () => Promise<{ default: UiDictionary }>
> = {
  es: load('es'),
  fr: load('fr'),
  de: load('de'),
  pt: load('pt'),
  it: load('it'),
  nl: load('nl'),
  ja: load('ja'),
  'zh-Hans': load('zh-Hans'),
  ko: load('ko'),
  ar: load('ar'),
  hi: load('hi'),
  ru: load('ru'),
  he: load('he'),
}
