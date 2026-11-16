/**
 * Cart note and gift message (Task 23c). Kept in this browser while the shopper browses, then pre-filled into the
 * checkout's Order notes field, so nothing new is stored on the order: the staff see one note. Only offered
 * when the shop has switched the Order notes checkout field on.
 */

export type CartNote = { note: string; gift: boolean; giftMessage: string }

export const CART_NOTE_KEY = 'engage-cart-note'
export const NOTE_MAX = 500
export const GIFT_MAX = 200

export const EMPTY_NOTE: CartNote = { note: '', gift: false, giftMessage: '' }

export function parseCartNote(raw: string | null): CartNote {
  if (!raw) return EMPTY_NOTE
  try {
    const d = JSON.parse(raw) as Partial<CartNote>
    return {
      note: typeof d.note === 'string' ? d.note.slice(0, NOTE_MAX) : '',
      gift: d.gift === true,
      giftMessage: typeof d.giftMessage === 'string' ? d.giftMessage.slice(0, GIFT_MAX) : '',
    }
  } catch {
    return EMPTY_NOTE
  }
}

/** The single text that goes into the Order notes field. Empty when there is nothing to say. */
export function composeOrderNote(n: CartNote): string {
  const parts: string[] = []
  const note = n.note.trim()
  if (note) parts.push(note)
  const gift = n.giftMessage.trim()
  if (n.gift) parts.push(gift ? `Gift message: ${gift}` : 'This order is a gift.')
  return parts.join('\n')
}
