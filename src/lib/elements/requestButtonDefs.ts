import type { ElementDef } from './registry'

/**
 * Request button element. Server rendered (registered in SITE_ELEMENT_TYPES) because it needs the Quotes switch and the
 * product the page is about. The renderer is src/components/blocks/elements/RequestButtonServer.tsx. It shows nothing
 * while Quotes and requests is off.
 */
export const REQUEST_BUTTON_ELEMENTS: ElementDef[] = [
  {
    type: 'request-button', label: 'Request button', icon: String.fromCodePoint(0x1f4dd), category: 'commerce',
    description: 'A button that opens the request form: ask for a quote, make an offer or request an item. On a product page it is about that product. Shows nothing while Quotes and requests is switched off.',
    fields: [
      { name: 'kind', label: 'Request type', type: 'select', options: [{ label: 'Ask for a quote', value: 'quote' }, { label: 'Make an offer', value: 'bid' }, { label: 'Request this item', value: 'item' }] },
      { name: 'text', label: 'Button text', type: 'text', helpText: 'Leave empty to use the request type name.' },
      { name: 'productId', label: 'Product ID (optional)', type: 'number', width: 'half', helpText: 'Leave empty on a product page to use that product.' },
      { name: 'variant', label: 'Style', type: 'select', width: 'half', options: [{ label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }, { label: 'Plain', value: 'plain' }] },
      { name: 'size', label: 'Size', type: 'select', width: 'half', options: [{ label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }] },
      { name: 'align', label: 'Align', type: 'select', width: 'half', options: [{ label: 'Left', value: 'left' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'right' }] },
    ],
    defaultProps: () => ({ kind: 'quote', text: '', productId: undefined, variant: 'primary', size: 'md', align: 'left' }),
  },
]
