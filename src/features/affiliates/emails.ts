/**
 * The emails an affiliate receives (Task 31c). Plain text, English only for now, built from values only so they can be
 * tested without a mail provider. Sending lives in service.ts.
 */
export type AffiliateEmail = { subject: string; text: string }

const money = (cents: number): string => `$${(Math.max(0, cents) / 100).toFixed(2)}`

export function approvedEmail(v: { name: string; link: string; dashboard: string; commissionPct: number; cookieDays: number }): AffiliateEmail {
  return {
    subject: 'You are approved as an affiliate',
    text: [
      `Hi ${v.name},`,
      '',
      `You are approved. You earn ${v.commissionPct}% commission on orders from people who follow your link and buy within ${v.cookieDays} days.`,
      '',
      `Your link: ${v.link}`,
      `Your private results page: ${v.dashboard}`,
      '',
      'Keep the results link private: anyone who has it can see your results. Please say clearly that your link is an affiliate link when you share it.',
    ].join('\n'),
  }
}

export function commissionEmail(v: { name: string; orderId: number; amountCents: number; payableOn: string; dashboard: string }): AffiliateEmail {
  return {
    subject: `You earned a commission of ${money(v.amountCents)}`,
    text: [
      `Hi ${v.name},`,
      '',
      `Someone bought through your link (order #${v.orderId}). You earned ${money(v.amountCents)}.`,
      `It becomes payable on ${v.payableOn.slice(0, 10)}, and is reduced if the order is refunded.`,
      '',
      `See your results: ${v.dashboard}`,
    ].join('\n'),
  }
}

export function payoutEmail(v: { name: string; amountCents: number; note: string; dashboard: string }): AffiliateEmail {
  return {
    subject: `Your payout of ${money(v.amountCents)} was recorded`,
    text: [
      `Hi ${v.name},`,
      '',
      `A payout of ${money(v.amountCents)} was recorded for you.${v.note ? ` Reference: ${v.note}.` : ''}`,
      'It is sent outside the site, so it may take a little while to reach you.',
      '',
      `See your results: ${v.dashboard}`,
    ].join('\n'),
  }
}
