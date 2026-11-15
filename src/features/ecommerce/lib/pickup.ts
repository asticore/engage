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
