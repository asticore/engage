import type { ElementDef } from './registry'

/**
 * Elements from the Elfsight catalogue sweep (34g): QR code and PDF viewer. Both render on the server with no
 * third party: the QR code is drawn locally and the PDF opens in the browser's own viewer.
 */
export const UTILITY_ELEMENTS: ElementDef[] = [
  {
    type: 'qr-code', label: 'QR code', icon: String.fromCodePoint(0x1f532), category: 'media',
    description: 'A QR code drawn on your own server (no outside service). Link to a page, a menu, a Wi-Fi sign-in or any text.',
    fields: [
      { name: 'data', label: 'Address or text', type: 'text', helpText: 'For example https://example.com/menu or WIFI:T:WPA;S:MyNetwork;P:password;;' },
      { name: 'size', label: 'Size (px)', type: 'range', width: 'half', min: 80, max: 600, step: 10 },
      { name: 'caption', label: 'Caption', type: 'text', width: 'half' },
      { name: 'label', label: 'Accessible description', type: 'text', helpText: 'Read out by screen readers, for example QR code for the menu.' },
      { name: 'align', label: 'Alignment', type: 'select', width: 'half', options: [{ label: 'Left', value: 'left' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'right' }] },
    ],
    defaultProps: () => ({ data: 'https://example.com', size: 200, caption: 'Scan to open', label: 'QR code', align: 'center' }),
  },
  {
    type: 'pdf-viewer', label: 'PDF viewer', icon: String.fromCodePoint(0x1f4c4), category: 'media',
    description: 'Shows a PDF from your Media library on the page with the browser viewer and a download link as the fallback. Only loads when scrolled near.',
    fields: [
      { name: 'file', label: 'PDF from the media library', type: 'media' },
      { name: 'url', label: 'Or PDF address', type: 'text', helpText: 'Used when no file is chosen above. A full https address or a /media path.' },
      { name: 'height', label: 'Height (px)', type: 'range', width: 'half', min: 200, max: 1200, step: 20 },
      { name: 'title', label: 'Title', type: 'text', width: 'half', helpText: 'Names the viewer for screen readers and the download link.' },
      { name: 'download', label: 'Show the download link', type: 'checkbox' },
    ],
    defaultProps: () => ({ file: undefined, url: '', height: 600, title: 'Document', download: true }),
  },
  {
    type: 'floating-action-button', label: 'Floating action button', icon: String.fromCodePoint(0x2795), category: 'layout',
    description: 'A round button fixed to a corner of the screen that opens a small menu: call, email, chat, scroll to top or any link. Works without JavaScript.',
    fields: [
      { name: 'label', label: 'Button label (screen readers)', type: 'text', width: 'half' },
      { name: 'icon', label: 'Button symbol', type: 'text', width: 'half', helpText: 'One character or emoji, for example + or a phone.' },
      { name: 'corner', label: 'Corner', type: 'select', width: 'half', options: [{ label: 'Bottom right', value: 'bottom-right' }, { label: 'Bottom left', value: 'bottom-left' }] },
      { name: 'items', label: 'Menu items', type: 'textarea', helpText: 'One per line: Label | address. Use tel:+123456, mailto:you@example.com, #top for scroll to top, or a page address.' },
    ],
    defaultProps: () => ({ label: 'Quick actions', icon: '+', corner: 'bottom-right', items: 'Call us | tel:+10000000000\nEmail us | mailto:hello@example.com\nBack to top | #top' }),
  },
  {
    type: 'poll', label: 'Poll', icon: String.fromCodePoint(0x1f4ca), category: 'media',
    description: 'A one-question poll. Each visitor votes once (remembered in their browser) and then sees the results as bars. Votes are stored on your own site.',
    fields: [
      { name: 'pollId', label: 'Poll id', type: 'text', width: 'half', helpText: 'Letters, numbers and dashes. Keep it the same to keep the votes; use a new id to start fresh.' },
      { name: 'question', label: 'Question', type: 'text', width: 'half' },
      { name: 'options', label: 'Options', type: 'textarea', helpText: 'One answer per line, up to 12.' },
      { name: 'showResults', label: 'Show results after voting', type: 'checkbox' },
    ],
    defaultProps: () => ({ pollId: `poll-${Math.random().toString(36).slice(2, 8)}`, question: 'What should we do next?', options: 'Option one\nOption two\nOption three', showResults: true }),
  },
]
