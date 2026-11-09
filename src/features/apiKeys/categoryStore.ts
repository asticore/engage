import { parseScopes } from './core'
import type { ApiCategory, ApiCategoryConfig, CategoryLimits, SubjectType } from './categories'
import type { D1Like } from './service'

/**
 * D1 access for API categories, who is in them, and the daily key usage counters. Bound statements
 * only. `getDb` resolves the binding per call, like the key store, so tests pass an in-memory D1.
 */

export type CategoryMember = { id: number; categoryId: number; subjectType: SubjectType; subjectId: string; createdAt: string }
export type KeyUsageDay = { day: string; requests: number; errors: number }

export type CategoryStore = {
  list(): Promise<ApiCategory[]>
  findById(id: number): Promise<ApiCategory | null>
  insert(config: ApiCategoryConfig, at: string): Promise<number>
  update(id: number, config: ApiCategoryConfig, at: string): Promise<void>
  remove(id: number): Promise<void>
  members(categoryId: number): Promise<CategoryMember[]>
  /** Puts the subject in the category, moving it if it was in another. */
  assign(categoryId: number, subjectType: SubjectType, subjectId: string, at: string): Promise<void>
  unassign(memberId: number): Promise<void>
  /** The category that governs this person: their own row first, then one of their organisations. Null when none. */
  categoryForUser(userId: number): Promise<CategoryLimits | null>
  count(): Promise<number>
}

export type UsageStore = {
  record(keyId: number, day: string, error: boolean): Promise<void>
  forKey(keyId: number, sinceDay: string): Promise<KeyUsageDay[]>
  pruneBefore(day: string): Promise<void>
}

type RawCategory = { id: number; name: string; description: string; scopes: string; rate_per_minute: number; max_keys: number; created_at: string; updated_at: string }
type RawMember = { id: number; category_id: number; subject_type: string; subject_id: string; created_at: string }

const toCategory = (r: RawCategory): ApiCategory => ({
  id: Number(r.id),
  name: r.name,
  description: r.description ?? '',
  scopes: parseScopes(r.scopes),
  ratePerMinute: Number(r.rate_per_minute),
  maxKeys: Number(r.max_keys),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const CATEGORIES = '`eg_api_categories`'
const MEMBERS = '`eg_api_category_members`'
const USAGE = '`eg_api_key_usage`'

export function createD1CategoryStore(getDb: () => Promise<D1Like>): CategoryStore {
  const all = async <T>(sql: string, ...values: unknown[]): Promise<T[]> => {
    const db = await getDb()
    return ((await db.prepare(sql).bind(...values).all<T>()).results ?? []) as T[]
  }
  const first = async <T>(sql: string, ...values: unknown[]): Promise<T | null> => {
    const db = await getDb()
    return db.prepare(sql).bind(...values).first<T>()
  }
  const run = async (sql: string, ...values: unknown[]): Promise<{ meta?: { last_row_id?: number } }> => {
    const db = await getDb()
    return (await db.prepare(sql).bind(...values).run()) as { meta?: { last_row_id?: number } }
  }
  return {
    async list() {
      return (await all<RawCategory>(`SELECT * FROM ${CATEGORIES} ORDER BY name COLLATE NOCASE`)).map(toCategory)
    },
    async findById(id) {
      const row = await first<RawCategory>(`SELECT * FROM ${CATEGORIES} WHERE id = ?`, id)
      return row ? toCategory(row) : null
    },
    async insert(config, at) {
      const result = await run(
        `INSERT INTO ${CATEGORIES} (name, description, scopes, rate_per_minute, max_keys, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        config.name,
        config.description,
        JSON.stringify(config.scopes),
        config.ratePerMinute,
        config.maxKeys,
        at,
        at,
      )
      return Number(result.meta?.last_row_id ?? 0)
    },
    async update(id, config, at) {
      await run(
        `UPDATE ${CATEGORIES} SET name = ?, description = ?, scopes = ?, rate_per_minute = ?, max_keys = ?, updated_at = ? WHERE id = ?`,
        config.name,
        config.description,
        JSON.stringify(config.scopes),
        config.ratePerMinute,
        config.maxKeys,
        at,
        id,
      )
    },
    async remove(id) {
      await run(`DELETE FROM ${MEMBERS} WHERE category_id = ?`, id)
      await run(`DELETE FROM ${CATEGORIES} WHERE id = ?`, id)
    },
    async members(categoryId) {
      const rows = await all<RawMember>(`SELECT * FROM ${MEMBERS} WHERE category_id = ? ORDER BY id`, categoryId)
      return rows.map((r) => ({ id: Number(r.id), categoryId: Number(r.category_id), subjectType: r.subject_type as SubjectType, subjectId: r.subject_id, createdAt: r.created_at }))
    },
    async assign(categoryId, subjectType, subjectId, at) {
      await run(
        `INSERT INTO ${MEMBERS} (category_id, subject_type, subject_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (subject_type, subject_id) DO UPDATE SET category_id = excluded.category_id`,
        categoryId,
        subjectType,
        subjectId,
        at,
      )
    },
    async unassign(memberId) {
      await run(`DELETE FROM ${MEMBERS} WHERE id = ?`, memberId)
    },
    async categoryForUser(userId) {
      const own = await first<RawCategory>(
        `SELECT c.* FROM ${CATEGORIES} c JOIN ${MEMBERS} m ON m.category_id = c.id WHERE m.subject_type = 'user' AND m.subject_id = ? LIMIT 1`,
        String(userId),
      )
      if (own) return limits(toCategory(own))
      // Organisation tables exist only once that feature is on; a missing table means no organisation row.
      try {
        const viaOrg = await first<RawCategory>(
          `SELECT c.* FROM ${CATEGORIES} c JOIN ${MEMBERS} m ON m.category_id = c.id JOIN \`eg_organization_members\` om ON om.organization_id = m.subject_id WHERE m.subject_type = 'organization' AND om.user_id = ? ORDER BY c.rate_per_minute DESC, c.id LIMIT 1`,
          userId,
        )
        return viaOrg ? limits(toCategory(viaOrg)) : null
      } catch {
        return null
      }
    },
    async count() {
      const row = await first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${CATEGORIES}`)
      return Number(row?.n ?? 0)
    },
  }
}

const limits = (c: ApiCategory): CategoryLimits => ({ id: c.id, name: c.name, scopes: c.scopes, ratePerMinute: c.ratePerMinute, maxKeys: c.maxKeys })

export function createD1UsageStore(getDb: () => Promise<D1Like>): UsageStore {
  return {
    async record(keyId, day, error) {
      const db = await getDb()
      await db
        .prepare(`INSERT INTO ${USAGE} (key_id, day, requests, errors) VALUES (?, ?, 1, ?) ON CONFLICT (key_id, day) DO UPDATE SET requests = requests + 1, errors = errors + excluded.errors`)
        .bind(keyId, day, error ? 1 : 0)
        .run()
    },
    async forKey(keyId, sinceDay) {
      const db = await getDb()
      const rows = await db.prepare(`SELECT day, requests, errors FROM ${USAGE} WHERE key_id = ? AND day >= ? ORDER BY day DESC`).bind(keyId, sinceDay).all<{ day: string; requests: number; errors: number }>()
      return (rows.results ?? []).map((r) => ({ day: r.day, requests: Number(r.requests), errors: Number(r.errors) }))
    },
    async pruneBefore(day) {
      const db = await getDb()
      await db.prepare(`DELETE FROM ${USAGE} WHERE day < ?`).bind(day).run()
    },
  }
}

export const usageDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
