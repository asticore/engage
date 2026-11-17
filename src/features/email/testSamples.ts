import { adminHref } from '@/features/security/adminPath'
import type { TemplateValues } from './renderTemplate'

/**
 * Made-up but realistic values for test sends, so a test shows how each email
 * reads with real-length names, dates and links. The keys match the tags used
 * in templateDefaults.ts. A template with no entry here falls back to the generic
 * sample, so a new template still gets a usable test.
 */

const SITE = 'https://example.com'

export const TEST_SAMPLE_VALUES: Record<string, TemplateValues> = {
  accountReset: { minutes: 60, link: `${SITE}/reset-password?token=sample` },
  accountAlreadyRegistered: { signInLink: `${SITE}/sign-in`, resetLink: `${SITE}/reset-password` },
  accountWelcome: { link: `${SITE}/account` },
  accountVerify: { hours: 24, link: `${SITE}/account/verify-email?token=sample` },
  accountMagicLink: { minutes: 15, link: `${SITE}/account/sign-in/link?token=sample` },
  accountLoginCode: { minutes: 15, code: '482913' },
  organizationInvite: { organization: 'Example Co', inviter: 'sam@example.com', role: 'member', days: 7, link: `${SITE}/account/invite/sample` },
  accountTwoFactorCode: { minutes: 10, code: '730216' },
  membershipRenewal: { tier: 'Gold', days: 7, renewsAt: '1 November 2026' },
  approvalSubmitted: {
    requesterName: 'Sam Example',
    noun: 'page',
    title: 'Spring menu',
    waiting: ' (2 others are waiting)',
    link: `${SITE}${adminHref('/approvals')}`,
  },
  approvalDecision: {
    reviewerName: 'Alex Reviewer',
    verb: 'approved',
    noun: 'page',
    title: 'Spring menu',
    note: ' Looks good.',
    link: `${SITE}${adminHref('/approvals')}`,
  },
  rsvpConfirmation: {
    name: 'Sam',
    eventTitle: 'Summer open evening',
    eventDate: 'Saturday 12 September 2026, 18:30',
    guestCount: 2,
    ticketType: 'General admission',
    ticketLine: '\nTicket: General admission',
  },
  eventReminder: {
    name: 'Sam',
    eventTitle: 'Summer open evening',
    when: 'tomorrow at 18:30',
    eventDate: 'Saturday 12 September 2026, 18:30',
    link: `${SITE}/events/summer-open-evening`,
  },
  quoteReceived: { name: 'Sam', number: 'QR-A1B2C3', kindLabel: 'quote request', siteName: 'Example Co' },
  quoteAdminNew: { name: 'Sam', email: 'sam@example.com', number: 'QR-A1B2C3', kindLabel: 'quote request', details: '20 branded mugs, delivered by 1 December.' },
  quoteSent: { name: 'Sam', number: 'QR-A1B2C3', message: 'Thanks for asking. Here is your quote.', total: '$360.00', validUntil: '1 December 2026', link: `${SITE}/quote/sample`, siteName: 'Example Co' },
  quoteExpiring: { name: 'Sam', number: 'QR-A1B2C3', total: '$360.00', validUntil: '1 December 2026', siteName: 'Example Co' },
  quoteBidLost: { name: 'Sam', number: 'QR-A1B2C3', siteName: 'Example Co' },
  quoteCounter: { name: 'Sam', email: 'sam@example.com', number: 'QR-A1B2C3', note: 'Could you do it for less?\n\nWould pay: $320.00' },
  quoteAccepted: { name: 'Sam', number: 'QR-A1B2C3', total: '$360.00', orderNumber: '1042' },
  quoteDeclined: { name: 'Sam', number: 'QR-A1B2C3' },
}

/** A generic sample for any template that has no specific one. */
const GENERIC_SAMPLE: TemplateValues = { name: 'Sam', title: 'Sample item', link: `${SITE}/account` }

export const sampleValuesFor = (key: string): TemplateValues => TEST_SAMPLE_VALUES[key] ?? GENERIC_SAMPLE

/** Plain-English names for the template picker. */
export const TEMPLATE_LABELS: Record<string, string> = {
  accountReset: 'Password reset',
  accountAlreadyRegistered: 'Account already exists',
  accountWelcome: 'Welcome to a new account',
  accountVerify: 'Confirm your email address',
  accountMagicLink: 'Sign-in link',
  accountLoginCode: 'Sign-in code',
  organizationInvite: 'Organisation invitation',
  accountTwoFactorCode: 'Two-step code',
  membershipRenewal: 'Membership renewal reminder',
  approvalSubmitted: 'Approval requested',
  approvalDecision: 'Approval decision',
  rsvpConfirmation: 'Booking confirmed',
  eventReminder: 'Event reminder',
  quoteReceived: 'Quote request received (to customer)',
  quoteAdminNew: 'New request (to you)',
  quoteSent: 'Quote sent (to customer)',
  quoteExpiring: 'Quote expiring soon (to customer)',
  quoteBidLost: 'Offer not successful (to customer)',
  quoteCounter: 'Counter-offer (to you)',
  quoteAccepted: 'Quote accepted (to you)',
  quoteDeclined: 'Quote declined (to you)',
}

/** The subject of a test send, so it is never mistaken for a real email. */
export const testSubject = (subject: string): string => `[Test] ${subject}`
