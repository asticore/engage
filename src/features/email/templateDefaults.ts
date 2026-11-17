/**
 * The built-in wording for each automatic email. A template that is left blank
 * in the `email-templates` global falls back to these, and these are exactly
 * the messages the senders used before the wording became editable, so a site
 * that never touches Email templates sends the same emails as before.
 *
 * Tags are written with double braces, e.g. {{link}}. Renderer: renderTemplate.ts.
 */

export type EmailTemplateKey =
  | 'accountReset'
  | 'accountAlreadyRegistered'
  | 'accountWelcome'
  | 'accountVerify'
  | 'accountMagicLink'
  | 'accountLoginCode'
  | 'organizationInvite'
  | 'accountTwoFactorCode'
  | 'membershipRenewal'
  | 'approvalSubmitted'
  | 'approvalDecision'
  | 'rsvpConfirmation'
  | 'eventReminder'
  | 'quoteReceived'
  | 'quoteAdminNew'
  | 'quoteSent'
  | 'quoteExpiring'
  | 'quoteBidLost'
  | 'quoteCounter'
  | 'quoteAccepted'
  | 'quoteDeclined'

export type EmailTemplate = { subject: string; body: string }

export const EMAIL_TEMPLATE_DEFAULTS: Record<EmailTemplateKey, EmailTemplate> = {
  accountReset: {
    subject: 'Reset your password',
    body: [
      'Someone asked to reset the password on your account.',
      'Open this link to choose a new one - it works once, and expires in {{minutes}} minutes:\n{{link}}',
      'If this was not you, ignore this email. Your password has not changed.',
    ].join('\n\n'),
  },
  accountAlreadyRegistered: {
    subject: 'You already have an account',
    body: [
      'Someone tried to create an account with this email address, but you already have one.',
      'Sign in here:\n{{signInLink}}',
      'Forgotten your password? Reset it here:\n{{resetLink}}',
      'If this was not you, nothing has changed and you can ignore this email.',
    ].join('\n\n'),
  },
  accountWelcome: {
    subject: 'Your account is ready',
    body: ['Your account is ready.', 'You can see your orders, addresses and bookings here:\n{{link}}'].join('\n\n'),
  },
  accountVerify: {
    subject: 'Confirm your email address',
    body: [
      'Please confirm this email address for your account.',
      'Open this link - it works once, and expires in {{hours}} hours:\n{{link}}',
      'If this was not you, ignore this email.',
    ].join('\n\n'),
  },
  accountMagicLink: {
    subject: 'Your sign-in link',
    body: [
      'Open this link to sign in to your account. It works once, and expires in {{minutes}} minutes:\n{{link}}',
      'If you did not ask for this, ignore this email. Nobody can sign in without the link.',
    ].join('\n\n'),
  },
  accountLoginCode: {
    subject: 'Your sign-in code',
    body: [
      'Your sign-in code is {{code}}. It works once, expires in {{minutes}} minutes, and stops working after five wrong tries.',
      'If you did not ask for this, ignore this email. Nobody can sign in without the code.',
    ].join('\n\n'),
  },
  organizationInvite: {
    subject: 'You are invited to join {{organization}}',
    body: [
      '{{inviter}} invited you to join {{organization}} as {{role}}.',
      'Open this link to accept or decline. It expires in {{days}} days, and only works when you are signed in with this email address:\n{{link}}',
      'If you were not expecting this, ignore this email. Nothing happens unless you accept.',
    ].join('\n\n'),
  },
  accountTwoFactorCode: {
    subject: 'Your two-step code',
    body: [
      'Your two-step sign-in code is {{code}}. It works once, expires in {{minutes}} minutes, and stops working after five wrong tries.',
      'If you did not just try to sign in or set up two-step, change your password: someone may know it.',
    ].join('\n\n'),
  },
  membershipRenewal: {
    subject: 'Your {{tier}} membership renews in {{days}} day(s)',
    body: 'Your {{tier}} membership is due to renew on {{renewsAt}} - that is {{days}} day(s) away.',
  },
  approvalSubmitted: {
    subject: 'Review requested: {{title}}',
    body: [
      '{{requesterName}} sent this {{noun}} for review: {{title}}{{waiting}}',
      'Open it to approve or ask for changes:\n{{link}}',
    ].join('\n\n'),
  },
  approvalDecision: {
    subject: '{{title}} was {{verb}}',
    body: ['{{reviewerName}} {{verb}} this {{noun}}: {{title}}.{{note}}', 'Open it here:\n{{link}}'].join('\n\n'),
  },
  rsvpConfirmation: {
    subject: "You're booked: {{eventTitle}}",
    body: [
      'Hi {{name}}, your booking for {{eventTitle}} is confirmed.',
      'When: {{eventDate}}\nGuests: {{guestCount}}{{ticketLine}}',
      'See you there.',
    ].join('\n\n'),
  },
  eventReminder: {
    subject: 'Reminder: {{eventTitle}} is {{when}}',
    body: [
      'Hi {{name}}, a reminder that {{eventTitle}} is on {{when}}.',
      'Guests: {{guestCount}}',
      'See you there.',
    ].join('\n\n'),
  },
  quoteReceived: {
    subject: 'We got your {{kindLabel}} ({{number}})',
    body: 'Hi {{name}},\n\nThanks, we have your {{kindLabel}} ({{number}}). We will get back to you soon.\n\n{{siteName}}',
  },
  quoteAdminNew: {
    subject: 'New {{kindLabel}} {{number}} from {{name}}',
    body: '{{name}} ({{email}}) sent a {{kindLabel}}.\n\n{{details}}\n\nOpen it in Quotes and requests.',
  },
  quoteSent: {
    subject: 'Your quote {{number}} from {{siteName}}',
    body: 'Hi {{name}},\n\n{{message}}\n\nTotal: {{total}}. Valid until {{validUntil}}.\n\nSee the quote, accept it or reply with a counter-offer:\n{{link}}\n\n{{siteName}}',
  },
  quoteExpiring: {
    subject: 'Your quote {{number}} expires on {{validUntil}}',
    body: 'Hi {{name}},\n\nA reminder that your quote {{number}} for {{total}} is open until {{validUntil}}. To accept it or reply with a counter-offer, use the link in our earlier quote email, or reply to this message and we will send a new one.\n\n{{siteName}}',
  },
  quoteBidLost: {
    subject: 'Your offer {{number}} was not successful',
    body: 'Hi {{name}},\n\nThanks for your offer ({{number}}). Offers have closed and another offer was higher, so yours was not successful this time.\n\n{{siteName}}',
  },
  quoteCounter: {
    subject: 'Counter-offer on {{number}} from {{name}}',
    body: '{{name}} ({{email}}) replied to quote {{number}}.\n\n{{note}}',
  },
  quoteAccepted: {
    subject: 'Quote {{number}} accepted by {{name}}',
    body: '{{name}} accepted quote {{number}} for {{total}}. Order {{orderNumber}} is waiting for payment.',
  },
  quoteDeclined: {
    subject: 'Quote {{number}} declined by {{name}}',
    body: '{{name}} declined quote {{number}}.',
  },
}
