import type { EditorField } from './fieldTypes'
import type { ElementDef } from './registry'

/**
 * Wave 68 (Task 10): world-clock, progress-tracker and dark-mode-toggle. Client renderers in Wave68Elements.tsx,
 * styles in wave68.css. Icons are String.fromCodePoint escapes so this file stays ASCII.
 */

const text = (name: string, label: string, extra: Partial<EditorField> = {}): EditorField => ({ name, label, type: 'text', ...extra })
const area = (name: string, label: string, helpText?: string): EditorField => ({ name, label, type: 'textarea', helpText })
const check = (name: string, label: string, helpText?: string): EditorField => ({ name, label, type: 'checkbox', helpText })
const labelled = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ label, value }))

export const WAVE68_ELEMENTS: ElementDef[] = [
  {
    type: 'world-clock', label: 'World clock', icon: String.fromCodePoint(0x1f30d), category: 'interactive',
    description: 'Clocks for several cities, analogue or digital, 12 or 24 hour. Updates every second in the visitor\'s browser.',
    fields: [
      area('zones', 'Cities', 'One per line: "City | Time zone", like "Sydney | Australia/Sydney". Up to 12 rows. Unknown zones are skipped.'),
      { name: 'style', label: 'Style', type: 'select', width: 'half', options: labelled([['digital', 'Digital'], ['analogue', 'Analogue']]) },
      { name: 'hour12', label: 'Hours', type: 'select', width: 'half', options: labelled([['24', '24 hour'], ['12', '12 hour']]) },
      check('showSeconds', 'Show seconds'),
      check('showDate', 'Show date'),
    ],
    defaultProps: () => ({ zones: 'Sydney | Australia/Sydney\nLondon | Europe/London\nNew York | America/New_York', style: 'digital', hour12: '24', showSeconds: true, showDate: false }),
  },
  {
    type: 'progress-tracker', label: 'Progress tracker', icon: String.fromCodePoint(0x1f4cd), category: 'interactive',
    description: 'A row of steps with the current one highlighted, for checkouts, onboarding and multi-step processes.',
    fields: [
      area('steps', 'Steps', 'One step per line.'),
      { name: 'current', label: 'Current step', type: 'number', width: 'half', helpText: 'Number of the step in progress (1 is the first). Steps before it show as done.' },
      { name: 'currentFromUrl', label: 'Read the step from the address', type: 'text', width: 'half', helpText: 'Optional query parameter, like "step". When the address holds it, it overrides the number.' },
      { name: 'direction', label: 'Layout', type: 'select', width: 'half', options: labelled([['horizontal', 'Horizontal'], ['vertical', 'Vertical']]) },
    ],
    defaultProps: () => ({ steps: 'Cart\nDetails\nPayment\nDone', current: 2, currentFromUrl: '', direction: 'horizontal' }),
  },
  {
    type: 'dark-mode-toggle', label: 'Dark mode toggle', icon: String.fromCodePoint(0x1f319), category: 'interactive',
    description: 'A switch between light and dark. It remembers the choice in the visitor\'s browser and starts from the system setting.',
    fields: [
      text('label', 'Label', { helpText: 'Read by screen readers. Shown next to the switch when "Show label" is on.' }),
      check('showLabel', 'Show label'),
    ],
    defaultProps: () => ({ label: 'Dark mode', showLabel: false }),
  },
]
