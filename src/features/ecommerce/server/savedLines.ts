import { addSaved, MAX_SAVED, type SavedLine } from '../lib/savedForLater'

/**
 * Saved for later, kept for a signed-in shopper (Task 23c). The browser list and the account list are merged
 * the way a guest cart is merged on sign-in: the same product and variation adds quantities. The result is written back,
 * so every device ends up with the same list.
 */

type Stmt = { bind(...v: unknown[]): { all<T>(): Promise<{ results?: T[] }>; run(): Promise<unknown> } }
export type D1Saved = { prepare(sql: string): Stmt; batch?: (s: unknown[]) => Promise<unknown> }

type Row = { product_id: number; variation: string; quantity: number; title: string; note: string | null }

export async function readSaved(d1: D1Saved, userId: number): Promise<SavedLine[]> {
  const res = await d1.prepare('SELECT product_id, variation, quantity, title, note FROM eg_saved_cart_lines WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?').bind(userId, MAX_SAVED).all<Row>()
  return (res.results ?? []).map((r) => ({ product: Number(r.product_id), variation: r.variation === '' ? null : r.variation, quantity: Number(r.quantity), title: r.title, note: r.note }))
}

/** Replaces the user's list with `lines` (already merged and capped). */
export async function writeSaved(d1: D1Saved, userId: number, lines: SavedLine[]): Promise<void> {
  await d1.prepare('DELETE FROM eg_saved_cart_lines WHERE user_id = ?').bind(userId).run()
  for (const l of lines.slice(0, MAX_SAVED)) {
    await d1
      .prepare('INSERT INTO eg_saved_cart_lines (user_id, product_id, variation, quantity, title, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, product_id, variation) DO UPDATE SET quantity = excluded.quantity, title = excluded.title, note = excluded.note, updated_at = excluded.updated_at')
      .bind(userId, l.product, l.variation ?? '', l.quantity, l.title.slice(0, 200), l.note, new Date().toISOString())
      .run()
  }
}

/** Account list first, then the browser's lines merged in. */
export function mergeSavedLists(account: SavedLine[], browser: SavedLine[]): SavedLine[] {
  let out = account
  for (const line of [...browser].reverse()) out = addSaved(out, line)
  return out.slice(0, MAX_SAVED)
}
