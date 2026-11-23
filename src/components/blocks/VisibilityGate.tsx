'use client'

import { useEffect } from 'react'

import { evaluateRules, needsAuthState, parseRules, type VisContext, type VisRules } from '@/lib/visibilityRules'

const STORE_KEY = 'eg-vis-state'
const TTL_MS = 5 * 60 * 1000
/** The cart keeps its item count here (EcommerceProvider), so the Cart condition needs no request. */
export const CART_COUNT_KEY = 'gracengatsby-cart-count'
export const CART_COUNT_EVENT = 'engage:cart-count'

type AuthState = { loggedIn: boolean | null; roles: string[]; country?: string | null; ordered?: boolean | null }

let inflight: Promise<AuthState> | null = null

function readCache(): AuthState | null {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { t?: number; loggedIn?: boolean; roles?: string[]; country?: string | null }
    if (typeof v.t !== 'number' || Date.now() - v.t > TTL_MS || typeof v.loggedIn !== 'boolean') return null
    return { loggedIn: v.loggedIn, roles: Array.isArray(v.roles) ? v.roles.filter((x) => typeof x === 'string') : [], country: typeof v.country === 'string' ? v.country : null, ordered: typeof (v as { ordered?: unknown }).ordered === 'boolean' ? (v as { ordered: boolean }).ordered : null }
  } catch {
    return null
  }
}

function writeCache(s: AuthState): void {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ t: Date.now(), loggedIn: s.loggedIn, roles: s.roles, country: s.country ?? null, ordered: s.ordered ?? null }))
  } catch {
    /* storage blocked: the next page just asks again */
  }
}

/** Who is signed in. Cached in sessionStorage; one in-flight request shared by every block. */
function loadAuth(needOrders = false): Promise<AuthState> {
  const cached = needOrders ? null : readCache()
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = fetch(needOrders ? '/api/visibility-state?orders=1' : '/api/visibility-state', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { loggedIn?: unknown; roles?: unknown; country?: unknown; ordered?: unknown } | null): AuthState => {
        if (!j || typeof j.loggedIn !== 'boolean') return { loggedIn: null, roles: [] }
        const state: AuthState = { loggedIn: j.loggedIn, roles: Array.isArray(j.roles) ? j.roles.filter((x): x is string => typeof x === 'string') : [], country: typeof j.country === 'string' ? j.country : null, ordered: typeof j.ordered === 'boolean' ? j.ordered : null }
        writeCache(state)
        return state
      })
      .catch((): AuthState => ({ loggedIn: null, roles: [] }))
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Items in the cart, from the count the cart keeps in this browser (0 when there is no cart). */
function readCartCount(): number {
  try {
    const n = Number(window.localStorage.getItem(CART_COUNT_KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

/** Evaluates every [data-eg-cond] block on the page and marks it shown (data-eg-ok) or hidden (data-eg-off). */
function apply(): void {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-eg-cond]'))
  const items: Array<{ el: HTMLElement; rules: VisRules }> = []
  for (const el of nodes) {
    const rules = parseRules(el.getAttribute('data-eg-cond'))
    if (rules) items.push({ el, rules })
  }
  if (items.length === 0) return
  const href = window.location.pathname + window.location.search
  const finish = (auth: AuthState) => {
    const now = new Date()
    const ctx: VisContext = {
      now: now.getTime(),
      loggedIn: auth.loggedIn,
      roles: auth.roles,
      href,
      // Weekday and time of day are the visitor's own clock; language is the page's current language.
      day: now.getDay(),
      minutes: now.getHours() * 60 + now.getMinutes(),
      lang: document.documentElement.lang || '',
      width: window.innerWidth,
      cookie: document.cookie,
      country: auth.country ?? null,
      cartCount: readCartCount(),
      hasOrdered: auth.ordered ?? null,
    }
    for (const { el, rules } of items) {
      if (evaluateRules(rules, ctx)) {
        el.setAttribute('data-eg-ok', '')
        el.removeAttribute('data-eg-off')
      } else {
        el.setAttribute('data-eg-off', '')
        el.removeAttribute('data-eg-ok')
      }
    }
  }
  if (items.some((i) => needsAuthState(i.rules))) void loadAuth(items.some((i) => Boolean(i.rules.o))).then(finish)
  else finish({ loggedIn: null, roles: [] })
}

/** Mounted by StyledBlock for any block with rules; each mount re-scans the page (idempotent). */
export default function VisibilityGate(): null {
  useEffect(() => {
    apply()
    // The cart changed (item added or removed): re-check the Cart conditions.
    window.addEventListener(CART_COUNT_EVENT, apply)
    return () => window.removeEventListener(CART_COUNT_EVENT, apply)
  }, [])
  return null
}
