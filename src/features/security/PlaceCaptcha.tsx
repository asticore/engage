'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { AuthCaptcha } from './AuthCaptcha'
import type { PublicCaptcha } from './authCaptcha'
import type { PlaceId } from './captchaPlaces'

/**
 * Draws the CAPTCHA inside a form when the place asks for it, and fills the hidden token field the server checks.
 * Asks the server on load and again after every submit (server action forms) or whenever `refreshKey` changes (forms
 * that post JSON), so a place set to "only after repeated failures" starts showing the widget after the failure that
 * switches it on, and a used token is always replaced by a fresh one.
 */
export const PlaceCaptcha: React.FC<{ place: PlaceId; refreshKey?: unknown }> = ({ place, refreshKey }) => {
  const [config, setConfig] = useState<PublicCaptcha | null>(null)
  const [round, setRound] = useState(0)
  const [tick, setTick] = useState(0)
  const { pending } = useFormStatus()
  const wasPending = useRef(false)

  // A server action form has just finished: ask again.
  useEffect(() => {
    if (wasPending.current && !pending) setTick((n) => n + 1)
    wasPending.current = pending
  }, [pending])

  useEffect(() => {
    let live = true
    void fetch(`/api/captcha-config?place=${encodeURIComponent(place)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ captcha: PublicCaptcha | null }>) : null))
      .then((body) => {
        if (!live) return
        setConfig(body?.captcha ?? null)
        setRound((n) => n + 1)
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
  }, [place, refreshKey, tick])

  return config ? <AuthCaptcha key={round} provider={config.provider} siteKey={config.siteKey} appearance={config.appearance} fallback={config.fallback ?? null} /> : null
}
