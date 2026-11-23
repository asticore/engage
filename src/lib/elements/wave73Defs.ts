import type { ElementDef } from './registry'

/**
 * Wave 73 (Task 10, 29b): the My account element. A client element, so a cached page stays static: it asks
 * /api/visibility-state who is signed in, shows the sign-in form to visitors and the account sections to customers.
 * Each section opens the real account screen (orders, addresses, profile, bookings), so every rule stays on the server.
 * Renderer: Wave73Elements.tsx.
 */

export const WAVE73_ELEMENTS: ElementDef[] = [
  {
    type: 'my-account', label: 'My account', icon: String.fromCodePoint(0x1f464), category: 'interactive',
    description: 'A customer area for any page: the sign-in form for visitors, and tabs for orders, addresses, profile and bookings for signed-in customers.',
    fields: [
      { name: 'showOrders', label: 'Orders tab', type: 'checkbox' },
      { name: 'showAddresses', label: 'Addresses tab', type: 'checkbox' },
      { name: 'showProfile', label: 'Profile tab', type: 'checkbox' },
      { name: 'showBookings', label: 'Bookings tab', type: 'checkbox' },
      { name: 'heading', label: 'Heading', type: 'text' },
    ],
    defaultProps: () => ({ showOrders: true, showAddresses: true, showProfile: true, showBookings: true, heading: 'My account' }),
  },
]
