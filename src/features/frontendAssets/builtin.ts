/**
 * Shine (styling) and Spark (effects) are not hosted by the customer's deployment. Pages reference the files
 * published in the GitHub releases of asticore/shine and asticore/spark through jsDelivr, which serves each
 * release tag unchanged. Every file carries an integrity hash, so a changed file is refused by the browser.
 * The copy under public/vendor is only the fallback for when the CDN cannot be reached (and what the hash
 * test checks against). To move to a newer release, change the tag and the hash here together, copy the
 * file to public/vendor, and update reference/references.json.
 */

export const SHINE_VERSION = 'v1'
export const SHINE_CSS_URL = `https://cdn.jsdelivr.net/gh/asticore/shine@${SHINE_VERSION}/dist/shine.min.css`
export const SHINE_CSS_INTEGRITY = 'sha384-MAlmG3nB3VsUmWPn+V1OXN7lLLLKcwjHt80cciS4D091Z8Z3oVFSXYyHoAd1PYg8'
export const SHINE_CSS_FALLBACK = '/vendor/shine/shine.min.css'

export const SPARK_VERSION = 'v0'
export const SPARK_BASE_URL = `https://cdn.jsdelivr.net/gh/asticore/spark@${SPARK_VERSION}/dist/`
export const SPARK_LOADER_INTEGRITY = 'sha384-D1bxc+iw2iTH+2BbjI16rTqlleeYxpxIatKsatenS0Zj6UUBVaT6Pdz+X2e1VDQW'
export const SPARK_FALLBACK_BASE = '/vendor/spark/'

export type AssetKind = 'css' | 'js'

/** One ready-made entry in the picker. Hashes were taken from the file the URL serves. */
export type AssetPreset = {
  id: string
  label: string
  description: string
  assets: { kind: AssetKind; url: string; integrity?: string; defer?: boolean }[]
}

export const ASSET_PRESETS: AssetPreset[] = [
  {
    id: 'bootstrap',
    label: 'Bootstrap 5.3.3',
    description: 'Stylesheet and scripts (dropdowns, modals, carousels).',
    assets: [
      { kind: 'css', url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css', integrity: 'sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH' },
      { kind: 'js', url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js', integrity: 'sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz', defer: true },
    ],
  },
  {
    id: 'bulma',
    label: 'Bulma 1.0.2',
    description: 'CSS only framework.',
    assets: [{ kind: 'css', url: 'https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css', integrity: 'sha384-tl5h4XuWmVzPeVWU0x8bx0j/5iMwCBduLEgZ+2lH4Wjda+4+q3mpCww74dgAB3OX' }],
  },
  {
    id: 'pico',
    label: 'Pico CSS 2.0.6',
    description: 'Small classless stylesheet.',
    assets: [{ kind: 'css', url: 'https://cdn.jsdelivr.net/npm/@picocss/pico@2.0.6/css/pico.min.css', integrity: 'sha384-7P0NVe9LPDbUCAF+fH2R8Egwz1uqNH83Ns/bfJY0fN2XCDBMUI2S9gGzIOIRBKsA' }],
  },
  {
    id: 'tailwind',
    label: 'Tailwind (Play CDN)',
    description: 'Builds the classes used on the page in the browser. Meant for trying things out; the file changes, so it has no integrity hash.',
    assets: [{ kind: 'js', url: 'https://cdn.tailwindcss.com' }],
  },
  {
    id: 'fontawesome',
    label: 'Font Awesome Free 6.5.2',
    description: 'Icon font (free icons).',
    assets: [{ kind: 'css', url: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css', integrity: 'sha384-PPIZEGYM1v8zp5Py7UjFb79S58UeqCL9pYVnVPURKEqvioPROaVAJKKLzvH2rDnI' }],
  },
  {
    id: 'jquery',
    label: 'jQuery 3.7.1',
    description: 'For scripts that need it.',
    assets: [{ kind: 'js', url: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js', integrity: 'sha384-1H217gwSVyLSIfaLxHbE7dRb3v4mYCKbpQvzx0cegeju1MVsGrX5xXxAvs/HgeFs' }],
  },
  {
    id: 'alpine',
    label: 'Alpine.js 3.14.1',
    description: 'Small behaviour layer written in attributes.',
    assets: [{ kind: 'js', url: 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js', integrity: 'sha384-l8f0VcPi/M1iHPv8egOnY/15TDwqgbOR1anMIJWvU6nLRgZVLTLSaNqi/TOoT5Fh', defer: true }],
  },
]
