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
  titleKey: UiStringKey
  bodyKey: UiStringKey
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
