import type { EditorField } from './fieldTypes'
import type { ElementDef } from './registry'

/**
 * Wave 70 (Task 10): sitemap (server, Wave70Server.tsx, listed in SITE_ELEMENT_TYPES) and age-gate (client,
 * Wave70Elements.tsx). Styles: wave70.css. Icons are String.fromCodePoint escapes so this file stays ASCII.
 */

const text = (name: string, label: string, extra: Partial<EditorField> = {}): EditorField => ({ name, label, type: 'text', ...extra })
const labelled = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ label, value }))

export const WAVE70_SITEMAP_ELEMENTS: ElementDef[] = [
  {
    type: 'sitemap', label: 'Sitemap', icon: String.fromCodePoint(0x1f5fa), category: 'siteMeta',
    description: 'A list of the published pages as a tree. Members-only and no-index pages are left out.',
    fields: [
      { name: 'maxDepth', label: 'Depth', type: 'number', width: 'half', helpText: 'How many levels to show (1 to 6).' },
      { name: 'exclude', label: 'Leave out', type: 'textarea', helpText: 'One page address (slug) per line. Children of a left-out page are left out too.' },
    ],
    defaultProps: () => ({ maxDepth: 3, exclude: '' }),
  },
]

export const WAVE70_CLIENT_ELEMENTS: ElementDef[] = [
  {
    type: 'age-gate', label: 'Age gate', icon: String.fromCodePoint(0x1f51e), category: 'interactive',
    description: 'An overlay that asks the visitor to confirm their age before the page is usable. The answer is remembered in the browser. Search engines are never blocked.',
    fields: [
      { name: 'mode', label: 'Check', type: 'select', width: 'half', options: labelled([['button', 'Yes or no buttons'], ['date', 'Date of birth']]) },
      { name: 'minAge', label: 'Minimum age', type: 'number', width: 'half' },
      text('heading', 'Heading'),
      text('message', 'Message'),
      text('denyUrl', 'Where "No" goes', { helpText: 'An https address, or a path like /sorry. Leave empty to show a message.' }),
      { name: 'rememberDays', label: 'Remember for days', type: 'number', width: 'half' },
    ],
    defaultProps: () => ({ mode: 'button', minAge: 18, heading: 'Are you over 18?', message: 'You must be 18 or older to enter this site.', denyUrl: '', rememberDays: 30 }),
  },
]

export const WAVE70_CHAT_ELEMENTS: ElementDef[] = [
  {
    type: 'chat-button', label: 'Chat button', icon: String.fromCodePoint(0x1f4ac), category: 'interactive',
    description: 'A click-to-chat button for WhatsApp, Messenger or Telegram, with an optional prefilled message and opening hours.',
    fields: [
      { name: 'app', label: 'App', type: 'select', width: 'half', options: labelled([['whatsapp', 'WhatsApp'], ['messenger', 'Messenger'], ['telegram', 'Telegram']]) },
      text('contact', 'Number or username', { width: 'half', helpText: 'WhatsApp: phone number with country code. Messenger: page username. Telegram: username.' }),
      text('label', 'Button text'),
      text('message', 'Prefilled message', { helpText: 'WhatsApp and Telegram only.' }),
      text('hours', 'Show only between', { width: 'half', helpText: '24 hour HH:MM-HH:MM in the visitor\'s own time, like 09:00-17:00. Empty means always.' }),
      { name: 'floating', label: 'Float in the corner', type: 'checkbox' },
    ],
    defaultProps: () => ({ app: 'whatsapp', contact: '', label: 'Chat with us', message: '', hours: '', floating: false }),
  },
]
