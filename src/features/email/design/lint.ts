/**
 * Warnings about a design that are not errors: things that hurt accessibility,
 * deliverability or clarity. The admin page shows them; saving is still allowed.
 */

import { DEFAULT_EMAIL_BRAND, type EmailBrand } from './brand'
import { splitInline } from './inline'
import { renderEmailHtml } from './render'
import type { ColumnBlock, EmailBlock } from './types'

export type EmailLintWarning = {
  code: 'empty' | 'image-no-alt' | 'vague-link' | 'no-footer' | 'too-heavy' | 'low-contrast' | 'dark-pure' | 'dark-logo' | 'dark-link'
  message: string
}

export type LintOptions = {
  /** Marketing email needs a footer with a way to stop receiving it. */
  marketing?: boolean
  /** The brand in use, so a footer set there counts. */
  brand?: EmailBrand
}

/** Gmail clips HTML emails above roughly 102 KB, so warn well before that. */
const MAX_BYTES = 100 * 1024

const VAGUE = /^(click here|here|link|this link|read more|more|click)$/i

/** WCAG relative luminance of a #rrggbb colour. Anything that is not six hex digits counts as mid grey. */
const luminance = (hex: string): number => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0.2
  const channel = (i: number) => {
    const v = parseInt(m[1].slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
}

export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** The page colour many mail apps draw behind an email in dark mode (close to #1d1d1f). */
const DARK_PAGE = '#1d1d1f'

const everyBlock = (blocks: EmailBlock[]): (EmailBlock | ColumnBlock)[] => {
  const list: (EmailBlock | ColumnBlock)[] = []
  for (const block of blocks) {
    list.push(block)
    if (block.type === 'columns2') list.push(...block.left, ...block.right)
  }
  return list
}

const vagueLinkIn = (text: string): boolean =>
  splitInline(text).some((part) => part.kind === 'link' && VAGUE.test(part.label.trim()))

export const lintEmail = (blocks: EmailBlock[], options: LintOptions = {}): EmailLintWarning[] => {
  const warnings: EmailLintWarning[] = []
  const brand = options.brand ?? DEFAULT_EMAIL_BRAND
  const all = everyBlock(blocks)

  if (blocks.length === 0) {
    warnings.push({ code: 'empty', message: 'The design is empty. Add a block to see the email.' })
    return warnings
  }

  for (const block of all) {
    if (block.type === 'image' && block.alt.trim() === '') {
      warnings.push({ code: 'image-no-alt', message: 'An image has no description. Add one so people who cannot see images know what it shows.' })
    }
    if (block.type === 'button' && VAGUE.test(block.label.trim())) {
      warnings.push({ code: 'vague-link', message: `The button "${block.label}" does not say where it goes. Use a label such as "View your order".` })
    }
    if (block.type === 'text' && vagueLinkIn(block.text)) {
      warnings.push({ code: 'vague-link', message: 'A link says "click here" or similar. Use the words that describe the page instead.' })
    }
  }

  // Colour checks: readable on the panel, and safe when a mail app switches to dark mode on its own.
  if (contrastRatio(brand.textColor, brand.contentBackground) < 4.5) {
    warnings.push({ code: 'low-contrast', message: 'The text colour is hard to read on the panel colour. Pick colours with more contrast (aim for a ratio of at least 4.5).' })
  }
  const pure = /^#(000000|ffffff)$/i.test(brand.textColor.trim()) || [brand.contentBackground, brand.background].some((c) => /^#000000$/i.test(c.trim()))
  if (pure) {
    warnings.push({ code: 'dark-pure', message: 'Pure black text, or a pure black panel, is used. Mail apps in dark mode swap these and the result can be harsh or unreadable. Use a near black such as #222222 for text and a near white such as #f7f7f7 for panels.' })
  }
  if (brand.logoUrl && brand.logoUrl.trim() !== '') {
    warnings.push({ code: 'dark-logo', message: 'In dark mode a dark or see-through logo can disappear against the dark page. Check the preview in Dark, or use a logo with a light edge.' })
  }
  const hasTextLink = all.some((block) => block.type === 'text' && splitInline(block.text).some((part) => part.kind === 'link'))
  if (hasTextLink && contrastRatio(brand.accent, DARK_PAGE) < 3) {
    warnings.push({ code: 'dark-link', message: 'Links use the accent colour, which is dim on a dark page. Pick a lighter accent so links stay visible in dark mode.' })
  }

  const hasFooter = blocks.some((block) => block.type === 'footerNote') || brand.footerText.trim() !== ''
  if (options.marketing && !hasFooter) {
    warnings.push({
      code: 'no-footer',
      message: 'Marketing email should end with a footer that says why the reader got it and how to stop receiving it.',
    })
  }

  const bytes = new TextEncoder().encode(renderEmailHtml(blocks, brand)).length
  if (bytes > MAX_BYTES) {
    warnings.push({
      code: 'too-heavy',
      message: `This email is about ${Math.round(bytes / 1024)} KB. Mail apps may cut off emails over about 100 KB, so use fewer or smaller images.`,
    })
  }

  return warnings
}
