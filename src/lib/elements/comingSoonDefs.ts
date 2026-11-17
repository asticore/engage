import type { ElementDef } from './registry'

/**
 * Coming soon signup: the email box of the coming soon screen, for the Coming soon screen template. It posts to the
 * built-in Coming soon form, so each signup is a normal form entry. Server rendered (SITE_ELEMENT_TYPES); renderer:
 * src/components/blocks/elements/ComingSoonServer.tsx. It draws nothing outside the screen, or when the form is a
 * draft, Forms is off or a captcha is on for forms.
 */
export const COMING_SOON_ELEMENTS: ElementDef[] = [
  {
    type: 'coming-soon-signup',
    label: 'Coming soon signup',
    icon: '✉',
    category: 'siteMeta',
    description: 'The email signup box for the coming soon screen. Signups appear under Forms, Coming soon, Submissions. Set that form to Draft to hide the box.',
    fields: [],
    defaultProps: () => ({}),
  },
]
