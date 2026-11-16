import { toResetEvery, type ResetEvery } from './core'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results

export type DemoSettings = { resetEvery: ResetEvery; lastResetAt: string | null; lastResult: string; banner: string }
export const DEFAULT_DEMO_SETTINGS: DemoSettings = { resetEvery: 'off', lastResetAt: null, lastResult: '', banner: '' }

export async function getSettings(d1: D1): Promise<DemoSettings> {
  try {
    const r = (await all(d1, 'SELECT reset_every, last_reset_at, last_result, banner FROM eg_demo_settings WHERE id = 1'))[0]
    if (!r) return DEFAULT_DEMO_SETTINGS
    return { resetEvery: toResetEvery(r.reset_every), lastResetAt: r.last_reset_at ? String(r.last_reset_at) : null, lastResult: String(r.last_result ?? ''), banner: String(r.banner ?? '') }
  } catch {
    return DEFAULT_DEMO_SETTINGS
  }
}

export async function saveSettings(d1: D1, v: { resetEvery: ResetEvery; banner: string }, nowIso: string): Promise<void> {
  await d1
    .prepare("INSERT INTO eg_demo_settings (id, reset_every, banner, updated_at) VALUES (1, ?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET reset_every = ?1, banner = ?2, updated_at = ?3")
    .bind(v.resetEvery, v.banner, nowIso)
    .run()
}

export async function markReset(d1: D1, result: string, nowIso: string): Promise<void> {
  await d1
    .prepare("INSERT INTO eg_demo_settings (id, last_reset_at, last_result, updated_at) VALUES (1, ?1, ?2, ?1) ON CONFLICT(id) DO UPDATE SET last_reset_at = ?1, last_result = ?2, updated_at = ?1")
    .bind(nowIso, result.slice(0, 500))
    .run()
}

export async function saveSnapshot(d1: D1, body: string, nowIso: string): Promise<void> {
  await d1
    .prepare('INSERT INTO eg_demo_snapshots (id, taken_at, size, body) VALUES (1, ?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET taken_at = ?1, size = ?2, body = ?3')
    .bind(nowIso, body.length, body)
    .run()
}

export async function snapshotInfo(d1: D1): Promise<{ takenAt: string; size: number } | null> {
  try {
    const r = (await all(d1, 'SELECT taken_at, size FROM eg_demo_snapshots WHERE id = 1'))[0]
    return r ? { takenAt: String(r.taken_at), size: Number(r.size ?? 0) } : null
  } catch {
    return null
  }
}

export async function snapshotBody(d1: D1): Promise<string | null> {
  const r = (await all(d1, 'SELECT body FROM eg_demo_snapshots WHERE id = 1'))[0]
  return r ? String(r.body ?? '') : null
}
