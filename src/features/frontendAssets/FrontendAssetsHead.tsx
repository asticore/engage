import React from 'react'

import { SHINE_CSS_FALLBACK, SHINE_CSS_URL } from './builtin'
import { assetsFor, type FrontendAsset } from './config'
import { readFrontendAssets } from './store'

/**
 * Shine from its GitHub release, with the bundled copy as a fallback. The one-line script right after the link
 * swaps the address when the CDN cannot be reached or the integrity check fails (the error event is queued, so
 * the listener attached here is in time). With scripts blocked the CDN copy is simply used.
 */
export function ShineLink(): React.ReactElement {
  const swap = `(function(l){l.addEventListener('error',function(){if(l.dataset.fb)return;l.dataset.fb='1';l.removeAttribute('integrity');l.href=l.dataset.fallback})})(document.currentScript.previousElementSibling)`
  return (
    <>
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
      <link rel="stylesheet" href={SHINE_CSS_URL} crossOrigin="anonymous" data-fallback={SHINE_CSS_FALLBACK} />
      <script dangerouslySetInnerHTML={{ __html: swap }} />
    </>
  )
}

const scriptProps = (a: FrontendAsset) => ({
  src: a.url,
  defer: a.defer || undefined,
  async: a.async || undefined,
  ...(a.integrity ? { integrity: a.integrity } : {}),
  crossOrigin: 'anonymous' as const,
})

/** The owner's extra stylesheets and head scripts (Settings, Frontend files). Renders nothing when none apply. */
export async function FrontendAssetsHead({ portal }: { portal: boolean }) {
  const { css, headScripts } = assetsFor(await readFrontendAssets(), portal)
  if (!css.length && !headScripts.length) return null
  return (
    <>
      {css.map((a) => (
        <link key={a.id} rel="stylesheet" href={a.url} crossOrigin="anonymous" {...(a.integrity ? { integrity: a.integrity } : {})} />
      ))}
      {headScripts.map((a) => (
        <script key={a.id} {...scriptProps(a)} />
      ))}
    </>
  )
}

/** The owner's scripts that go at the end of the body. */
export async function FrontendAssetsBody({ portal }: { portal: boolean }) {
  const { bodyScripts } = assetsFor(await readFrontendAssets(), portal)
  if (!bodyScripts.length) return null
  return (
    <>
      {bodyScripts.map((a) => (
        <script key={a.id} {...scriptProps(a)} />
      ))}
    </>
  )
}
