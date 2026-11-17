import React from 'react'

import { accountContext } from '../session'
import { MEMBERSHIPS_SLUG } from '@/features/members/slugs'

type Found = { docs: { graceEndsAt?: string | null }[] }

/** A notice on every account screen for a member whose renewal payment failed: when access ends and where to fix the card. English only for now. */
export const PastDueBanner: React.FC = async () => {
  try {
    const { engine, flags, user } = await accountContext()
    if (!user || !(flags as Record<string, boolean>).members) return null
    const found = (await (engine as unknown as { find: (a: Record<string, unknown>) => Promise<Found> }).find({
      collection: MEMBERSHIPS_SLUG,
      where: { and: [{ user: { equals: user.id } }, { status: { equals: 'past-due' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })).docs[0]
    if (!found) return null
    const until = found.graceEndsAt ? new Date(found.graceEndsAt).toLocaleDateString('en-AU', { dateStyle: 'medium' }) : null
    return (
      <p role="alert" className="account-notice">
        Your last membership payment did not go through. {until ? `You keep your access until ${until}. ` : ''}Please update your card using the link in our payment email, or contact us for help.
      </p>
    )
  } catch {
    return null
  }
}
