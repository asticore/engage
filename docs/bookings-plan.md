# Bookings and scheduling: gap list and phased plan (Task 6)

Written 8 Nov 2026. Research only: no code was changed. Every "exists" claim cites a path under `/home/user/gracengatsby`. Paths below are relative to the repo root.

## Summary

- Today the CMS has event RSVPs (a head count on a dated event) and a form field type "appointment" (fixed start times, weekdays, capacity per start time). Neither is a booking system.
- There is no resource (staff, room, vehicle), no recurring availability store, no buffer, notice or cancellation rule, no reschedule, no calendar sync and no booking-specific reminder.
- Payments exist for the shop (orders, transactions, refunds). Forms can price a submission but the last hop to checkout is explicitly not built (`src/features/forms/pricing.ts`, comment near line 120).
- Recommendation: a new lazy "Bookings" feature with its own tables, built on a pure slot engine, reusing shop orders for money, the email and cron systems for notices, and the existing ICS builder.
- Matt picks the first phase (see "Decisions for Matt"). Phase 1 is an MVP for one provider; Phases 2 to 4 widen it to staff, rentals and hotels, and calendar sync.

## What exists today

| Capability | Where | Reusable for bookings? |
|---|---|---|
| Events (dated, capacity, online flag, venue, ticket product, recurrence, tiers) | `src/collections/Events.ts` (fields `startDate`, `endDate`, `location.isOnline`, `capacity`, `ticketProduct`, `rsvps`); recurrence in `src/features/editScreens/recurrence.ts`, `recurrenceGenerate.ts` (max 52 occurrences) | Partly. Good for group sessions and classes. An event is one fixed date, not a pool of open time the customer picks from. |
| Event RSVPs (name, email, guest count, notes, reminder stamp) | `src/collections/EventRSVPs.ts`; capacity check `src/hooks/checkEventCapacity.ts` (counts guests, count-then-insert, no lock) | Partly. Pattern for capacity and owner-only read rule is reusable. Not a booking record: no status lifecycle, no resource, no price. |
| Form field "appointment" (slot start times, weekdays, days ahead, max days ahead, capacity) | `src/features/forms/types.ts` (line 111 `appointment?`), `src/features/forms/slots.ts` (keys `YYYY-MM-DD HH:MM`, capacity 1..50), `slotStore.ts` (reads D1 via `json_extract` on `eg_form_submissions`, scan limit 2000), `slotGuard.ts` (check, insert, re-check; both racers can lose), `slotsEndpoint.ts` and `src/app/(engage)/api/form-slots/route.ts` (public, rate limited 60 per minute) | Partly. The pure helpers and the check-insert-recheck idea carry over. Storage in a JSON column of form entries cannot hold resources, durations, buffers or ranges, and no time zone is stored (times are plain text). |
| Form entries and pricing | `src/features/forms/pricing.ts`, `submit.ts` (`paymentStatus: 'unpaid' \| 'none'`, `buildCheckoutHandoff`), `src/engage-types.ts` (~line 1420 `payment.product`: "Required by the cart handoff once it is built") | Partly. Prices a submission but does not take payment. Do not build bookings on top of form entries. |
| Account portal "My bookings" | `src/app/(frontend)/account/bookings/page.tsx`, `src/features/accounts/bookings.ts` (reads `event-rsvps` by verified email), `src/features/accounts/access.ts` (`canSeeBookingsByEmail`), strings `portal.bookings.*` and `portal.search.bookingsHeading` in `src/features/uiStrings/dictionaries/*.ts`, search `src/features/accounts/accountSearch.ts` | Partly. The screen and email-verification rule are reusable; the data source is RSVPs only and the copy says "event bookings". Needs a second source and cancel or reschedule actions. |
| Webhook event `booking.made` | `src/features/webhooks/events.ts` (line 16), emitted for RSVPs in `src/features/webhooks/hooks.ts` (line 92); Task 26 in `docs/remaining-work.md` also expects a source `appointment` | Yes. Add cancelled, rescheduled, reminder-sent events beside it. |
| Shop checkout, orders, payments | `src/features/ecommerce/collections/Orders.ts` (status transitions), `Transactions.ts`, `OrderRefunds.ts`, `src/features/ecommerce/server/orders.ts`, `refunds.ts`, `payments/stripeAdapter.ts`, `paypalCheckout.ts`, `offlineCheckout.ts`; payment tables are never offered for deletion (`src/features/featureTables.ts`, `PAYMENT_RECORD_BASES`) | Partly. Orders reference products by relationship, so a booking needs either a service product per booking type or an order line with no product. Decision needed (see Payments). |
| Subscriptions and gift cards, store credit | `src/features/ecommerce/subscriptions/*`, `server/storedValue.ts` | Partly. Store credit is a possible refund target; subscriptions are not needed. |
| Email sending, templates, log, suppression | `src/features/email/index.ts` (`sendEmail`), `renderTemplate.ts`, `emailLog.ts`, `suppression.ts`, `recipientLocale.ts`, providers in `src/features/email/providers/` (Resend, Postmark, SendGrid, Mailgun, SES, Brevo, Cloudflare and others) | Yes. Add booking templates. Email designer lists "Event booking confirmation" (`src/admin/views/email-designer/designerModel.ts` line 208). |
| Reminder emails | `src/features/email/eventReminders.ts` (stamp `reminderSentAt` before sending, so one reminder per RSVP), `scheduledEmails.ts` (runs each tick, quiet hours), `schedule.ts` (`eventReminder.hoursBefore`, `isInQuietHours`, time zone from site `timezone`) | Partly. Same stamp-then-send pattern; needs its own sweep for bookings (several reminders, per type offsets). |
| Cron | `wrangler.jsonc` (`triggers.crons: ["*/5 * * * *"]`), `cloudflare-worker.ts` (`scheduled` calls `/api/cron/publish-scheduled` with an HMAC key), job list `src/features/cron/registry.ts` (name, label, schedule, feature gate), run log `src/features/cron/history.ts` | Yes. Add jobs "booking-holds" (expire holds) and "booking-reminders" with `feature: 'bookings'`. Five-minute resolution is enough. |
| ICS file | `src/features/editScreens/ics.ts` (`buildEventIcs`, `icsEscape`, `foldLine`), route `src/app/(engage)/api/events/[slug]/ics/route.ts` | Yes. Reuse for a booking attachment and per-resource feeds. No `METHOD:CANCEL` or sequence number yet. |
| Time zones | `src/features/editScreens/timeZone.ts` (`wallTimeIn`, `zonedToUtc`, default `Australia/Sydney`, DST safe day maths), site setting `timezone` in `src/features/site/detailsModel.ts` | Yes. This is the DST-safe core the slot engine needs. Only one zone per site today. |
| Roles and users | `src/collections/Users.ts` (roles admin, editor, viewer, customer), `src/features/roles/permissions.ts` (`can()`), custom roles | Partly. Staff could link to a user, but a hairdresser or a car has no login. Resources should be their own rows with an optional user link. |
| Domains and regions | `src/features/domains/*` (`model.ts`, `scope.ts`, `host.ts`) | Partly. A resource or booking type should be scopable to a domain the way other content is. Not researched in depth; confirm in Phase 1 design. |
| Feature switch and lazy tables | `src/features/registry.ts` (`FEATURES`, `FeatureDef.tables`), `src/features/featureTables.ts`, `src/features/provisionOnEnable.ts`, `src/migrations/provisioning.ts`, `src/features/starters.ts` | Yes. A `bookings` entry creates tables on first switch-on. |
| Google connection | `src/features/google/constants.ts` (`GOOGLE_SCOPES`: openid, email, analytics.readonly, webmasters, tagmanager.readonly, adsense.readonly), `auth.ts`, `state.ts` | Partly. OAuth plumbing exists. No calendar scope, and the current scopes are read-only (Search Console is the exception). Adding a calendar scope forces every connected site to re-consent. |
| Visual editor elements and form blocks | `src/components/blocks/elements/*`, `src/blocks/EventGrid.ts`, `src/features/forms/block.ts` | Yes. A "Booking widget" element follows the same registration as existing elements. |
| Rate limiting, privacy erase | `src/features/accounts/rateLimit.ts`, `src/features/privacy/*`; rule that erasing an account keeps entries (`docs/remaining-work.md`, Task 26 privacy item #164) | Yes. Bookings are a record of money and time; follow the same keep-or-anonymise rule. |

Not found anywhere in `src`: availability rules, resource or staff scheduling, buffers, notice windows, cancellation rules, reschedule, no-show, a video-link field on a booking, calendar write access, SMS reminders (Twilio exists for shipping text only: `src/features/sms/shippedText.ts`).

## Requirements matrix

| Scope item | Status | Notes |
|---|---|---|
| Bookings in addition to events | Partial | RSVPs and portal screen exist for events. Bookings need their own tables; events stay for dated group occasions. A booking type may optionally link to an event series later. |
| One-off availability (specific dates) | Missing | Form field offers weekdays only. Need date overrides (extra open day, closed day). |
| Recurring availability (weekly) | Partial | Form field: slot list plus weekdays (`forms/types.ts`). Event recurrence exists for events only. Need weekly rules with start and end windows per resource, with time zone. |
| Capacity (single or multiple per slot) | Partial | Form slots capacity 1..50 (`forms/slots.ts`); event capacity in guests (`checkEventCapacity.ts`). Need capacity per type and per resource, and party size per booking. |
| Digital (video link) | Missing | Events have `isOnline` only. Need a per-type link template or a manual link per booking. Auto-created Meet links belong to Phase 4. |
| In person (location) | Partial | Event venue and address fields exist. Need locations per type or resource (and pickup and return for rentals). |
| Free or paid | Partial | Shop orders and payments exist; form pricing stops before checkout. Need booking to order link (see Payments). |
| Several booking types (own length, price, rules) | Missing | Need `booking_types`. |
| Assignment: pick the person | Missing | Need resources plus a chooser on the widget. |
| Assignment: pick the type | Missing | Widget step 1. |
| Assignment: "anyone available" and round robin | Missing | Need strategies in the slot engine (see rules). |
| Buffers (before, after) | Missing | |
| Minimum notice, maximum advance | Partial | Form field has `daysAhead` and `maxDaysAhead` only. Need hours of notice and per-type values. |
| Cancellation rules (cutoff, refund) | Missing | Orders have refunds (`server/refunds.ts`); no policy linkage. |
| Reschedule | Missing | |
| Calendar sync (Google) | Missing | Google OAuth exists, read-only scopes (`google/constants.ts`). Listed under Later integrations in `docs/remaining-work.md`. |
| ICS file or feed | Partial | Per-event ICS exists (`editScreens/ics.ts`). Need per-booking attachment and per-resource feed. |
| Email reminders | Partial | Event reminder sweep exists (`email/eventReminders.ts`). Need booking sweep, several offsets, cancellation and reschedule mail. |
| Double-booking protection | Partial | Check, insert, re-check (`forms/slotGuard.ts`). Reusable idea; need holds with expiry so a customer in checkout keeps the slot. |
| Questionnaire answer and business type | Missing | Task 5 has no bookings question yet apart from the mention in `docs/remaining-work.md` Task 5. |

## Industry fit

The generic model has three unit modes (time slot, day range, night range), resources, and per-type rules. Each industry below is a setting of that model, not custom code.

### Car rental
- Must support: multi-day ranges (day range mode); resources are vehicles, grouped into categories (the booked item is a category, the vehicle is assigned at pickup or automatically); pickup and return location and time; price per day with optional weekend or season rates; deposit (a part payment now, a hold or balance later); driver details as custom questions; availability blocked by service days.
- Out of scope: damage inspection, insurance products, fuel and mileage, telematics, one-way fees between locations, driver licence checks.

### Hotels and B&Bs
- Must support: night range mode; resources are room types with a count (inventory per night), or single rooms; check-in and check-out times; rate per night with season and weekday rules; minimum stay; guest count per room; deposit or full prepayment; arrivals list in the admin.
- Out of scope: channel managers and OTA sync (Booking.com, Airbnb), housekeeping, room-level upgrades, tax by city, group blocks, restaurant and spa add-ons. ICS import and export (Phase 4) is the only external link.

### Hairdressers and salons
- Must support: time slot mode; staff as resources, each with own weekly hours and days off; services as booking types with duration and price (a type can list which staff offer it); "anyone available" with round robin; buffers (clean-up time); add-ons that extend duration and price (colour toner); deposits to cut no-shows; cancellation cutoff (for example 24 hours).
- Out of scope: product sales at the till, commission reports, loyalty points (store credit exists but is not tied in), waitlists (a later item), multi-service combos in one visit (Phase 2 may allow a simple chain; full combos later).

### General practitioners and clinics
- Must support: time slot mode; practitioners as resources with their own calendars; appointment types (standard, long, telehealth) with length; a new-patient flag as a question; usually free or billed outside the site (paid is optional); strict privacy: emails and logs contain date, time and clinic only, never the reason for visit or any health detail; cancel and reschedule by a private link; no-show marking by staff; in-person or video (link per booking).
- Out of scope: clinical records, medical history, Medicare or insurance claims, prescriptions, referrals, health-data compliance certification (HIPAA, GDPR special-category handling beyond what the privacy settings already offer). Matt should treat any health use as a legal check before launch.

## Proposed data model

All tables are created by idempotent migrations appended to `src/migrations/index.ts`, owned by one new feature key `bookings` in `src/features/registry.ts` and `src/features/featureTables.ts`, so a fresh install creates nothing until the feature is switched on (the lazy path in `src/features/provisionOnEnable.ts`). New collections and globals also go into `src/cms/db/schema`. Table names use the `eg_` prefix. Money tables are not added: payment stays in the shop's orders and transactions (kept for accounting per `PAYMENT_RECORD_BASES`). Booking rows themselves should be added to the keep-for-accounting list when they link to an order.

Unit modes, set per booking type: `slot` (minutes), `day_range` (whole days, end date exclusive of return day or inclusive, to be fixed in design), `night_range` (check-in date to check-out date).

| Table | Key columns | Purpose |
|---|---|---|
| `eg_booking_types` | id, title, slug, unit_mode, duration_minutes, min_units, max_units, price, currency, deposit_type (none, fixed, percent), deposit_value, capacity_per_slot, party_size_max, buffer_before, buffer_after, min_notice_minutes, max_advance_days, slot_step_minutes, approval (auto, manual), mode (in_person, video, phone), location_text, video_link_template, cancel_cutoff_hours, refund_policy (full, partial_percent, none), assignment (pick, round_robin_rotation, round_robin_least_booked, any), product_id (shop product, nullable), questions (JSON), active | One row per service, appointment kind, vehicle category or room type |
| `eg_booking_resources` | id, title, kind (staff, room, vehicle, other), user_id (nullable), quantity (units of this resource, for room types), time_zone, location_text, color, active, ics_token | Who or what is booked |
| `eg_booking_type_resources` | type_id, resource_id, price_override, duration_override, sort | Which resources offer which type |
| `eg_availability_rules` | id, resource_id (or global), weekday (0..6), start_time, end_time, valid_from, valid_to | Weekly recurring hours, in the resource time zone |
| `eg_availability_overrides` | id, resource_id, date, kind (open, closed), start_time, end_time, note | One-off open or closed days (holiday, extra Saturday) |
| `eg_rate_rules` (Phase 3) | id, type_id, resource_id nullable, date_from, date_to, weekdays, price_per_unit, min_stay | Seasonal or weekday pricing, night or day rates |
| `eg_bookings` | id, number, type_id, resource_id, status, start_at (UTC), end_at (UTC), local_date, time_zone, units, party_size, customer_name, customer_email, customer_phone, user_id (nullable), answers (JSON), price_total, currency, deposit_paid, order_id (nullable), video_link, location_text, manage_token_hash, source, notes, cancelled_at, cancel_reason, created_at | The booking record. Date columns are UTC instants plus the zone used. |
| `eg_booking_holds` | id, type_id, resource_id, start_at, end_at, units, session_key, expires_at | Short reservation while a customer pays; swept by cron |
| `eg_booking_reminders` | id, booking_id, kind (confirm, reminder, cancel, reschedule), due_at, sent_at, status | Idempotent reminder queue; one row per message |
| `eg_booking_settings` (global) | enabled defaults: hold minutes (default 15), reminder offsets, sender text, privacy mode (hide detail in email), default time zone | Site-wide switches |

Status lifecycle: `pending` (awaiting payment or approval) to `confirmed` to `completed`; side exits `cancelled` (by customer or staff), `no_show`, `expired` (hold lapsed), `rescheduled` (old row kept, linked to the new one). Indexes: `(resource_id, start_at, end_at)`, `(status, start_at)`, `(customer_email)`, unique `number`.

Do not store bookings as form entries or RSVPs. The portal screen reads both sources and merges them.

## Slot engine rules

The engine is a pure module (like `src/features/forms/slots.ts`): inputs in, slots out, no I/O, so the browser widget, the API and the submit path give one answer. Tests belong beside it, with a matrix of DST dates.

1. Start from the resource's weekly rules, apply overrides for that date (closed removes, open adds), all in the resource time zone, then convert each window to UTC with `zonedToUtc` (`src/features/editScreens/timeZone.ts`).
2. Cut the window into starts every `slot_step_minutes`; a start is valid only if `start + duration` fits in the window.
3. Remove starts that clash with existing `confirmed` and `pending` bookings and live holds, extended by `buffer_before` and `buffer_after` on both sides.
4. Remove starts earlier than now + `min_notice_minutes` and later than now + `max_advance_days`.
5. Capacity: a start stays offered while booked units (party size or units) are below `capacity_per_slot` (slots) or `quantity` (rooms and vehicle categories, counted per night or per day).
6. Day and night ranges: a range is valid only if every unit in it has availability and any minimum or maximum length and minimum stay is met; check-out day is not counted as a night.
7. Assignment when the customer does not pick: `rotation` (the resource with the oldest last booking), `least_booked` (fewest bookings in the next 30 days, ties by rotation), `any` (first free by sort order), `pick` (customer chooses; widget lists only free resources for that time). "Anyone available" shows the union of free starts; the resource is chosen at confirm time, after the hold.
8. Concurrency: D1 has no row locks across statements (same limit noted in `src/features/forms/slotGuard.ts`). Use an insert-then-verify scheme: insert a hold (or pending booking) first, then recount overlapping rows in the same request and keep it only if this row is within capacity by id order; otherwise delete it and tell the customer the time was just taken. Use a D1 `batch` for the insert and the final confirm so they apply together. Holds expire (default 15 minutes) and the cron job removes them. Two racers can both lose; that is the safe side.
9. Time zones and DST: store UTC instants and the zone name; the widget shows times in the visitor's zone with the resource zone named; a window that crosses a DST change keeps its wall-clock hours (an hour is skipped or repeated, handled by `zonedToUtc`). Reminders are computed on UTC instants, quiet hours stay in the site zone.
10. Per-request cost: slots are computed for one resource and one date range on demand, capped (about 60 days), rate limited like `form-slots` (`src/features/accounts/rateLimit.ts` pattern). The five-minute cron is the only background work.

## Payments

- Free: a booking is `confirmed` at once (or `pending` if the type needs manual approval).
- Paid: reuse the shop. Create an order for the booking so payment, tax, receipts, refunds and accounting records stay in one place (`src/features/ecommerce/collections/Orders.ts`, `Transactions.ts`, `server/orders.ts`, adapters in `payments/`). The booking is `pending` with a hold until the order is paid, then `confirmed` by the order hook (`server/orderHooks.ts`). If the hold expires first, the booking becomes `expired`.
- Open point: orders reference products (`Orders.ts` line items; form pricing notes the same problem at `forms/pricing.ts` ~line 120). Two options: (a) each booking type owns a hidden service product and the order carries booking details in line meta; (b) allow an order line with no product. (a) is smaller and keeps stock and reports working, so it is the proposed default (`booking_types.product_id`). Needs a check that stock is not decremented for service products.
- Deposit: charge `deposit_value` now, record the balance as due on arrival or by a second order (Phase 3). Full: charge the total.
- Cancellation refunds follow the type's policy: before the cutoff, full refund (or store credit), after the cutoff, per the type (none, a percentage, or keep the deposit). Refund through `server/refunds.ts` so `order_refunds` and the payment provider stay in step. Staff can override.
- Taxes, currencies and coupons come from the shop settings; multi-currency is Task 9 and quantity and wholesale pricing is Task 10, so booking prices must not hard-code AUD.

## Notifications

- Confirmation (customer and, optionally, staff): sent through `sendEmail` with a new template "Booking confirmation", an ICS attachment from `src/features/editScreens/ics.ts`, and a private manage link (token, stored hashed) to cancel or reschedule without signing in.
- Reminders: rows in `eg_booking_reminders` created at confirm time from the type's offsets (for example 24 hours and 2 hours). The cron sweep follows the pattern in `src/features/email/eventReminders.ts` (stamp then send, so a provider failure is not retried in a loop) and the quiet hours in `scheduledEmails.ts`.
- Cancellation and reschedule mail, with an updated ICS (`METHOD:CANCEL`, `SEQUENCE`); the ICS builder needs those two fields added.
- Staff notice on new booking: ties into Task 18 (notifications on actions); do not build a second mechanism.
- GP privacy mode (site setting, default on for clinic business type): subject and body show clinic name, date, time and a link only; no appointment type name, no answers, no reason. Email log rows store the same reduced text. Webhook payloads omit answers unless the admin opts in.
- SMS reminders: out of scope for now; Twilio exists (`src/features/sms/twilio.ts`) and is a possible later channel.
- Unsubscribe rules: booking mail is transactional and always sent (consistent with `src/app/(engage)/api/email-unsubscribe/route.ts` text "Emails about orders, bookings and sign-in still arrive"); reminders may be opt-out for marketing but not for the booking itself.

## Calendar sync

- Phase 4a, no OAuth: a read-only ICS feed per resource at an unguessable token URL (`ics_token`), plus the per-booking ICS attachment. Customers and staff subscribe in Google, Apple or Outlook. Delay of a few hours is normal for subscribed feeds. Privacy: feeds show "Booked" for GP resources unless the admin opts in.
- Phase 4b, busy-time read: the Google connection (`src/features/google/*`) would add a calendar read scope so staff Google events block slots. Needs re-consent and a Google OAuth app verification step, which is a vendor process Matt has to run.
- Phase 4c, two-way: write bookings to the staff calendar (`calendar.events` scope), update on reschedule and cancel, optional Meet link. Needs a per-resource token store, refresh handling, and a retry queue on the five-minute cron.
- Out of scope: Outlook and Apple two-way sync, CalDAV.

## Admin UI and public UI

Admin (a new "Bookings" group, shown only when the feature is on):
- Booking types: editor for the fields in the table above, with a plain "preview next 14 days of slots" panel.
- Resources: list, hours editor (weekly grid plus date overrides, holidays), which types each offers, ICS link.
- Calendar view: day, week and month per resource (the Events calendar at `src/views/events/EventsCalendarView.tsx` is a starting point), click a gap to add a booking by hand, drag to reschedule (drag could be Phase 2).
- Bookings list: filters by status, date, resource, type, with CSV export, mark completed or no-show, cancel with or without refund, resend email. Reuse the ListView patterns in `src/admin/views/ListView.tsx` and the results tabs in `src/admin/views/results/`.
- Check-in style "today" list (the events check-in at `src/admin/views/results/EventCheckIn.tsx` is the model).
- Settings page: hold minutes, reminder offsets, privacy mode, default time zone.
- Roles: new permission keys in `src/features/roles/permissions.ts` (manage types, manage all bookings, manage own bookings for a staff user linked to a resource).

Public:
- Booking widget as a visual-editor element (registered like the elements in `src/components/blocks/elements/`): steps type, resource or "anyone", date and time (or range), details, pay, confirm. Also an embeddable page `/book/[slug]`, in the same spirit as the form embeds (`src/features/forms/embedScript.ts`).
- Manage page by private link: view, cancel, reschedule within rules.
- Account portal "My bookings": `src/features/accounts/bookings.ts` gains the new source; copy changes from "event bookings" to "bookings" in all dictionaries (en and the translated files under `src/features/uiStrings/dictionaries/`).
- Translations: all new strings go through `uiStrings`; mobile at 375 px is a gate (as with the portal).

## Questionnaire hook (Task 5)

Add two questions to the fresh-install questionnaire (`docs/remaining-work.md` Task 5), and show the suggestions before applying:

1. "Do you take bookings?" with answers: No; Appointments (by the hour); Rentals by the day; Nightly stays.
2. "What kind of business?" with answers: Hairdresser or salon; Clinic or GP; Car rental; Hotel or B&B; Other.

| Answer | Pre-ticks and presets |
|---|---|
| No bookings | Bookings off. Events stay governed by the events question. |
| Appointments | Bookings on, Email on, Accounts on; Shop on only if the owner chose paid services; unit mode `slot`. |
| Rentals by the day | Bookings on, Shop on, Accounts on; unit mode `day_range`; asks for pickup and return locations. |
| Nightly stays | Bookings on, Shop on, Accounts on; unit mode `night_range`; check-in and check-out times. |
| Hairdresser or salon | Staff as resources, round robin "any", buffer 10 minutes, deposit suggested, cancel cutoff 24 hours. |
| Clinic or GP | Practitioners as resources, privacy mode on, free by default, video or in person, cancel cutoff 24 hours, no-show tracking. |
| Car rental | Vehicle categories as resources with quantity, deposit suggested, pickup and return locations. |
| Hotel or B&B | Room types with quantity, minimum stay field, deposit suggested. |
| Other | Only the bookings answer applies; nothing else preset. |

Skipping keeps today's defaults (bookings off). The answers only tick boxes in Settings > General > Features and set starter values; the starter booking type and resource are created by the same starter step that runs when a feature is switched on (`src/features/starters.ts`). Everything stays editable later.

## Phased plan

Each phase ships behind the `bookings` feature switch, with migrations first, the two fresh-install specs extended (`tests/int/internal-migrate-fresh-install.int.spec.ts` and `tests/int/fresh-install-schema-coverage.int.spec.ts`, each run twice), `tsc`, the build, an independent review, and a live check entry in Task 26, per the process in `docs/remaining-work.md`.

### Phase 1: appointment MVP (effort L)
Deliverables:
- Feature `bookings`; tables `booking_types`, `booking_resources`, `availability_rules`, `availability_overrides`, `bookings`, `booking_holds`, `booking_reminders`, `booking_settings`; lazy provisioning.
- One or a few resources, no assignment logic beyond "pick" and "only one"; weekly hours and date overrides; time slot mode; duration, price, notice, max advance, capacity 1.
- Free and paid through a shop order (hidden service product), hold with expiry, confirm on payment.
- Confirmation email with ICS and manage link; one reminder email; cancel by link (refund by policy: full or none).
- Public widget element and `/book/[slug]`; admin booking types, resource hours, bookings list; portal "My bookings" shows bookings and RSVPs.
- Cron jobs `booking-holds` and `booking-reminders` in `src/features/cron/registry.ts`; webhook events for made, cancelled.
- Questionnaire answers wired (if Task 5 is built by then; otherwise the hook is documented only).

Acceptance checks:
- Fresh DB: no booking tables until the feature is switched on; after switch-on, a second migrate run changes nothing.
- Two simultaneous requests for the last slot: exactly one wins, the other sees "just taken" (test with the insert-then-verify scheme).
- A slot across a DST change in `Australia/Sydney` and one in `Europe/London` shows correct local times and the correct UTC instants.
- Paid booking: order paid gives `confirmed`; unpaid for the hold period gives `expired` and the slot reopens.
- Reminder sent once, even if the cron runs twice; held during quiet hours.
- 375 px width, 16 px gutter, no sideways scroll on the widget and manage page.

Risks: orders without a natural product (decision needed); D1 concurrency (mitigated, not eliminated); migration offsets in specs move with each new migration; engine file size limits noted in the Lessons (`src/engage-types.ts` not to be edited; cast locally).

### Phase 2: staff, rules, capacity and reschedule (effort L)
Deliverables:
- Multiple resources per type; round robin (rotation, least booked), "anyone available", "pick the person".
- Buffers before and after, per-type notice and cancellation rules with refund percentages, capacity above 1 and party size, reschedule (customer by link, staff by drag), no-show status.
- Cancellation and reschedule emails with updated ICS (`METHOD:CANCEL`, `SEQUENCE`); several reminder offsets.
- Admin calendar view per resource and combined; staff user linked to a resource sees own bookings only.
- Add-ons that extend duration and price (hairdresser).

Acceptance checks: round robin spreads 20 bookings across three staff within one booking of even; buffers block adjacent starts; capacity 4 accepts four single guests or one party of four; refund amounts match policy at the cutoff minute (before and after); reschedule keeps the order and does not double charge.

Risks: engine complexity grows (property-style tests recommended); staff permission keys touch `src/features/roles/permissions.ts`; reschedule of a paid booking with a price change (decision needed).

### Phase 3: day and night ranges, rates, deposits (effort L)
Deliverables:
- `day_range` and `night_range` modes; inventory per night or day (`quantity`); minimum and maximum length, minimum stay, check-in and check-out times.
- `rate_rules` (seasons, weekdays, weekend); deposit or balance due later (second order or pay on arrival marked by staff).
- Pickup and return locations (rentals); arrivals and departures list; availability calendar grid for rooms and vehicles.
- Block-out dates (maintenance) as overrides.

Acceptance checks: a 3-night stay over a rate boundary prices each night correctly; check-out day is free for the next guest; a minimum stay of 2 refuses a 1-night gap; quantity 3 accepts a fourth overlapping request only after one cancels; deposit plus balance sum to the quote.

Risks: pricing edge cases (tax, currency rounding, Task 9 and Task 10 interplay); hotels expect channel managers (out of scope, set expectations); vehicle category versus specific vehicle assignment.

### Phase 4: calendar sync and feeds (effort M for 4a, L for 4b and 4c)
Deliverables:
- 4a: per-resource ICS feed with token, regenerate token action, privacy option; per-booking "Add to calendar" links.
- 4b: Google Calendar busy-time read (blocks slots), with the new scope on the Google connection.
- 4c: Google Calendar write (create, update, delete events), optional Meet link, retry queue.

Acceptance checks: a feed subscribed in Google shows a new booking within the provider's refresh time and hides it after cancel; a staff event in Google blocks the slot within one cron tick; a reschedule updates the Google event, not a duplicate.

Risks: Google OAuth verification and re-consent for sensitive scopes (vendor process, Matt's own console, can take weeks); refresh token expiry for apps in testing mode; tokens need encrypted storage (`ENGAGE_SECRET`); the new scope forces existing connected sites to reconnect.

## Decisions for Matt

1. Which phase first? Proposed: Phase 1, then Phase 2 before Phase 3 unless a rental or hotel client is waiting.
2. Staff and resources: separate resource rows with an optional link to a user (proposed), or staff must be users?
3. Orders for bookings: hidden service product per booking type (proposed), or allow order lines without a product?
4. Default refund policy: full refund before a 24-hour cutoff and none after (proposed), or partial? Refund to the card or to store credit by default?
5. Time zone: one zone per site (as today, `Australia/Sydney` default), or per resource (proposed, needed for multi-region and franchise sites)?
6. Manual approval: should any type need staff approval before it is confirmed (proposed: optional per type, default auto)?
7. Hold length while paying: 15 minutes (proposed)?
8. Customers without an account: allow guest bookings with a private manage link (proposed), or require sign-in?
9. GP use: do you want to target clinics at all? If yes, privacy mode defaults on, and a legal and privacy review is needed before launch.
10. Reminder channels: email only for now (proposed), or add SMS through Twilio in Phase 2?
11. Rentals and hotels: accept the stated out-of-scope list (no channel manager, no damage or insurance handling)?
12. Google Calendar: ICS feeds only first (proposed), and if two-way is wanted, are you willing to run the Google OAuth verification?
13. Events: keep Events and RSVPs as they are and add Bookings beside them (proposed), or later fold RSVPs into bookings? Task 11 (selling events) overlaps and should be decided at the same time.
14. Task 18 (notifications on actions) and Task 17 (cron screen): build the booking notices on those if they land first, or ship Phase 1 with its own simple templates?
