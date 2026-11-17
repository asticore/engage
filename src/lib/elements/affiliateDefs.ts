import type { EditorField } from './fieldTypes'
import type { ElementDef } from './registry'

/**
 * Affiliate element. Server rendered (registered in SITE_ELEMENT_TYPES) because it reads the program settings. The
 * renderer is src/components/blocks/elements/AffiliateServer.tsx. It shows nothing while the Affiliates switch is off.
 */

const check = (name: string, label: string): EditorField => ({ name, label, type: 'checkbox' })

export const AFFILIATE_ELEMENTS: ElementDef[] = [
  {
    type: 'affiliate-join', label: 'Affiliate sign-up', icon: String.fromCodePoint(0x1f91d), category: 'commerce',
    description: 'The affiliate program summary (commission and tracking days), its terms and the join form. Shows nothing while Affiliates is switched off.',
    fields: [
      check('showSummary', 'Show the commission summary'),
      check('showTerms', 'Show the program terms'),
      check('showSignIn', 'Show the link for existing affiliates'),
    ],
    defaultProps: () => ({ showSummary: true, showTerms: true, showSignIn: true }),
  },
]
