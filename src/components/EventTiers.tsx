import React from 'react'

import type { TierView } from '@/features/editScreens/tierSales'

/** The words EventTiers shows, passed in already translated by the page. */
export type EventTiersText = {
  heading: string
  soldOut: string
  placesAvailable: string
  /** Already filled in for one tier, e.g. "4 left". */
  left: (count: number) => string
  pricesInfoPaid: string
  pricesInfoFree: string
}

/**
 * Ticket types on the event page: name, price and what is left. On a paid event the
 * numbers are for information only; the Buy ticket button sells the one ticket product.
 */
export const EventTiers: React.FC<{ tiers: TierView[]; paid: boolean; text: EventTiersText }> = ({ tiers, paid, text }) => {
  if (tiers.length === 0) return null
  return (
    <div className="mb-6">
      <h3 className="mb-2">{text.heading}</h3>
      <ul className="list-none stack">
        {tiers.map((tier) => (
          <li key={tier.name} className="stack">
            <span className="cluster justify-between">
              <strong>{tier.name}</strong>
              <span>{tier.priceLabel}</span>
            </span>
            {tier.description && <span className="text-sm">{tier.description}</span>}
            {!paid && (
              <span className="text-xs text-muted">
                {tier.soldOut ? text.soldOut : tier.remaining === null ? text.placesAvailable : text.left(tier.remaining)}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{paid ? text.pricesInfoPaid : text.pricesInfoFree}</p>
    </div>
  )
}
