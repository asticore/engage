import type { ElementDef } from './registry'

/**
 * Wave 69 (Task 10): product widgets read from the product on the page (block context): product-images,
 * product-stock, product-short-description and product-meta. Server rendered (SITE_ELEMENT_TYPES), renderers in
 * Wave69Server.tsx, styles wave69.css. Icons are String.fromCodePoint escapes so this file stays ASCII.
 */

export const WAVE69_ELEMENTS: ElementDef[] = [
  {
    type: 'product-images', label: 'Product images', icon: String.fromCodePoint(0x1f5bc), category: 'commerce',
    description: 'The product pictures: a large picture with a row of thumbnails to switch. Click the large picture to zoom.',
    fields: [
      { name: 'thumbnails', label: 'Show thumbnails', type: 'checkbox' },
      { name: 'zoom', label: 'Zoom on hover', type: 'checkbox' },
    ],
    defaultProps: () => ({ thumbnails: true, zoom: true }),
  },
  {
    type: 'product-stock', label: 'Product stock', icon: String.fromCodePoint(0x1f4e6), category: 'commerce',
    description: 'In stock, low stock with the count left, out of stock, or on backorder.',
    fields: [
      { name: 'inStockText', label: 'In stock text', type: 'text', width: 'half' },
      { name: 'lowStockText', label: 'Low stock text', type: 'text', width: 'half', helpText: 'Use {count} for the number left.' },
      { name: 'outOfStockText', label: 'Out of stock text', type: 'text', width: 'half' },
      { name: 'backorderText', label: 'Backorder text', type: 'text', width: 'half' },
      { name: 'lowAt', label: 'Low stock at or below', type: 'number', width: 'half', helpText: 'Used when the product has no low stock level of its own.' },
    ],
    defaultProps: () => ({ inStockText: 'In stock', lowStockText: 'Only {count} left', outOfStockText: 'Out of stock', backorderText: 'Available on backorder', lowAt: 5 }),
  },
  {
    type: 'product-short-description', label: 'Product short description', icon: String.fromCodePoint(0x1f4c4), category: 'commerce',
    description: 'The short description of the product on this page.',
    fields: [],
    defaultProps: () => ({}),
  },
  {
    type: 'product-meta', label: 'Product meta', icon: String.fromCodePoint(0x1f3f7), category: 'commerce',
    description: 'SKU, GTIN and category of the product on this page.',
    fields: [
      { name: 'showSku', label: 'Show SKU', type: 'checkbox' },
      { name: 'showGtin', label: 'Show GTIN', type: 'checkbox' },
      { name: 'showCategory', label: 'Show category', type: 'checkbox' },
    ],
    defaultProps: () => ({ showSku: true, showGtin: false, showCategory: true }),
  },
]
