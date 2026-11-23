/**
 * The admin walkthrough: its steps and the rule for when it starts by itself.
 *
 * Pure module (no React, no engine) so the client tour, the server layout and
 * the tests all share one definition.
 *
 * Once-per-account rule: the tour starts by itself only when the signed-in
 * user has NO stored tour preference at all. Finishing, skipping or closing it
 * stores one, so it never starts by itself again, on any browser or device.
 * `version` only records the data shape; a newer TOUR_VERSION never re-shows it.
 */

import type { UiStringKey } from '@/features/uiStrings/keys'

export const TOUR_VERSION = 1

/** Preference key under `eg_preferences` (one row per user). */
export const ADMIN_TOUR_PREF_KEY = 'admin-tour'

export type TourStatus = 'completed' | 'skipped'

export type TourPref = { version: number; status: TourStatus; at: string }

export type TourStep = {
  id: string
  /** CSS selector of the element to point at, or null for a centred card. */
  target: string | null
  titleKey?: UiStringKey
  bodyKey?: UiStringKey
  /** Plain English text for steps that have no translation key (the theme guide). */
  title?: string
  body?: string
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'welcome', target: null, titleKey: 'tour.welcome.title', bodyKey: 'tour.welcome.body' },
  { id: 'sidebar', target: '.nav__wrap', titleKey: 'tour.sidebar.title', bodyKey: 'tour.sidebar.body' },
  { id: 'pages', target: '#nav-pages', titleKey: 'tour.pages.title', bodyKey: 'tour.pages.body' },
  { id: 'visualEditor', target: '#nav-pages', titleKey: 'tour.visualEditor.title', bodyKey: 'tour.visualEditor.body' },
  { id: 'templates', target: '#nav-view-templates', titleKey: 'tour.templates.title', bodyKey: 'tour.templates.body' },
  { id: 'settings', target: '#nav-view-all-settings', titleKey: 'tour.settings.title', bodyKey: 'tour.settings.body' },
  { id: 'features', target: '#nav-view-all-settings', titleKey: 'tour.features.title', bodyKey: 'tour.features.body' },
  { id: 'done', target: null, titleKey: 'tour.done.title', bodyKey: 'tour.done.body' },
]

/** Window event that starts the theme guide (the Theme guide button on the theme page). */
export const THEME_TOUR_START_EVENT = 'theme-tour:start'

/** The theme guide: pick a theme, set colours, upload the logo, choose header and footer, preview, publish. */
export const THEME_TOUR_STEPS: readonly TourStep[] = [
  { id: 'theme-welcome', target: null, title: 'Make it look like you', body: 'Six quick steps: pick a theme, set your colours, add your logo, choose a header and footer, check the preview, and publish a homepage that uses it.' },
  { id: 'theme-pick', target: '#ts-tab-presets', title: '1. Pick a theme', body: 'Start from a preset, or choose the styles you like and generate one. Nothing is saved until you choose Save changes.' },
  { id: 'theme-colours', target: '#ts-tab-colours', title: '2. Set your colours', body: 'Change any colour, with a separate value for dark mode. Pages that use a colour from the theme follow it everywhere.' },
  { id: 'theme-logo', target: '.ts-tabs', title: '3. Upload your logo', body: 'Your logo and site name live in Settings, General. Upload it there; the header picks it up. You can come back to this guide any time.' },
  { id: 'theme-chrome', target: '[aria-label="Edit templates in the visual builder"]', title: '4. Choose a header and footer', body: 'Open the Header and Footer here. Each one is edited in the visual builder, with a separate layout for mobile and desktop.' },
  { id: 'theme-preview', target: '.ts-aside', title: '5. Check the preview', body: 'Tick Show a sample homepage to see a header, hero, cards, a form, a shop card and a footer in your theme as you change it.' },
  { id: 'theme-done', target: null, title: '6. Publish your homepage', body: 'Save changes, then open Pages, edit your homepage and set it to Published. It now uses your theme.' },
]

/** Reads a stored value into a TourPref, or null when it is not one. */
export function parseTourPref(value: unknown): TourPref | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as { version?: unknown; status?: unknown; at?: unknown }
  if (raw.status !== 'completed' && raw.status !== 'skipped') return null
  return {
    version: typeof raw.version === 'number' ? raw.version : TOUR_VERSION,
    status: raw.status,
    at: typeof raw.at === 'string' ? raw.at : '',
  }
}

/** True only when this user has never seen the tour. Any stored value means seen, whatever its version. */
export function shouldAutoStart(pref: unknown): boolean {
  return parseTourPref(pref) === null
}

export function buildTourPref(status: TourStatus, now: Date = new Date()): TourPref {
  return { version: TOUR_VERSION, status, at: now.toISOString() }
}

/** Window event that starts the tour on demand (the Help button). */
export const ADMIN_TOUR_START_EVENT = 'admin-tour:start'

/** Routes where the tour must not start by itself (sign-in, two-factor, password steps, the full-screen visual editor). */
export const TOUR_BLOCKED_PATH = /\/(visual-editor|login|logout|two-factor|2fa|forgot|reset|change-password|create-first-user)(\/|$)/
