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
]
