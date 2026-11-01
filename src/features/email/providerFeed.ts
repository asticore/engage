import { suppressAddress } from './suppression'
import type { ProviderEvent } from './providerEvents'

/**
 * Puts each address a provider reported on the suppression list (task 7b). Returns how many rows were new.
 * One address that cannot be written does not stop the rest, and nothing here throws.
 */
export async function recordProviderEvents(provider: string, events: ProviderEvent[]): Promise<number> {
  let recorded = 0
  for (const event of events) {
    try {
      if (await suppressAddress(event.address, event.reason, `${provider}:${event.type}`)) recorded += 1
    } catch {
      /* skipped */
    }
  }
  return recorded
}
