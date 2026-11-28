import type { EditorField } from './fieldTypes'
import type { ElementDef } from './registry'

/** Wave 64: audio, code highlight, image accordion and video playlist. Renderers: Wave64Elements.tsx, styles: wave64.css. */

const text = (name: string, label: string, extra: Partial<EditorField> = {}): EditorField => ({ name, label, type: 'text', ...extra })

export const WAVE64_ELEMENTS: ElementDef[] = [
  {
    type: 'billing-toggle', label: 'Billing toggle', icon: String.fromCodePoint(0x1f501), category: 'marketing',
    description: 'A monthly and yearly switch. Pricing tables on the page that have a yearly price change with it.',
    fields: [
      text('monthlyLabel', 'Monthly label', { width: 'half' }), text('yearlyLabel', 'Yearly label', { width: 'half' }),
      text('saveText', 'Saving note', { helpText: 'For example "Save 20%". Leave empty for none.' }),
      { name: 'startYearly', label: 'Start on yearly', type: 'checkbox' },
    ],
    defaultProps: () => ({ monthlyLabel: 'Monthly', yearlyLabel: 'Yearly', saveText: 'Save 20%', startYearly: false }),
  },
  {
    type: 'lottie-player', label: 'Lottie animation', icon: String.fromCodePoint(0x2728), category: 'media',
    description: 'A Lottie animation (.lottie or .json) that plays on its own, on hover or as you scroll. Loads its player only when it comes into view.',
    fields: [
      { name: 'file', label: 'Animation file', type: 'media' },
      text('url', 'Or animation address', { helpText: 'An https address of a .lottie or .json file. Used when no file is chosen.' }),
      { name: 'mode', label: 'Plays', type: 'select', width: 'half', options: [{ label: 'On its own', value: 'autoplay' }, { label: 'While hovered or focused', value: 'hover' }, { label: 'Follows scrolling', value: 'scroll' }] },
      { name: 'height', label: 'Height (px)', type: 'number', width: 'half' },
      { name: 'loop', label: 'Loop', type: 'checkbox' },
      text('label', 'Description for screen readers'),
    ],
    defaultProps: () => ({ mode: 'autoplay', height: 300, loop: true, label: 'Animation' }),
  },
  {
    type: 'audio', label: 'Audio', icon: String.fromCodePoint(0x1f50a), category: 'media',
    description: 'A sound file with the browser audio player, or a Spotify or SoundCloud player. Never plays by itself.',
    fields: [
      { name: 'file', label: 'Audio file', type: 'media' }, text('url', 'Or audio address', { helpText: 'An https address of an mp3, ogg, wav or m4a file, or a Spotify or SoundCloud track, album or playlist link (loads after consent). Used when no file is chosen.' }),
      text('title', 'Title'),
      { name: 'loop', label: 'Loop', type: 'checkbox' },
    ],
    defaultProps: () => ({ title: 'Audio', loop: false }),
  },
  {
    type: 'code-highlight', label: 'Code', icon: String.fromCodePoint(0x1f4bb), category: 'text',
    description: 'A block of code with colours, optional line numbers and a copy button.',
    fields: [
      { name: 'code', label: 'Code', type: 'textarea' },
      { name: 'language', label: 'Language', type: 'select', width: 'half', options: ['js', 'ts', 'json', 'html', 'css', 'bash', 'python'].map((v) => ({ label: v, value: v })) },
      { name: 'lineNumbers', label: 'Line numbers', type: 'checkbox' },
      { name: 'copy', label: 'Copy button', type: 'checkbox' },
    ],
    defaultProps: () => ({ code: 'const hello = "world"', language: 'js', lineNumbers: true, copy: true }),
  },
  {
    type: 'image-accordion', label: 'Image accordion', icon: String.fromCodePoint(0x25a4), category: 'media',
    description: 'Three to six pictures side by side. The one you hover, focus or tap grows.',
    fields: [
      { name: 'panels', label: 'Panels (3-6)', type: 'repeater', repeater: { fields: [text('url', 'Image address (https://...)'), text('title', 'Title'), text('alt', 'Alt text'), text('link', 'Link (optional)')] } },
      { name: 'height', label: 'Height (px)', type: 'range', width: 'half', min: 200, max: 700, step: 10 },
    ],
    defaultProps: () => ({ panels: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }], height: 360 }),
  },
  {
    type: 'video-playlist', label: 'Video playlist', icon: String.fromCodePoint(0x1f4fa), category: 'media',
    description: 'A player with a list of videos beside it. YouTube, Vimeo, Spotify and SoundCloud wait for consent.',
    fields: [
      { name: 'items', label: 'Videos', type: 'textarea', helpText: 'One per line: "https://... | Title". YouTube, Vimeo, Spotify, SoundCloud or .mp4 / .webm.' },
      text('label', 'Accessible name'),
    ],
    defaultProps: () => ({ items: '', label: 'Video playlist' }),
  },
  {
    type: 'before-after', label: 'Before and after', icon: String.fromCodePoint(0x2194), category: 'media',
    description: 'Two pictures of the same size. Drag the handle, or use the keyboard, to reveal the second over the first (Spark compare).',
    fields: [
      { name: 'before', label: 'Before picture', type: 'media' }, text('beforeUrl', 'Or before picture address', { helpText: 'An https address. Used when no picture is chosen.' }),
      { name: 'after', label: 'After picture', type: 'media' }, text('afterUrl', 'Or after picture address', { helpText: 'An https address. Used when no picture is chosen.' }),
      text('beforeAlt', 'Before description', { width: 'half' }), text('afterAlt', 'After description', { width: 'half' }),
      { name: 'start', label: 'Starting position (%)', type: 'range', width: 'half', min: 0, max: 100, step: 1 },
      { name: 'vertical', label: 'Split top and bottom', type: 'checkbox' },
      { name: 'hover', label: 'Follow the mouse without dragging', type: 'checkbox' },
    ],
    defaultProps: () => ({ start: 50, vertical: false, hover: false, beforeAlt: 'Before', afterAlt: 'After' }),
  },
  {
    type: 'popup', label: 'Popup', icon: String.fromCodePoint(0x1f5d4), category: 'marketing',
    description: 'A button that opens a popup window (Spark popup on a Shine modal). It can also open by itself after a delay, after scrolling or when the visitor is about to leave.',
    fields: [
      text('buttonLabel', 'Button text', { helpText: 'Leave empty for no button (use auto open or a link to the popup).' }),
      text('title', 'Popup title'),
      { name: 'body', label: 'Popup text', type: 'textarea', helpText: 'A blank line starts a new paragraph.' },
      { name: 'image', label: 'Popup picture (optional)', type: 'media' },
      text('ctaLabel', 'Popup button text', { width: 'half' }), text('ctaUrl', 'Popup button link', { width: 'half' }),
      { name: 'delay', label: 'Open after (seconds, 0 = off)', type: 'number', width: 'half' },
      { name: 'scroll', label: 'Open after scrolling (%, 0 = off)', type: 'number', width: 'half' },
      { name: 'exit', label: 'Open when the visitor is about to leave (desktop)', type: 'checkbox' },
      { name: 'frequency', label: 'Auto open how often', type: 'select', width: 'half', options: [{ label: 'Every visit to the page', value: 'always' }, { label: 'Once per browser session', value: 'session' }, { label: 'Once every few days', value: 'days' }, { label: 'Only once', value: 'once' }] },
      { name: 'days', label: 'Days between (for "every few days")', type: 'number', width: 'half' },
      text('closeLabel', 'Close button description'),
    ],
    defaultProps: () => ({ buttonLabel: 'Open popup', title: 'Popup title', body: 'Popup text.', delay: 0, scroll: 0, exit: false, frequency: 'session', days: 7, closeLabel: 'Close' }),
  },
]
