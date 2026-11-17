/**
 * Local pickup locations. Pure: no I/O.
 * An admin lists them in the shipping method, one per line: Name | Address | Hours | Instructions
 * (everything after the name is optional). Checkout offers one shipping option per location.
 */

export type PickupLocation = { name: string; address: string; hours: string; instructions: string }

export const PICKUP_MAX_LOCATIONS = 20

const clip = (value: string, max: number): string => value.trim().slice(0, max)

export function parsePickupLocations(text: unknown): PickupLocation[] {
  if (typeof text !== 'string') return []
  const out: PickupLocation[] = []
  for (const line of text.split(/\r?\n/)) {
    const [name = '', address = '', hours = '', ...rest] = line.split('|')
    if (!name.trim()) continue
    out.push({ name: clip(name, 80), address: clip(address, 200), hours: clip(hours, 120), instructions: clip(rest.join('|'), 300) })
    if (out.length >= PICKUP_MAX_LOCATIONS) break
  }
  return out
}

/** Readable lines for an email, invoice or packing slip. */
export function pickupLines(location: Partial<PickupLocation> | null | undefined): string[] {
  if (!location?.name) return []
  return [location.name, location.address ?? '', location.hours ? `Hours: ${location.hours}` : '', location.instructions ?? ''].filter(Boolean)
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const dayIndex = (word: string): number => DAYS.indexOf(word.toLowerCase().slice(0, 3))

/**
 * Is a pickup place closed on this weekday? Reads hours text such as "Mon-Fri 9-5; Sat 10-2" or "Sun closed".
 * Returns true only when the text names days and none of them covers `weekday` (0 = Sunday), or the day is marked closed.
 * Text with no day names (for example "9-5 daily") is never reported as closed.
 */
export function pickupClosedOn(hours: string | null | undefined, weekday: number): boolean {
  if (!hours) return false
  const open = new Set<number>()
  const closed = new Set<number>()
  let sawDay = false
  for (const part of hours.split(/[;,]/)) {
    const match = part.match(/^\s*([a-z]{3,9})(?:\s*(?:-|to|–)\s*([a-z]{3,9}))?\b(.*)$/i)
    if (!match) continue
    const from = dayIndex(match[1])
    if (from < 0) continue
    const to = match[2] ? dayIndex(match[2]) : from
    if (to < 0) continue
    sawDay = true
    const isClosed = /\bclosed\b/i.test(match[3])
    for (let d = from; ; d = (d + 1) % 7) {
      ;(isClosed ? closed : open).add(d)
      if (d === to) break
    }
  }
  if (!sawDay) return false
  return closed.has(weekday) || !open.has(weekday)
}
