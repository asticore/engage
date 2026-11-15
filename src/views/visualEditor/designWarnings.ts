import { readFlatDesign } from '@/lib/design/upgrade'
/**
 * Pure design checks for the visual editor's page tree. The Checks list in EditorDock shows the
 * results; clicking one selects the node it points at (see indexNodePaths for the id-to-path map).
 *
 * Rules (warn = likely a real problem, info = worth a look):
 *   - low text/background contrast (WCAG ratio below 4.5), only when both colours are plain hex
 *   - heading order skips a level (h2 straight to h4)
 *   - image over 2 MB, only when the node carries a size in props (fileSize or sizeBytes)
 *   - image with no alt text
 *   - more than 3 heavy effects on one block (particles, parallax, pointer effect, animated background, Ken Burns)
 *   - a button or CTA with a label but no link
 *   - a CSS id (anchor) used by more than one block or column (the warning sits on the owning block)
 *   - Task 20c: contrast also for named theme tokens (checked in the light and the dark theme), gradient backgrounds (against
 *     every stop), text over a picture, video or slideshow with no overlay (a picture cannot be sampled here, so this is info),
 *     the hover colours (fallback to the normal colour for the one not set), and the focus ring (3:1 against the background).
 *     Contrast messages end with a fix suggestion.
 */

import type { SectionNode } from '@/lib/sectionTree'

import type { NodePath } from './treeOps'

export type WarningLevel = 'warn' | 'info'

export type DesignWarning = {
  id: string
  level: WarningLevel
  nodeId: string
  message: string
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const MIN_CONTRAST = 4.5
const MAX_HEAVY_EFFECTS = 3
const ANIMATED_BG_EFFECTS = ['aurora', 'mesh', 'gradient-shift']

type Rec = Record<string, unknown>

const asRec = (value: unknown): Rec => (value && typeof value === 'object' ? (value as Rec) : {})
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** Stable id for a node: its _id when present, otherwise its path. */
export function nodeIdOf(node: SectionNode, path: NodePath): string {
  return typeof node._id === 'string' && node._id ? node._id : `path:${path.join('.')}`
}

type Visited = { node: SectionNode; path: NodePath; nodeId: string }

/** Depth-first, document-order walk. Block paths are odd length, column paths even (see treeOps.ts). */
function visitAll(blocks: SectionNode[], base: NodePath, visit: (item: Visited) => void): void {
  blocks.forEach((node, index) => {
    const path = [...base, index]
    visit({ node, path, nodeId: nodeIdOf(node, path) })
    node.columns?.forEach((column, columnIndex) => {
      visitAll(column.blocks || [], [...path, columnIndex], visit)
    })
  })
}

/** Maps every node id in the tree to its path, so a warning can select its node. */
export function indexNodePaths(tree: SectionNode[]): Map<string, NodePath> {
  const map = new Map<string, NodePath>()
  visitAll(tree, [], ({ path, nodeId }) => map.set(nodeId, path))
  return map
}

/** Parses #rgb or #rrggbb. Anything else (var(), gradients, names) returns null. */
export function parseHex(value: unknown): [number, number, number] | null {
  if (typeof value !== 'string') return null
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  let hex = match[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}

function channelLuminance(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance. */
export function relativeLuminance(rgb: [number, number, number]): number {
  return 0.2126 * channelLuminance(rgb[0]) + 0.7152 * channelLuminance(rgb[1]) + 0.0722 * channelLuminance(rgb[2])
}

/** WCAG contrast ratio between two colours, from 1 to 21. */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Heading level from an element's tag prop (h1-h6). A heading element with no tag defaults to h2. */
function headingLevel(node: SectionNode): number | null {
  if (node.blockType !== 'element') return null
  const props = asRec(node.props)
  const tag = str(props.tag).toLowerCase()
  if (/^h[1-6]$/.test(tag)) return Number(tag.charAt(1))
  if (node.elementType === 'heading') return 2
  return null
}

export type Rgb = [number, number, number]
type Mode = 'light' | 'dark'

/** The site theme tokens (Shine) a colour field can name, per theme. Unknown names are not checked. */
export const THEME_TOKENS: Record<Mode, Record<string, string>> = {
  light: { '--sh-bg': '#ffffff', '--sh-surface': '#f8fafc', '--sh-text': '#0f172a', '--sh-text-muted': '#5f6e84', '--sh-border': '#e2e8f0', '--sh-primary': '#4f46e5', '--sh-on-primary': '#ffffff' },
  dark: { '--sh-bg': '#0b0f19', '--sh-surface': '#121826', '--sh-text': '#f1f5f9', '--sh-text-muted': '#94a3b8', '--sh-border': '#263042', '--sh-primary': '#4f46e5', '--sh-on-primary': '#ffffff' },
}

/** A colour value as RGB: plain hex, rgb(), white and black, or a theme token such as var(--sh-text) in the given theme. Otherwise null. */
export function resolveColor(value: unknown, mode: Mode = 'light'): Rgb | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  const hex = parseHex(v)
  if (hex) return hex
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)$/i.exec(v)
  if (rgb) return [Math.min(255, Number(rgb[1])), Math.min(255, Number(rgb[2])), Math.min(255, Number(rgb[3]))]
  if (/^white$/i.test(v)) return [255, 255, 255]
  if (/^black$/i.test(v)) return [0, 0, 0]
  const token = /^var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)$/.exec(v)
  if (token && THEME_TOKENS[mode][token[1]]) return parseHex(THEME_TOKENS[mode][token[1]])
  return null
}

const hexOf = (rgb: Rgb): string => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`

/** The better of black and white against a background, as a suggestion. */
function suggestText(background: Rgb, min: number): string {
  const black = contrastRatio([0, 0, 0], background)
  const white = contrastRatio([255, 255, 255], background)
  const best = black >= white ? { hex: '#000000', ratio: black } : { hex: '#ffffff', ratio: white }
  return best.ratio >= min ? `Try ${best.hex} text.` : 'Change the background colour as well.'
}

const MODES: Mode[] = ['light', 'dark']
const worse = <T extends { ratio: number }>(a: T | null, b: T): T => (!a || b.ratio < a.ratio ? b : a)

/** Worst contrast of a text colour against one or more backgrounds (a gradient has two stops), over both themes. */
function worstContrast(text: unknown, backgrounds: unknown[]): { ratio: number; background: Rgb } | null {
  let result: { ratio: number; background: Rgb } | null = null
  for (const mode of MODES) {
    const t = resolveColor(text, mode)
    if (!t) continue
    for (const raw of backgrounds) {
      const b = resolveColor(raw, mode)
      if (b) result = worse(result, { ratio: contrastRatio(t, b), background: b })
    }
  }
  return result
}

function contrastWarning(node: SectionNode): string | null {
  const design = readFlatDesign(node.design)
  const kind = design.bgType
  if (kind === 'gradient') {
    const stops = [design.bgGradientFrom, design.bgGradientTo].filter((x) => resolveColor(x) || resolveColor(x, 'dark'))
    const found = stops.length ? worstContrast(design.textColor, stops) : null
    if (!found || found.ratio >= MIN_CONTRAST) return null
    return `Low text contrast on the gradient (${found.ratio.toFixed(2)}:1 against its weakest stop, needs 4.5:1). ${suggestText(found.background, MIN_CONTRAST)}`
  }
  if (kind !== undefined && kind !== 'color') return null
  const found = worstContrast(design.textColor, [design.bgColor])
  if (!found || found.ratio >= MIN_CONTRAST) return null
  return `Low text contrast (${found.ratio.toFixed(2)}:1, needs 4.5:1). ${suggestText(found.background, MIN_CONTRAST)}`
}

/** Text over a picture, video or slideshow with no overlay: the colour cannot be sampled here, so it is a prompt to check. */
function pictureWarning(node: SectionNode): string | null {
  const design = readFlatDesign(node.design)
  if (design.bgType !== 'image' && design.bgType !== 'video' && design.bgType !== 'slideshow') return null
  if (!str(design.textColor)) return null
  const overlayOn = (design.overlayType === 'color' || design.overlayType === 'gradient') && Number(design.overlayOpacity ?? 1) >= 0.3
  if (overlayOn) return null
  return 'Text sits on a picture with no overlay, so its contrast cannot be checked. Add a dark or light overlay (30 percent or more) behind the text.'
}

/** Hover colours: the one not set falls back to the normal colour. Both resting and hover must reach 4.5:1. */
function hoverWarning(node: SectionNode): string | null {
  const design = readFlatDesign(node.design)
  if (!str(design.hoverBgColor) && !str(design.hoverTextColor)) return null
  if (design.bgType !== undefined && design.bgType !== 'color') return null
  const found = worstContrast(str(design.hoverTextColor) || design.textColor, [str(design.hoverBgColor) || design.bgColor])
  if (!found || found.ratio >= MIN_CONTRAST) return null
  return `Low text contrast on hover (${found.ratio.toFixed(2)}:1, needs 4.5:1). ${suggestText(found.background, MIN_CONTRAST)}`
}

/** The focus ring must be 3:1 against the block background (WCAG 1.4.11). Needs a plain background to compare with. */
function focusWarning(node: SectionNode): string | null {
  const design = readFlatDesign(node.design)
  if (!str(design.focusRing)) return null
  if (design.bgType !== undefined && design.bgType !== 'color') return null
  const found = worstContrast(design.focusRing, [design.bgColor])
  if (!found || found.ratio >= 3) return null
  return `Focus ring is hard to see (${found.ratio.toFixed(2)}:1, needs 3:1). ${suggestText(found.background, 3)}`
}

function heavyEffects(node: SectionNode): string[] {
  const design = readFlatDesign(node.design)
  const effects: string[] = []
  if (design.bgEffect === 'particles') effects.push('particles')
  if (typeof design.parallax === 'string' && design.parallax !== 'none') effects.push('parallax')
  if (typeof design.pointerFx === 'string' && design.pointerFx !== 'none') effects.push('pointer effect')
  if (typeof design.bgEffect === 'string' && ANIMATED_BG_EFFECTS.includes(design.bgEffect)) effects.push('animated background')
  if (typeof design.kenBurns === 'string' && design.kenBurns !== 'none') effects.push('Ken Burns')
  return effects
}

/** Label/URL pairs a CTA can carry: `primaryCtaLabel` -> `primaryCtaUrl`, `buttonText` -> `buttonUrl`. */
function ctaPairs(source: Rec): Array<{ url: string }> {
  const pairs: Array<{ url: string }> = []
  for (const [key, value] of Object.entries(source)) {
    if (!str(value)) continue
    if (key === 'buttonText') {
      pairs.push({ url: 'buttonUrl' })
      continue
    }
    const match = /^(.*)Label$/.exec(key)
    if (match) pairs.push({ url: `${match[1]}Url` })
  }
  return pairs
}

/** Reads a link value: a plain string, or the LinkField shape { url }. */
function linkValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  return str(asRec(value).url)
}

/** Buttons and CTAs that have a label but no link. Blank labels do not count. */
function emptyLinkCount(node: SectionNode): number {
  const props = node.blockType === 'element' ? asRec(node.props) : asRec(node)
  const pairs = ctaPairs(props)
  if (pairs.length > 0) return pairs.filter((pair) => !linkValue(props[pair.url])).length
  if (node.blockType === 'element' && /button|cta/i.test(str(node.elementType))) {
    const hasLabel = str(props.text) || str(props.label)
    const hasUrl = linkValue(props.link) || linkValue(props.url) || linkValue(props.href)
    if (hasLabel && !hasUrl) return 1
  }
  return 0
}

type ImageIssue = { kind: 'image-size' | 'image-alt'; message: string }

function imageIssues(node: SectionNode): ImageIssue[] {
  if (node.blockType !== 'element' || node.elementType !== 'image') return []
  const props = asRec(node.props)
  const issues: ImageIssue[] = []
  const size = [props.fileSize, props.sizeBytes].find((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (size !== undefined && size > MAX_IMAGE_BYTES) issues.push({ kind: 'image-size', message: 'Image is over 2 MB' })
  const hasSource = (props.image !== undefined && props.image !== null && props.image !== '') || Boolean(str(props.url))
  if (hasSource && !str(props.alt)) issues.push({ kind: 'image-alt', message: 'Image has no alt text' })
  return issues
}

/** Anchor ids that more than one block or column uses, with the block that owns each use. */
function duplicateAnchors(tree: SectionNode[]): Array<{ nodeId: string; anchor: string }> {
  const uses: Array<{ nodeId: string; anchor: string }> = []
  const note = (design: unknown, nodeId: string) => {
    const anchor = (design as { anchorId?: unknown } | undefined)?.anchorId
    if (typeof anchor === 'string' && anchor.trim()) uses.push({ nodeId, anchor: anchor.trim() })
  }
  visitAll(tree, [], ({ node, nodeId }) => {
    note(node.design, nodeId)
    node.columns?.forEach((column) => note(column.design, nodeId))
  })
  const counts = new Map<string, number>()
  for (const use of uses) counts.set(use.anchor, (counts.get(use.anchor) ?? 0) + 1)
  return uses.filter((use) => (counts.get(use.anchor) ?? 0) > 1)
}

/** Runs every design check over the page tree. Results are in document order. */
export function collectWarnings(tree: SectionNode[]): DesignWarning[] {
  const warnings: DesignWarning[] = []
  const add = (level: WarningLevel, nodeId: string, kind: string, message: string, index = 0) => {
    warnings.push({ id: `${kind}:${nodeId}:${index}`, level, nodeId, message })
  }

  let previousHeading: number | null = null

  const dupesByNode = new Map<string, string[]>()
  for (const { nodeId, anchor } of duplicateAnchors(tree)) {
    dupesByNode.set(nodeId, [...(dupesByNode.get(nodeId) ?? []), anchor])
  }

  visitAll(tree, [], ({ node, nodeId }) => {
    const dupAnchors = dupesByNode.get(nodeId) ?? []
    dupAnchors.forEach((anchor, index) => {
      add('warn', nodeId, 'dup-anchor', `Duplicate CSS ID “${anchor}”`, index)
    })

    const contrast = contrastWarning(node)
    if (contrast) add('warn', nodeId, 'contrast', contrast)
    const hover = hoverWarning(node)
    if (hover) add('warn', nodeId, 'contrast-hover', hover)
    const focus = focusWarning(node)
    if (focus) add('warn', nodeId, 'focus-ring', focus)
    const picture = pictureWarning(node)
    if (picture) add('info', nodeId, 'picture-text', picture)

    const level = headingLevel(node)
    if (level !== null) {
      if (previousHeading !== null && level > previousHeading + 1) {
        add('warn', nodeId, 'heading', `Heading jumps from h${previousHeading} to h${level}`)
      }
      previousHeading = level
    }

    for (const issue of imageIssues(node)) add('warn', nodeId, issue.kind, issue.message)

    const effects = heavyEffects(node)
    if (effects.length > MAX_HEAVY_EFFECTS) {
      add('info', nodeId, 'effects', `${effects.length} heavy effects on one block (${effects.join(', ')})`)
    }

    const empty = emptyLinkCount(node)
    for (let i = 0; i < empty; i += 1) {
      add('warn', nodeId, 'empty-link', 'Button or link has no URL', i)
    }
  })

  return warnings
}
