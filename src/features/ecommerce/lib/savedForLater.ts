/**
 * Save for later (Task 23c). Lines moved out of the cart are kept in this browser (local storage), so
 * they survive a reload and are not counted, priced or held. Moving one back goes through the normal add to cart,
 * so stock, limits and prices are checked again at that moment.
 */

export type SavedLine = {
  product: number
  variation: string | null
  quantity: number
  title: string
  note: string | null
  addOns?: unknown
}

export const SAVED_KEY = 'engage-saved-for-later'
export const MAX_SAVED = 30

export function parseSaved(raw: string | null): SavedLine[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    const out: SavedLine[] = []
    for (const row of data) {
      const r = row as Partial<SavedLine>
      if (typeof r.product !== 'number' || !Number.isInteger(r.product) || r.product < 1) continue
      const quantity = typeof r.quantity === 'number' && Number.isInteger(r.quantity) && r.quantity >= 1 ? Math.min(r.quantity, 999) : 1
      out.push({ product: r.product, variation: typeof r.variation === 'string' ? r.variation : null, quantity, title: typeof r.title === 'string' ? r.title.slice(0, 200) : 'Item', note: typeof r.note === 'string' ? r.note.slice(0, 200) : null, ...(r.addOns !== undefined ? { addOns: r.addOns } : {}) })
    }
    return out.slice(0, MAX_SAVED)
  } catch {
    return []
  }
}

/** The same product and variation merges into one saved line. */
export function addSaved(list: SavedLine[], line: SavedLine): SavedLine[] {
  const same = (a: SavedLine) => a.product === line.product && a.variation === line.variation && JSON.stringify(a.addOns ?? null) === JSON.stringify(line.addOns ?? null)
  const index = list.findIndex(same)
  if (index === -1) return [line, ...list].slice(0, MAX_SAVED)
  return list.map((l, i) => (i === index ? { ...l, quantity: Math.min(999, l.quantity + line.quantity) } : l))
}

export function removeSaved(list: SavedLine[], index: number): SavedLine[] {
  return list.filter((_, i) => i !== index)
}
