import React from 'react'

import { Icon } from '@/components/blocks/elements/icons'
import { BADGE_POSITIONS, type PromoBadge } from '@/features/ecommerce/lib/promoBadges'

/** The promo badges of one product card, grouped by corner. Styles are in src/styles/product-badges.css. */
export const PromoBadges: React.FC<{ badges: PromoBadge[] }> = ({ badges }) => {
  if (badges.length === 0) return null
  return (
    <>
      {BADGE_POSITIONS.map((position) => {
        const here = badges.filter((badge) => badge.position === position)
        if (here.length === 0) return null
        return (
          <div key={position} className={`eg-badges eg-badges--${position}`}>
            {here.map((badge, index) => (
              <span
                key={index}
                className={`eg-badge eg-badge--${badge.style} eg-badge--${badge.shape} eg-badge--fx-${badge.effect}`}
                style={{ '--eg-badge-bg': badge.colour, '--eg-badge-fg': badge.textColour } as React.CSSProperties}
              >
                {badge.icon ? <Icon name={badge.icon} size={14} /> : null}
                {badge.text ? <span>{badge.text}</span> : null}
              </span>
            ))}
          </div>
        )
      })}
    </>
  )
}
