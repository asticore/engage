/**
 * Video URL parsing for the `video` element and the SEO structured data. Pure:
 * no imports, so the server-side SEO code can use it without pulling in the
 * element components.
 */

export type VideoSource = { kind: 'youtube' | 'vimeo' | 'file'; src: string }

/** Turns a pasted video URL into a safe embed source. YouTube uses the no-cookie host, Vimeo gets do-not-track. */
export function parseVideoUrl(raw: unknown): VideoSource | null {
  const text = (typeof raw === 'string' ? raw : '').trim()
  if (!text) return null
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
  const idOk = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null)
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    let id: string | null = null
    if (host === 'youtu.be') id = idOk(url.pathname.slice(1).split('/')[0])
    else if (url.pathname === '/watch') id = idOk(url.searchParams.get('v'))
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)
      id = idOk(m?.[1])
    }
    return id ? { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` } : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = url.pathname.match(/(?:^|\/)(\d{5,12})(?:\/|$)/)
    return m ? { kind: 'vimeo', src: `https://player.vimeo.com/video/${m[1]}?dnt=1` } : null
  }
  if (/\.(mp4|webm|ogv|ogg)$/i.test(url.pathname)) return { kind: 'file', src: url.toString() }
  return null
}
