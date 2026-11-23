import { getElementDef } from '@/lib/elements/registry'
import { paragraph } from '@/lib/elements/wave26Defs'
import type { SectionNode } from '@/lib/sectionTree'

import type { SiteTemplateKind } from '@/collections/SiteTemplates'

export type TemplateStarter = {
  id: string
  kind: SiteTemplateKind
  label: string
  description: string
  /** The template's `blocks` value: a list of section nodes, built only from registered elements. */
  blocks: () => SectionNode[]
  /** Display rules the draft starts with (default none: everywhere for its type). */
  conditions?: () => unknown[]
}

/** An `element` node built from the element's own defaults with a few props overridden. */
const el = (elementType: string, props: Record<string, unknown> = {}): SectionNode => ({
  blockType: 'element',
  elementType,
  props: { ...(getElementDef(elementType)?.defaultProps() || {}), ...props },
})

const section = (blocks: SectionNode[], design?: Record<string, unknown>): SectionNode => ({
  blockType: 'section',
  ...(design ? { design } : {}),
  columns: [{ width: 12, blocks }],
})

const heading = (text: string, tag = 'h1') => el('heading', { text, tag, align: 'center' })
const copy = (text: string) => el('text-editor', { align: 'center', content: paragraph(text) })

export const STARTERS: TemplateStarter[] = [
  {
    id: 'single-post-classic',
    kind: 'single-post',
    label: 'Classic post',
    description: 'Breadcrumbs, title, meta, featured image, then the post content.',
    blocks: () => [
      section([el('auto-breadcrumbs'), el('post-title', { level: 'h1' }), el('post-meta'), el('post-featured-image'), el('content-slot')]),
    ],
  },
  {
    id: 'single-post-minimal',
    kind: 'single-post',
    label: 'Minimal post',
    description: 'Title and content only.',
    blocks: () => [section([el('post-title', { level: 'h1' }), el('content-slot')])],
  },
  {
    id: 'loop-blog-card',
    kind: 'loop',
    label: 'Blog card',
    description: 'For the Loop grid: featured picture, title, meta and excerpt of each post.',
    blocks: () => [section([el('post-featured-image'), el('post-title', { level: 'h3' }), el('post-meta'), el('post-excerpt')])],
  },
  {
    id: 'loop-product-card',
    kind: 'loop',
    label: 'Product card',
    description: 'For the Loop grid: picture, title and price of each product.',
    blocks: () => [section([el('post-featured-image'), el('post-title', { level: 'h3' }), el('product-price')])],
  },
  {
    id: 'single-product-classic',
    kind: 'single-product',
    label: 'Classic product',
    description: 'Breadcrumbs, title, price, then the product content.',
    blocks: () => [section([el('auto-breadcrumbs'), el('post-title', { level: 'h1' }), el('product-price'), el('content-slot')])],
  },
  {
    id: 'single-event-classic',
    kind: 'single-event',
    label: 'Classic event',
    description: 'Breadcrumbs, title, featured image, then the event content.',
    blocks: () => [section([el('auto-breadcrumbs'), el('post-title', { level: 'h1' }), el('post-featured-image'), el('content-slot')])],
  },
  {
    id: 'archive-blog-simple',
    kind: 'archive-blog',
    label: 'Blog archive',
    description: 'A heading above the list of posts.',
    blocks: () => [section([heading('Blog')]), section([el('content-slot')])],
  },
  {
    id: 'archive-shop-simple',
    kind: 'archive-shop',
    label: 'Shop archive',
    description: 'A heading above the product list.',
    blocks: () => [section([heading('Shop')]), section([el('content-slot')])],
  },
  {
    id: 'search-results-simple',
    kind: 'search-results',
    label: 'Search results',
    description: 'A heading above the search form and results.',
    blocks: () => [section([heading('Search')]), section([el('content-slot')])],
  },
  {
    id: 'archive-category-simple',
    kind: 'archive-category',
    label: 'Category archive',
    description: 'A heading above the category post list.',
    blocks: () => [section([heading('Category')]), section([el('content-slot')])],
  },
  {
    id: 'archive-tag-simple',
    kind: 'archive-tag',
    label: 'Tag archive',
    description: 'A heading above the tagged post list.',
    blocks: () => [section([heading('Tag')]), section([el('content-slot')])],
  },
  {
    id: 'archive-author-simple',
    kind: 'archive-author',
    label: 'Author archive',
    description: 'A heading above the author post list.',
    blocks: () => [section([heading('Author')]), section([el('content-slot')])],
  },
  {
    id: 'not-found-friendly',
    kind: 'not-found',
    label: 'Friendly 404',
    description: 'A heading, a short message and a button home.',
    blocks: () => [
      section([heading('Page not found'), copy('Sorry, we could not find that page. It may have moved or no longer exists.'), el('button', { text: 'Back to home', url: '/', variant: 'primary', align: 'center' })]),
    ],
  },
  {
    id: 'coming-soon-countdown',
    kind: 'coming-soon',
    label: 'Countdown and signup',
    description: 'A heading, a short message, a countdown to the launch date and the email signup.',
    blocks: () => [
      section([
        heading("We're launching soon"),
        copy('Something new is on its way. Leave your email and we will tell you the moment we open.'),
        // No date on purpose: a Countdown with a blank date counts down to the launch date set under Site pages and maintenance.
        el('countdown', { target: '', expiredText: 'We are open.' }),
        el('coming-soon-signup'),
      ]),
    ],
  },
  {
    id: 'maintenance-simple',
    kind: 'maintenance',
    label: 'Back soon',
    description: 'A heading and a short message.',
    blocks: () => [section([heading("We'll be back soon"), copy('We are making a few improvements. Please check back shortly.')])],
  },
  {
    id: 'header-logo-menu',
    kind: 'header',
    label: 'Logo and menu',
    description: 'Site logo on the left, main menu on the right.',
    blocks: () => [
      {
        blockType: 'section',
        columns: [
          { width: 4, blocks: [el('site-logo')] },
          { width: 8, blocks: [el('nav-menu')] },
        ],
      },
    ],
  },
  {
    id: 'header-responsive',
    kind: 'header',
    label: 'Desktop and mobile header',
    description: 'A full desktop header (logo, menu, search, social icons) and a separate mobile header with a menu button and off-canvas panel.',
    blocks: () => [
      {
        blockType: 'section',
        design: { hideOnMobile: true },
        columns: [
          { width: 3, blocks: [el('site-logo')] },
          { width: 6, blocks: [el('nav-menu')] },
          { width: 3, blocks: [el('search-box'), el('social-icons')] },
        ],
      },
      {
        blockType: 'section',
        design: { hideOnDesktop: true },
        columns: [
          { width: 6, blocks: [el('site-logo', { width: 120 })] },
          { width: 6, blocks: [el('nav-menu', { mobileBreakpoint: '1024', mobileStyle: 'offcanvas', sticky: true })] },
        ],
      },
    ],
  },
  {
    id: 'header-members',
    kind: 'header',
    label: 'Members-only header',
    description: 'Logo, menu and an account button. Shows to signed in members only; guests keep the other header.',
    conditions: () => [[{ param: 'audience', operator: 'equals', value: 'members' }]],
    blocks: () => [
      {
        blockType: 'section',
        columns: [
          { width: 3, blocks: [el('site-logo')] },
          { width: 6, blocks: [el('nav-menu')] },
          { width: 3, blocks: [el('button', { text: 'My account', url: '/account', variant: 'primary', align: 'right' })] },
        ],
      },
    ],
  },
  {
    id: 'footer-columns',
    kind: 'footer',
    label: 'Columns with socials',
    description: 'Logo and note, the menu, social icons and a copyright line.',
    blocks: () => [
      {
        blockType: 'section',
        columns: [
          { width: 4, blocks: [el('site-logo', { width: 120 }), copy('Thanks for visiting.')] },
          { width: 4, blocks: [el('nav-menu', { layout: 'vertical' })] },
          { width: 4, blocks: [el('social-icons')] },
        ],
      },
      section([copy('© Your site. All rights reserved.')]),
    ],
  },
  {
    id: 'footer-text-menu',
    kind: 'footer',
    label: 'Text and menu',
    description: 'A short line of text above the menu.',
    blocks: () => [section([copy('Thanks for visiting.'), el('nav-menu')])],
  },
  {
    id: 'sidebar-left-menu',
    kind: 'sidebar-left',
    label: 'Menu',
    description: 'A heading above the main menu, for a left sidebar.',
    blocks: () => [section([heading('Menu', 'h2'), el('nav-menu')])],
  },
  {
    id: 'sidebar-right-text',
    kind: 'sidebar-right',
    label: 'Text',
    description: 'A heading and a short line of text, for a right sidebar.',
    blocks: () => [section([heading('About us', 'h2'), copy('Add a short note or links here.')])],
  },
]

export const getStarter = (id: unknown): TemplateStarter | undefined => STARTERS.find((s) => s.id === id)
