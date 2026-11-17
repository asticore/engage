'use client'

import { zipSync, strToU8 } from 'fflate'
import React, { useState } from 'react'

import { MAX_EXPORT_ASSETS, MAX_EXPORT_BYTES, assetFilePath, collectRefs, pageFilePath, rewriteRefs, sitemapPaths, siteRef, stripScripts } from '../staticExport'

/** Crawls the published pages in the browser (no sign-in sent, so only what visitors see) and downloads them as a zip of plain HTML, CSS and pictures. */
export const StaticExportPanel: React.FC = () => {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const run = async () => {
    setBusy(true)
    try {
      const origin = window.location.origin
      const get = (path: string) => fetch(path, { credentials: 'omit', cache: 'no-store' })

      setStatus('Reading the sitemap...')
      const sitemap = await get('/sitemap.xml').then((r) => (r.ok ? r.text() : '')).catch(() => '')
      const paths = sitemapPaths(sitemap, origin)
      if (!paths.includes('/')) paths.unshift('/')

      const pages = new Map<string, string>()
      const files: Record<string, Uint8Array> = {}
      const htmls = new Map<string, string>()
      let bytes = 0
      for (const [i, path] of paths.entries()) {
        setStatus(`Fetching page ${i + 1} of ${paths.length}: ${path}`)
        const res = await get(path).catch((): null => null)
        if (!res?.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) continue
        const html = await res.text()
        bytes += html.length
        pages.set(path.replace(/\/+$/, '') || '/', pageFilePath(path))
        htmls.set(path, stripScripts(html))
      }
      if (pages.size === 0) throw new Error('No published pages could be fetched.')

      // Assets: everything a page or a style sheet points at that is not itself a crawled page.
      const assets = new Map<string, string>()
      const cssTexts = new Map<string, string>()
      const queue: string[] = []
      const enqueue = (refs: string[]) => {
        for (const ref of refs) {
          const parsed = siteRef(ref, origin)
          if (!parsed || assets.has(ref) || queue.includes(ref)) continue
          if (pages.has(parsed.pathname.replace(/\/+$/, '') || '/')) continue
          if (/^\/(admin|api\/(?!media\/file))/.test(parsed.pathname)) continue
          queue.push(ref)
        }
      }
      for (const html of htmls.values()) enqueue(collectRefs(html, origin, 'html'))
      while (queue.length > 0 && assets.size < MAX_EXPORT_ASSETS && bytes < MAX_EXPORT_BYTES) {
        const ref = queue.shift() as string
        setStatus(`Fetching file ${assets.size + 1}: ${ref.slice(0, 60)}`)
        const res = await get(ref).catch((): null => null)
        if (!res?.ok) continue
        const type = res.headers.get('content-type') ?? ''
        const parsed = siteRef(ref, origin) as { pathname: string; search: string }
        const file = assetFilePath(parsed.pathname, parsed.search, type)
        assets.set(ref, file)
        if (type.includes('text/css')) {
          const css = await res.text()
          bytes += css.length
          cssTexts.set(file, css)
          enqueue(collectRefs(css, origin, 'css'))
        } else {
          const data = new Uint8Array(await res.arrayBuffer())
          bytes += data.length
          files[file] = data
        }
      }

      setStatus('Building the zip...')
      const map = { pages, assets }
      for (const [path, html] of htmls) {
        const file = pageFilePath(path)
        files[file] = strToU8(rewriteRefs(html, origin, file, map, 'html'))
      }
      for (const [file, css] of cssTexts) files[file] = strToU8(rewriteRefs(css, origin, file, map, 'css'))

      const blob = new Blob([zipSync(files) as BlobPart], { type: 'application/zip' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${window.location.hostname}-static-${new Date().toISOString().slice(0, 10)}.zip`
      link.click()
      URL.revokeObjectURL(link.href)
      setStatus(`Done: ${htmls.size} page(s) and ${assets.size} file(s) in the zip.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The export failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="demo-static">
      <h2 id="demo-static">Export as static HTML</h2>
      <p>Crawls the published pages in your browser, the way a visitor sees them, and downloads a zip of plain HTML, style sheets, fonts and pictures to host anywhere. Scripts are left out, so forms, the shop and other live features do not work in the copy.</p>
      <button type="button" disabled={busy} onClick={() => void run()}>Crawl the site and download the zip</button>
      {status && <p role="status">{status}</p>}
    </section>
  )
}
