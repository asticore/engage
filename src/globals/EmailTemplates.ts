import type { GlobalConfig } from '@/engine'

import { isAdmin } from '../access/ecommerceAccess'

/**
 * The wording of the site's automatic emails. Each email has a subject and a body.
 * A blank field keeps the built-in text, so nothing changes until someone edits it.
 *
 * Body text is plain: a blank line starts a new paragraph. Tags such as {{link}} are
 * filled in when the email is sent. A tag the email does not supply is removed.
 */

const template = (name: string, label: string, description: string, tags: string) => ({
  type: 'group' as const,
  name,
  label,
  admin: { description },
  fields: [
    {
      name: 'subject',
      type: 'text' as const,
      label: 'Subject line',
      admin: { description: `Tags you can use: ${tags}` },
    },
    {
      name: 'body',
      type: 'textarea' as const,
      label: 'Message',
      admin: { description: `Tags you can use: ${tags}` },
    },
  ],
})

const DESIGN_KEYS = [
  'accountReset',
  'accountAlreadyRegistered',
  'accountWelcome',
  'membershipRenewal',
  'approvalSubmitted',
  'approvalDecision',
  'rsvpConfirmation',
  'eventReminder',
  'quoteReceived',
  'quoteAdminNew',
  'quoteSent',
  'quoteExpiring',
  'quoteBidLost',
  'quoteCounter',
  'quoteAccepted',
  'quoteDeclined',
] as const

const DESIGN_FIELDS = DESIGN_KEYS.map((key) => ({
  name: `${key}Design`,
  type: 'json' as const,
  admin: { hidden: true },
}))

export const EmailTemplates: GlobalConfig = {
  slug: 'email-templates',
  label: 'Email templates',
  dbName: 'eg_email_templates',
  admin: {
    group: 'Settings',
    description: 'The wording of the automatic emails. Leave a field blank to keep the built-in text.',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    template(
      'accountReset',
      'Password reset',
      'Sent when someone asks to reset their password.',
      '{{link}} the reset link, {{minutes}} how long the link lasts',
    ),
    template(
      'accountAlreadyRegistered',
      'Already registered',
      'Sent when someone tries to register with an email address that already has an account.',
      '{{signInLink}} the sign-in page, {{resetLink}} the password reset page',
    ),
    template('accountWelcome', 'Account welcome', 'Sent when a new account is created.', '{{link}} the account page'),
    template(
      'membershipRenewal',
      'Membership renewal reminder',
      'Sent before a membership renews. How many days ahead is set in Member settings.',
      '{{tier}} the membership name, {{renewsAt}} the renewal date, {{days}} days until renewal',
    ),
    template(
      'approvalSubmitted',
      'Review requested',
      'Sent to reviewers when something is sent for approval.',
      '{{requesterName}} who sent it, {{noun}} the kind of item (page, post, event), {{title}} its title, {{waiting}} who it is waiting on (blank when there is no workflow), {{link}} the link to open it',
    ),
    template(
      'approvalDecision',
      'Review decision',
      'Sent to the person who sent something for approval, when it is approved or sent back.',
      '{{reviewerName}} who reviewed it, {{verb}} what was done, {{noun}} the kind of item, {{title}} its title, {{note}} the reviewer note with its heading (blank when there is none), {{link}} the link to open it',
    ),
    template(
      'rsvpConfirmation',
      'Event booking confirmation',
      'Sent to a guest after they book a place at an event, when they gave an email address.',
      '{{name}} the guest name, {{eventTitle}} the event title, {{eventDate}} the start date and time, {{guestCount}} the number of guests, {{ticketLine}} the ticket type line (empty when the event has no ticket types), {{ticketType}} the ticket type name',
    ),
    template(
      'eventReminder',
      'Event reminder',
      'Sent to a guest before their event. How long before is set under When emails are sent.',
      '{{name}} the guest name, {{eventTitle}} the event title, {{when}} the start date and time, {{guestCount}} the number of guests',
    ),
    // Quotes and requests emails (shown when that section is switched on).
    template(
      'quoteReceived',
      'Quote request received (to customer)',
      'Sent to the customer when they send a quote request, offer or item request.',
      '{{name}} the customer name, {{number}} the request number, {{kindLabel}} quote request, offer or item request, {{siteName}} your site name',
    ),
    template(
      'quoteAdminNew',
      'New request (to you)',
      'Sent to the shop admin email when a request comes in.',
      '{{name}}, {{email}}, {{number}}, {{kindLabel}}, {{details}} what they asked for',
    ),
    template(
      'quoteSent',
      'Quote sent (to customer)',
      'Sent with the quote and its private link. The message you type when sending a quote fills {{message}}.',
      '{{name}}, {{number}}, {{message}} the message typed with the quote, {{total}} the quote total, {{validUntil}} the last day it can be accepted, {{link}} the private quote link, {{siteName}}',
    ),
    template(
      'quoteExpiring',
      'Quote expiring soon (to customer)',
      'Sent once, a few days before an open quote runs out.',
      '{{name}}, {{number}}, {{total}}, {{validUntil}}, {{siteName}}',
    ),
    template(
      'quoteBidLost',
      'Offer not successful (to customer)',
      'Sent to people whose offer was not the highest when offers closed.',
      '{{name}}, {{number}}, {{siteName}}',
    ),
    template(
      'quoteCounter',
      'Counter-offer (to you)',
      'Sent to the shop admin email when a customer replies to a quote with a counter-offer.',
      '{{name}}, {{email}}, {{number}}, {{note}} their message and the price they would pay',
    ),
    template(
      'quoteAccepted',
      'Quote accepted (to you)',
      'Sent to the shop admin email when a customer accepts a quote.',
      '{{name}}, {{number}}, {{total}}, {{orderNumber}} the new order number',
    ),
    template(
      'quoteDeclined',
      'Quote declined (to you)',
      'Sent to the shop admin email when a customer declines a quote.',
      '{{name}}, {{number}}',
    ),
    // Designed layout for each email (Email design page). Stored as a list of blocks; hidden here, edited on the designer.
    ...DESIGN_FIELDS,
  ],
}
