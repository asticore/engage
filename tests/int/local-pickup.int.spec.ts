import { describe, expect, it } from 'vitest'

import { renderPackingSlipHtml } from '@/features/ecommerce/lib/invoice'
import { parsePickupLocations, pickupLines } from '@/features/ecommerce/lib/pickup'
import { quoteShipping, type ShippingZone } from '@/features/ecommerce/lib/shipping'
import { renderOrderEmail } from '@/features/ecommerce/server/emails'

const zone = (pickupLocations: string | null): ShippingZone => ({
  id: 7,
  name: 'AU',
  regions: [{ type: 'country', country: 'AU' }],
  methods: [{ type: 'flat', title: 'Standard', cost: 10 }, { type: 'local_pickup', title: 'Pickup', cost: 0, pickupLocations }],
})
const cart = { subtotalCents: 5000, items: [{ productId: 1, quantity: 1 }] }

describe('local pickup', () => {
  it('reads one location per line, name only is fine', () => {
    expect(parsePickupLocations('Brisbane | 1 Main St | Mon-Fri 9-5 | Ask at the desk\n\nSydney')).toEqual([
      { name: 'Brisbane', address: '1 Main St', hours: 'Mon-Fri 9-5', instructions: 'Ask at the desk' },
      { name: 'Sydney', address: '', hours: '', instructions: '' },
    ])
    expect(parsePickupLocations(null)).toEqual([])
  })
  it('offers one option per location with an id that carries the choice', () => {
    const options = quoteShipping(cart, { country: 'AU' }, [zone('Brisbane | 1 Main St\nSydney')])
    expect(options.map((o) => o.id)).toEqual(['7:0', '7:1:0', '7:1:1'])
    expect(options[1]).toMatchObject({ title: 'Pickup: Brisbane', costCents: 0, taxable: false, pickup: { name: 'Brisbane' } })
  })
  it('keeps a single pickup choice when no locations are listed', () => {
    expect(quoteShipping(cart, { country: 'AU' }, [zone(null)]).map((o) => o.id)).toEqual(['7:0', '7:1'])
  })
  it('words the ready email with the place', () => {
    const order = { id: 5, customerEmail: 'a@b.test', shippingAddress: { firstName: 'Sam' }, shippingMethod: { type: 'local_pickup', title: 'Pickup', pickup: { name: 'Brisbane', address: '1 Main St', hours: '9-5' } } }
    const msg = renderOrderEmail('readyForPickup', order, { pickupLocation: pickupLines(order.shippingMethod.pickup).join('\n') })
    expect(msg.subject).toBe('Your order #5 is ready for pickup')
    expect(msg.text).toContain('Brisbane\n1 Main St\nHours: 9-5')
  })
  it('shows the collection point on the packing slip', () => {
    const html = renderPackingSlipHtml({ id: 5, lineItems: [], shippingMethod: { title: 'Pickup: Brisbane', pickup: { name: 'Brisbane', address: '1 Main St' } } } as never, { name: 'Shop' })
    expect(html).toContain('Collect from')
    expect(html).toContain('1 Main St')
  })
})
