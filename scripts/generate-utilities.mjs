#!/usr/bin/env node
/**
 * Generates src/styles/engage-utilities.css: the utility classes the code
 * uses that Shine CSS (vendored in src/styles/shine/) does not ship
 * (arbitrary values such as `text-[12px]`, `gap-[6px]`, `hover:text-[var(--x)]`,
 * plus the admin's semantic colours such as `bg-surface` and `text-ink`).
 *
 * Replaces the Tailwind compiler: this is a one-off, deterministic, build-free
 * generator (no runtime, no dependency). Run `node scripts/generate-utilities.mjs`
 * after adding a new utility class; `--check` (used by the test) fails when the
 * committed file is out of date.
 *
 * Unhandled tokens are printed and fail the run, so nothing silently loses its
 * style.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'src/styles/engage-utilities.css')
const SHINE = join(root, 'src/styles/shine/shine.css')

const walk = (d, acc = []) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    const s = statSync(p)
    if (s.isDirectory()) {
      if (n === 'node_modules' || n === 'shine') continue
      walk(p, acc)
    } else if (/\.(tsx?|css)$/.test(n) && n !== 'engage-utilities.css') acc.push(p)
  }
  return acc
}

const shine = existsSync(SHINE) ? readFileSync(SHINE, 'utf8') : ''
const defined = new Set(
  [...shine.matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)/g)].map((m) => m[1].replace(/\\/g, '')),
)

// ---------- token discovery ----------
const tokenRe = /[A-Za-z!\-][A-Za-z0-9:\[\]()_/.%#,'=\-]*/g
const tokens = new Set()
for (const f of walk(join(root, 'src'))) {
  const s = readFileSync(f, 'utf8')
  for (const lit of s.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) {
    const str = lit[1] ?? lit[2] ?? lit[3] ?? ''
    for (const w of str.split(/\s+/)) {
      let t = w.replace(/^['"`{(,]+|['"`},;]+$/g, '')
      while (/[)\]]$/.test(t) && (t.split('[').length < t.split(']').length || t.split('(').length < t.split(')').length)) t = t.slice(0, -1)
      if (t && /^[A-Za-z!\-][^\s]*$/.test(t) && !t.includes('${')) tokens.add(t)
    }
  }
  if (f.endsWith('.css')) {
    for (const m of s.matchAll(/@apply\s+([^;]+);/g)) {
      for (const w of m[1].split(/\s+/)) if (w) tokens.add(w)
    }
  }
}
void tokenRe

// ---------- resolver ----------
const SP = (n) => `calc(var(--sh-space) * ${n})`
const spacingVal = (v) => {
  if (v === 'px') return '1px'
  if (v === 'auto') return 'auto'
  if (v === 'full') return '100%'
  if (/^\d+(\.\d+)?$/.test(v)) return SP(v)
  const fr = v.match(/^(\d+)\/(\d+)$/)
  if (fr) return `${(100 * fr[1]) / fr[2]}%`
  return null
}
const arb = (v) => {
  const al = v.match(/^(\[.*\])\/(\d+)$/)
  if (al) {
    const r = arb(al[1])
    return r && { ...r, v: `color-mix(in oklab, ${r.v} ${al[2]}%, transparent)` }
  }
  const m = v.match(/^\[(.*)\]$/)
  if (!m) return null
  let x = m[1].replace(/_/g, ' ')
  const typed = x.match(/^(length|color|image|family-name|percentage|url|number):(.*)$/)
  return { type: typed?.[1], v: typed ? typed[2] : x }
}
const isColor = (v) => /^(var\(--[^)]*(color|ink|cream|gold|line|surface|ground|elev|ac-|theme)[^)]*\)|#|rgb|hsl|oklch|color-mix|transparent|currentColor)/i.test(v)
const isLen = (v) => /^-?[\d.]+(px|rem|em|%|vw|vh|ch)$/.test(v) || /^calc\(|^clamp\(|^min\(|^max\(/.test(v)
const colorWithAlpha = (c, alpha) => (alpha ? `color-mix(in oklab, ${c} ${alpha}%, transparent)` : c)

const NAMED_COLORS = {
  surface: 'var(--ac-surface)',
  ground: 'var(--ac-ground)',
  border: 'var(--theme-elevation-150)',
  'border-strong': 'var(--theme-elevation-250)',
  ink: 'var(--theme-elevation-900)',
  'ink-muted': 'var(--theme-elevation-600)',
  accent: 'var(--ac-gold)',
  'accent-soft': 'var(--ac-gold-soft)',
  'accent-contrast': 'var(--ac-gold-contrast)',
  danger: 'var(--theme-error-500, #b3261e)',
  white: '#fff',
  black: '#000',
  inherit: 'inherit',
  current: 'currentColor',
  transparent: 'transparent',
  'red-700': '#b91c1c',
  'red-600': '#dc2626',
  'red-500': '#ef4444',
}
const RADII = {
  s: 'var(--style-radius-s)',
  m: 'var(--style-radius-m)',
  l: 'var(--style-radius-l)',
  none: '0',
  sm: '.125rem',
  '': '.25rem',
  md: '.375rem',
  lg: '.5rem',
  xl: '.75rem',
  '2xl': '1rem',
  full: '9999px',
}

const SPACING_PROPS = {
  p: ['padding'], px: ['padding-left', 'padding-right'], py: ['padding-top', 'padding-bottom'],
  pt: ['padding-top'], pr: ['padding-right'], pb: ['padding-bottom'], pl: ['padding-left'],
  m: ['margin'], mx: ['margin-left', 'margin-right'], my: ['margin-top', 'margin-bottom'],
  mt: ['margin-top'], mr: ['margin-right'], mb: ['margin-bottom'], ml: ['margin-left'],
  gap: ['gap'], 'gap-x': ['column-gap'], 'gap-y': ['row-gap'],
  top: ['top'], right: ['right'], bottom: ['bottom'], left: ['left'], inset: ['inset'],
  w: ['width'], h: ['height'], size: ['width', 'height'],
  'min-w': ['min-width'], 'min-h': ['min-height'], 'max-w': ['max-width'], 'max-h': ['max-height'],
}

/** returns declaration string or null */
function resolve(base, neg) {
  // spacing-like
  const m = base.match(/^(p[xytrbl]?|m[xytrbl]?|gap-x|gap-y|gap|top|right|bottom|left|inset|w|h|size|min-w|min-h|max-w|max-h)-(.+)$/)
  if (m && SPACING_PROPS[m[1]]) {
    const a = arb(m[2])
    let val = a ? a.v : spacingVal(m[2])
    if (val == null) return null
    if (neg) val = `calc(${val} * -1)`
    return SPACING_PROPS[m[1]].map((p) => `${p}:${val}`).join(';')
  }
  let mm
  if ((mm = base.match(/^opacity-(\d+)$/))) return `opacity:${mm[1] / 100}`
  if ((mm = base.match(/^z-(.+)$/))) return `z-index:${arb(mm[1])?.v ?? mm[1]}`
  if ((mm = base.match(/^order-(.+)$/))) return `order:${arb(mm[1])?.v ?? mm[1]}`
  if ((mm = base.match(/^flex-(\[.*\])$/))) return `flex:${arb(mm[1]).v}`
  if ((mm = base.match(/^aspect-(\[.*\])$/))) return `aspect-ratio:${arb(mm[1]).v.replace(/\s/g, '')}`
  if ((mm = base.match(/^leading-(.+)$/))) {
    const a = arb(mm[1])
    return a ? `line-height:${a.v}` : null
  }
  if ((mm = base.match(/^tracking-(.+)$/))) {
    const a = arb(mm[1])
    return a ? `letter-spacing:${a.v}` : null
  }
  if ((mm = base.match(/^grid-cols-(.+)$/))) {
    const a = arb(mm[1])
    if (a) return `grid-template-columns:${a.v.replace(/,\s+/g, ',')}`
    if (/^\d+$/.test(mm[1])) return `grid-template-columns:repeat(${mm[1]},minmax(0,1fr))`
    return null
  }
  if ((mm = base.match(/^shadow-(\[.*\])$/))) return `box-shadow:${arb(mm[1]).v}`
  if ((mm = base.match(/^rounded-(.*)$/)) || base === 'rounded') {
    const k = mm ? mm[1] : ''
    const a = arb(k)
    const v = a ? a.v : RADII[k]
    return v ? `border-radius:${v}` : null
  }
  if ((mm = base.match(/^font-(\[.*\])$/))) {
    const a = arb(mm[1])
    return a?.type === 'family-name' ? `font-family:${a.v}` : null
  }
  if (base === 'font-semibold') return 'font-weight:600'
  if (base === 'whitespace-pre-line') return 'white-space:pre-line'
  if (base === 'cursor-crosshair') return 'cursor:crosshair'
  if (base === 'bg-none') return 'background-image:none'
  if ((mm = base.match(/^text-(.+)$/))) {
    const a = arb(mm[1])
    if (a) {
      if (a.type === 'length' || (!a.type && isLen(a.v))) return `font-size:${a.v}`
      if (a.type === 'color' || isColor(a.v)) return `color:${a.v}`
      return null
    }
    const [name, alpha] = mm[1].split('/')
    if (NAMED_COLORS[name]) return `color:${colorWithAlpha(NAMED_COLORS[name], alpha)}`
    return null
  }
  if ((mm = base.match(/^bg-(.+)$/))) {
    const a = arb(mm[1])
    if (a) {
      if (a.type === 'image' || /gradient\(/.test(a.v)) return `background-image:${a.v}`
      return `background-color:${a.v}`
    }
    const [name, alpha] = mm[1].split('/')
    if (NAMED_COLORS[name]) return `background-color:${colorWithAlpha(NAMED_COLORS[name], alpha)}`
    return null
  }
  if ((mm = base.match(/^border-(?:(l|r|t|b)-)?(.+)$/))) {
    const side = { l: 'left', r: 'right', t: 'top', b: 'bottom' }[mm[1]]
    const a = arb(mm[2])
    if (a) {
      if (a.type === 'length' || (!a.type && isLen(a.v))) return `border-${side ? side + '-' : ''}width:${a.v}`
      return `border-${side ? side + '-' : ''}color:${a.v}`
    }
    const [name, alpha] = mm[2].split('/')
    if (NAMED_COLORS[name] && !side) return `border-color:${colorWithAlpha(NAMED_COLORS[name], alpha)}`
    return null
  }
  return null
}

const esc = (t) => t.replace(/[^A-Za-z0-9_-]/g, (c) => '\\' + c)
const MEDIA = {
  sm: '(min-width:640px)', md: '(min-width:768px)', lg: '(min-width:1024px)', xl: '(min-width:1280px)',
  'max-sm': '(max-width:639.98px)', 'max-md': '(max-width:767.98px)', 'max-lg': '(max-width:1023.98px)',
}

function splitVariants(tok) {
  const parts = []
  let depth = 0, cur = ''
  for (const ch of tok) {
    if (ch === '[') depth++
    if (ch === ']') depth--
    if (ch === ':' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  parts.push(cur)
  return { variants: parts.slice(0, -1), base: parts[parts.length - 1] }
}

const rules = { plain: [], media: new Map() }
const unhandled = []
const GUARD = /^(!?)(?:(?:sm|md|lg|xl|max-sm|max-md|max-lg|max-\[[^\]]+\]|hover|focus|group-hover):)*-?(?:p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|top|right|bottom|left|inset|w|h|size|min-w|min-h|max-w|max-h|opacity|z|order|flex|aspect|leading|tracking|grid-cols|shadow|rounded|font|whitespace|cursor|text|bg|border)(?:-|$)/

for (const raw of [...tokens].sort()) {
  if (!GUARD.test(raw)) continue
  const { variants, base0 } = (() => { const r = splitVariants(raw); return { variants: r.variants, base0: r.base } })()
  let base = base0.replace(/^!/, '')
  const neg = base.startsWith('-')
  if (neg) base = base.slice(1)
  // only generate what Shine lacks, or what Tailwind theme colours redefine
  const themeColor = /^(text|bg|border)-(surface|ground|border|border-strong|ink|ink-muted|accent|accent-soft|accent-contrast|danger)(\/\d+)?$/.test(base) || /^rounded-(s|m|l)$/.test(base)
  if (!variants.length && !neg && defined.has(base0) && !themeColor) continue
  if (variants.length && !neg && !themeColor && !/\[|\//.test(base) && defined.has(raw)) continue
  const decl = resolve(base, neg)
  if (!decl) {
    // heuristics: only report tokens that clearly look like arbitrary utilities
    if (/\[.+\]/.test(base) || (!variants.length && !defined.has(raw) && /^(opacity|-?top|-?right|-?left|-?bottom|w|h|max-h|text|bg|border)-/.test(raw) && /\d|\[/.test(raw))) unhandled.push(raw)
    continue
  }
  let sel = '.' + esc(raw)
  let media = null
  let pseudo = ''
  let group = false
  for (const v of variants) {
    if (v === 'hover') pseudo += ':hover'
    else if (v === 'focus') pseudo += ':focus'
    else if (v === 'group-hover') group = true
    else if (MEDIA[v]) media = MEDIA[v]
    else if (/^max-\[(.+)\]$/.test(v)) media = `(max-width:${v.match(/^max-\[(.+)\]$/)[1]})`
    else { unhandled.push(raw); break }
  }
  const selector = group ? `.group:hover ${sel}` : `${sel}${pseudo}`
  const important = raw.startsWith('!') ? ' !important' : ''
  const body = decl.split(';').map((d) => d + important).join(';')
  const rule = `${selector}{${body}}`
  if (media) {
    if (!rules.media.has(media)) rules.media.set(media, [])
    rules.media.get(media).push(rule)
  } else rules.plain.push(rule)
}

if (unhandled.length) {
  console.error('Unhandled utility tokens (add to scripts/generate-utilities.mjs):\n' + [...new Set(unhandled)].join('\n'))
  process.exit(1)
}

const order = ['(max-width', '(min-width:640', '(min-width:768', '(min-width:1024', '(min-width:1280']
const mediaKeys = [...rules.media.keys()].sort((a, b) => order.findIndex((o) => a.startsWith(o)) - order.findIndex((o) => b.startsWith(o)))
const css =
  `/* GENERATED by scripts/generate-utilities.mjs. Do not edit by hand.\n` +
  ` * Utility classes the code uses that Shine CSS does not ship (arbitrary values,\n` +
  ` * admin semantic colours). Layer \`utilities\` sits above every shine.* layer. */\n` +
  `@layer utilities {\n` +
  rules.plain.map((r) => '  ' + r).join('\n') +
  '\n' +
  mediaKeys.map((k) => `  @media ${k} {\n${rules.media.get(k).map((r) => '    ' + r).join('\n')}\n  }`).join('\n') +
  `\n}\n`

if (process.argv.includes('--check')) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (cur !== css) {
    console.error('src/styles/engage-utilities.css is out of date: run node scripts/generate-utilities.mjs')
    process.exit(1)
  }
} else {
  writeFileSync(OUT, css)
  console.log(`wrote ${OUT}: ${rules.plain.length} rules + ${[...rules.media.values()].flat().length} responsive`)
}
