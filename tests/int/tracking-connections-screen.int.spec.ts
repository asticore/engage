/**
 * The Tracking connections screen, rendered without the network. Checks the
 * three cards, the redirect addresses, that only admins see the app-secret field,
 * the Connect links, and the notice the callback leaves in the address.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement as h } from 'react'

import type { GoogleConnectionStatus } from '@/features/google/status'
import type { TrackingConnectionStatus } from '@/features/tracking/connect/status'

let search = ''
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search) }))

const { TrackingConnectionsClient } = await import('@/admin/views/TrackingConnectionsClient')

const emptyProvider = { appId: '', hasAppSecret: false, connected: false, accountName: '', connectedAt: '', expiresAt: '', error: '', currentPixelId: '' }

const status: TrackingConnectionStatus = {
  meta: { ...emptyProvider, appId: '1234567890', hasAppSecret: true },
  tiktok: { ...emptyProvider },
}

const google: GoogleConnectionStatus = {
  clientId: '123456789012-abcdefgh.apps.googleusercontent.com',
  hasClientSecret: true,
  connected: false,
  connectedEmail: '',
  connectedAt: '',
  scopesGranted: '',
  ga4PropertyId: '',
  ga4MeasurementId: '',
  searchConsoleSite: '',
  gtmAccountId: '',
  gtmContainerId: '',
  adsenseAccountId: '',
  adsensePublisherId: '',
  lastError: '',
}

const redirectUris = {
  meta: 'https://shop.example.com/api/tracking-connect/meta/callback',
  tiktok: 'https://shop.example.com/api/tracking-connect/tiktok/callback',
  google: 'https://shop.example.com/api/google/callback',
}

function screenFor(props: { isAdmin: boolean; status?: TrackingConnectionStatus; engageSecretSet?: boolean }) {
  return h(TrackingConnectionsClient, { status: props.status ?? status, google, redirectUris, isAdmin: props.isAdmin, engageSecretSet: props.engageSecretSet ?? true, versions: {} })
}

afterEach(() => {
  cleanup()
  search = ''
})

describe('Tracking connections screen', () => {
  it('shows the Google, Meta and TikTok cards with their redirect addresses', () => {
    render(screenFor({ isAdmin: true }))
    // Each platform name appears once in the setup checklist and once as its card title.
    expect(screen.getAllByText('Google (Analytics and Tag Manager)').length).toBe(2)
    expect(screen.getAllByText('Meta (Facebook and Instagram pixel)').length).toBe(2)
    expect(screen.getAllByText('TikTok (TikTok Ads pixel)').length).toBe(2)
    expect(screen.getByText(redirectUris.meta)).toBeTruthy()
    expect(screen.getByText(redirectUris.tiktok)).toBeTruthy()
    expect(screen.getByText(redirectUris.google)).toBeTruthy()
  })

  it('shows the app secret field to administrators only', () => {
    const { unmount } = render(screenFor({ isAdmin: true }))
    expect(screen.getAllByLabelText('App secret').length).toBe(2)
    unmount()
    render(screenFor({ isAdmin: false }))
    expect(screen.queryByLabelText('App secret')).toBeNull()
    expect(screen.getAllByLabelText('App ID').length).toBe(2)
  })

  it('offers Connect with Facebook as a link to the start route once the app is saved', () => {
    render(screenFor({ isAdmin: true }))
    const link = screen.getByText('Connect with Facebook', { selector: 'a' })
    expect(link.getAttribute('href')).toBe('/api/tracking-connect/meta/start')
  })

  it('links Google to the existing sign-in with a return to this screen', () => {
    render(screenFor({ isAdmin: true }))
    const link = screen.getByText('Connect with Google', { selector: 'a' })
    expect(link.getAttribute('href')).toBe('/api/google/connect?return=tracking')
  })

  it('shows a setup status for Google, Meta and TikTok with Done or Missing for each piece', () => {
    const { container } = render(screenFor({ isAdmin: true }))
    expect(screen.getByText('Setup status')).toBeTruthy()
    // Meta has its app ID and secret saved; TikTok has nothing saved yet.
    const metaItems = screen.getAllByText('Meta (Facebook and Instagram pixel)')[0].closest('.google-connection__row')!
    expect(metaItems.textContent).toContain('App ID saved: Done')
    expect(metaItems.textContent).toContain('App secret saved: Done')
    expect(metaItems.textContent).toContain('Signed in: Missing')
    const tiktokItems = screen.getAllByText('TikTok (TikTok Ads pixel)')[0].closest('.google-connection__row')!
    expect(tiktokItems.textContent).toContain('App ID saved: Missing')
    expect(tiktokItems.textContent).toContain('App secret saved: Missing')
    expect(container.textContent).toContain('ENGAGE_SECRET set on the server: Done')
  })

  it('warns when ENGAGE_SECRET is not set, without showing any value', () => {
    const { container } = render(screenFor({ isAdmin: true, engageSecretSet: false }))
    expect(container.textContent?.split('ENGAGE_SECRET set on the server: Missing').length).toBe(4)
    expect(screen.getByText(/ENGAGE_SECRET is not set on the server/)).toBeTruthy()
  })

  it('turns the callback notice in the address into a plain sentence', () => {
    search = 'notice=meta-connected'
    render(screenFor({ isAdmin: true }))
    expect(screen.getByText('Facebook is connected. Now choose the pixel below.')).toBeTruthy()
  })

  it('explains a lapsed Meta token instead of a generic refusal', () => {
    search = 'notice=meta-state'
    render(screenFor({ isAdmin: true }))
    expect(screen.getByText('The sign-in could not be checked, so it was stopped for safety. Start it again.')).toBeTruthy()
  })
})
