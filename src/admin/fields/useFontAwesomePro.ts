'use client'

import { useEffect, useState } from 'react'

import { EMPTY_FONT_AWESOME, fontAwesomeTag, type FontAwesomeConfig } from '@/features/frontendAssets/fontAwesome'

let cached: FontAwesomeConfig | null = null
let pending: Promise<FontAwesomeConfig> | null = null

/** Reads the site's Font Awesome Pro setting once (admin only; any failure means free icons only). */
function load(): Promise<FontAwesomeConfig> {
  if (cached) return Promise.resolve(cached)
  pending ??= fetch('/api/admin-frontend-assets')
    .then((r) => (r.ok ? (r.json() as Promise<{ config?: { fontAwesome?: FontAwesomeConfig } }>) : null))
    .then((data) => (cached = data?.config?.fontAwesome ?? EMPTY_FONT_AWESOME))
    .catch((): FontAwesomeConfig => EMPTY_FONT_AWESOME)
  return pending
}

/** The Pro setting for the picker, and a preview tag in the page so the Pro glyphs render while choosing. */
export function useFontAwesomePro(): FontAwesomeConfig {
  const [config, setConfig] = useState<FontAwesomeConfig>(cached ?? EMPTY_FONT_AWESOME)
  useEffect(() => {
    let live = true
    void load().then((c) => live && setConfig(c))
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    const tag = fontAwesomeTag(config)
    if (!tag || document.querySelector('[data-eg-fa-pro]')) return
    const el = tag.kind === 'js' ? document.createElement('script') : document.createElement('link')
    if (el instanceof HTMLScriptElement) el.src = tag.url
    else {
      el.rel = 'stylesheet'
      el.href = tag.url
    }
    el.crossOrigin = 'anonymous'
    el.setAttribute('data-eg-fa-pro', '1')
    document.head.appendChild(el)
  }, [config])
  return config
}
