import { resolveD1Binding } from '@/cms/db/connect'

/**
 * Who can sign in with what. Three sign-in places exist: the admin sign-in (staff), the account
 * sign-in (customers, `/account/sign-in`) and the member sign-in (`/account/member-sign-in`). For
 * each, the owner can block individual methods, password included, with two guards: the admin
 * sign-in always keeps its password, and no customer or member place can be left with no way in
 * (see `placeHasWayIn` in authMethods.ts). Nothing is blocked until the owner says so, so every
 * existing site behaves as before. Stored as one JSON row in `eg_kv` (no schema change). A blocked
 * method is hidden from the form and refused by the server.
 */

export type MatrixArea = 'admin' | 'account' | 'members'
export type AuthMatrix = { admin: string[]; account: string[]; members: string[] }

export const MATRIX_AREAS: readonly MatrixArea[] = ['admin', 'account', 'members']

export const MATRIX_KEY = 'auth-method-matrix'
export const MATRIX_METHODS = ['password', 'magic-link', 'email-code', 'passkeys', 'social-google', 'social-github', 'social-apple', 'social-facebook', 'social-microsoft', 'social-discord', 'social-x', 'social-linkedin', 'social-tiktok', 'social-slack', 'social-oidc'] as const

export const emptyMatrix = (): AuthMatrix => ({ admin: [], account: [], members: [] })

const clean = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && (MATRIX_METHODS as readonly string[]).includes(v)))] : []

export function parseMatrix(raw: unknown): AuthMatrix {
  try {
    const data = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown> | null)
    return { admin: clean(data?.admin), account: clean(data?.account), members: clean(data?.members) }
  } catch {
    return emptyMatrix()
  }
}

export const methodAllowed = (matrix: AuthMatrix, area: MatrixArea, method: string): boolean => !matrix[area].includes(method)

export function setBlocked(matrix: AuthMatrix, area: MatrixArea, method: string, blocked: boolean): AuthMatrix {
  if (!(MATRIX_METHODS as readonly string[]).includes(method)) return matrix
  // Staff can always sign in with a password, so the admin sign-in can never lock the owner out.
  if (area === 'admin' && method === 'password' && blocked) return matrix
  const rest = matrix[area].filter((m) => m !== method)
  return { ...matrix, [area]: blocked ? [...rest, method] : rest }
}

let cache: { at: number; value: AuthMatrix } | null = null

export async function readMatrix(): Promise<AuthMatrix> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value
  try {
    const d1 = await resolveD1Binding()
    const row = await d1.prepare('SELECT data FROM `eg_kv` WHERE `key` = ?').bind(MATRIX_KEY).first<{ data: string }>()
    const value = row ? parseMatrix(row.data) : emptyMatrix()
    cache = { at: Date.now(), value }
    return value
  } catch {
    return emptyMatrix()
  }
}

export async function writeMatrix(matrix: AuthMatrix): Promise<void> {
  const d1 = await resolveD1Binding()
  await d1
    .prepare('INSERT INTO `eg_kv` (`key`, `data`) VALUES (?, ?) ON CONFLICT(`key`) DO UPDATE SET `data` = excluded.`data`')
    .bind(MATRIX_KEY, JSON.stringify(matrix))
    .run()
  cache = null
}
