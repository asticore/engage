import type { ElementDef } from './registry'

/**
 * 3D viewer and product configurator (34d). The viewer uses the open model-viewer web component, loaded from a
 * CDN only when it scrolls into view. The configurator stacks image layers and lets visitors pick options.
 */
export const THREE_D_ELEMENTS: ElementDef[] = [
  {
    type: 'model-viewer', label: '3D model viewer', icon: String.fromCodePoint(0x1f9ca), category: 'media',
    description: 'Shows a 3D model (glTF or GLB) that visitors can turn and zoom, with an optional AR button on phones. The viewer loads only when scrolled near.',
    fields: [
      { name: 'file', label: 'GLB or glTF file from the media library', type: 'media' },
      { name: 'url', label: 'Or model address', type: 'text', helpText: 'Used when no file is chosen above. A full https address or a /media path ending in .glb or .gltf.' },
      { name: 'poster', label: 'Poster picture', type: 'media', helpText: 'Shown until the model loads and for visitors with reduced motion.' },
      { name: 'height', label: 'Height (px)', type: 'range', width: 'half', min: 200, max: 900, step: 20 },
      { name: 'alt', label: 'Description', type: 'text', width: 'half', helpText: 'Read out by screen readers.' },
      { name: 'autoRotate', label: 'Turn slowly on its own', type: 'checkbox' },
      { name: 'ar', label: 'Show the AR button on phones', type: 'checkbox' },
    ],
    defaultProps: () => ({ file: undefined, url: '', poster: undefined, height: 480, alt: '3D model', autoRotate: true, ar: true }),
  },
  {
    type: 'product-configurator', label: 'Product configurator', icon: String.fromCodePoint(0x1f9e9), category: 'media',
    description: 'Layered pictures with options: choose a colour or part and its layer swaps in, the price updates, and an exploded view spreads the layers apart with hotspots. Built from pictures only.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', width: 'half' },
      { name: 'basePrice', label: 'Base price', type: 'number', width: 'half', helpText: 'Shown with the options added. Leave 0 to hide prices.' },
      { name: 'currency', label: 'Currency symbol', type: 'text', width: 'half' },
      { name: 'layers', label: 'Options', type: 'textarea', helpText: 'One per line: Group | Option name | picture address | price change. The first option of each group is chosen at first. Groups stack in the order they first appear; a blank picture address means that option shows nothing (for example No case).' },
      { name: 'hotspots', label: 'Hotspots', type: 'textarea', helpText: 'One per line: across % | down % | label. Shown on the exploded view.' },
      { name: 'exploded', label: 'Show the Exploded view button', type: 'checkbox' },
      { name: 'height', label: 'Picture height (px)', type: 'range', width: 'half', min: 200, max: 900, step: 20 },
    ],
    defaultProps: () => ({
      title: 'Build yours', basePrice: 0, currency: '$', exploded: true, height: 420,
      layers: 'Body | Black | | 0\nBody | White | | 0\nCase | None | | 0\nCase | Armour | | 15',
      hotspots: '',
    }),
  },
]
