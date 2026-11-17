'use client'

import { useEffect } from 'react'

/**
 * Starts Spark (asticore/spark, see reference/references.json) only on pages that use a `spark-` class. The loader then
 * fetches just the features the page needs. Falls back to the copy vendored in `public/vendor/spark/` when the CDN is
 * unreachable, and fails safe (page simply not animated) if both fail.
 * Disabled in the visual editor canvas by `data-spark-skip` on the editor root, so editing never runs effects.
 * Content saved before the Effix to Spark rename carries `efx-` classes and `data-efx-*` attributes; they are rewritten
 * on the page before start so old pages keep working.
 */
export const SPARK_BASE = 'https://cdn.jsdelivr.net/gh/asticore/spark@dc0d630e97cfbb973357be9e2067401cc732c46f/dist/'
export const SPARK_FALLBACK_BASE = '/vendor/spark/'

/** Rewrites pre-rename `efx-` classes and `data-efx-*` attributes to the Spark names. */
function upgradeLegacyEffects(): void {
  document.querySelectorAll('[class*="efx-"]').forEach((el) => {
    el.className = el.className.replace(/(^|\s)efx-/g, '$1spark-')
  })
  document.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('data-efx-')) {
        el.setAttribute(`data-spark-${attr.name.slice('data-efx-'.length)}`, attr.value)
        el.removeAttribute(attr.name)
      }
    }
  })
}

function start(base: string, onError?: () => void): void {
  const script = document.createElement('script')
  script.id = 'spark-auto'
  script.src = `${base}spark.auto.min.js`
  script.defer = true
  script.dataset.sparkBase = base
  script.onerror = () => {
    script.remove()
    onError?.()
  }
  document.body.appendChild(script)
}

export function SparkLoader(): null {
  useEffect(() => {
    if (document.getElementById('spark-auto')) return
    if (!document.querySelector('[class*="efx-"], [class*="spark-"]')) return
    upgradeLegacyEffects()
    start(SPARK_BASE, () => start(SPARK_FALLBACK_BASE))
  }, [])
  return null
}

export default SparkLoader
