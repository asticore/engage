# Events and tickets audit (Task 5, 9 Nov 2026)

Checked against the code, not live.

## What exists
- Ticket types: JSON `ticketTiers` on the event (name, description, price, capacity, sales end), ids for translation (`src/features/editScreens/tiers.ts`, `TicketTiersField.tsx`). Enforced on free RSVPs by `checkRsvpTier` (type required, on sale, room left).
- Capacity: event-level `capacity` enforced by `checkEventCapacity` on RSVP create; per-type capacity in `tierSales.ts`; page shows spots left.
- Free: public `RsvpForm` creates an `event-rsvps` row, sends the confirmation email (`rsvpConfirmation.ts`), fires the RSVP webhook, reminder cron, ICS file.
- Check-in: `EventCheckIn.tsx`, `/api/admin-event-checkin`, ticket code is the RSVP id (`#42`).
- Paid: event type `paid` plus one `ticketProduct`; page shows "Buy ticket" (AddToCartButton), normal shop checkout and order.

## Gaps
1. Paid events have no link between order and RSVP: a paid order creates no `event-rsvps` row, so paid buyers get no booking confirmation, are not on the check-in list, and are not counted against capacity. (Needs a decision: create RSVPs from `order.paid`, plus order id column and migration.)
2. Price tiers are display-only on paid events: one product, one price. Selling per type needs one product or variant per tier. (Decision.)
3. Refunds: refunding an order does not cancel or free the RSVP (follows from 1). No cancel-RSVP action for free events.
4. Capacity check counts then inserts, so two simultaneous RSVPs can both pass (D1 has no row lock).
5. Confirmation email does not name the ticket type.
6. `EventTiers.tsx`, `RsvpForm.tsx` and the event page use Tailwind-style utility classes, against the one-style-system rule (Shine classes). Not converted here (visual change, needs a live look).
7. Public strings on the event page ("Ticket types", "Sold out") are English only.

## Fixed in this change
- A sold-out event (no places left) showed the RSVP form or Buy ticket button; it now shows "Sold out" (`eventSaleMode`, tests in `tests/int/event-sale-mode.int.spec.ts`).
