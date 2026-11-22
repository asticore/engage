import type { SpamVerdict } from './spam'

/**
 * Akismet content check (Task 5, 21b). Optional: with no key nothing is called.
 * Fails open: an unreachable or erroring Akismet never blocks anyone.
 */
export type AkismetInput = {
  key: string
  site: string
  ip?: string
  userAgent?: string
  email?: string
  name?: string
  content: string
  type?: string
}

const HOST = /^[A-Za-z0-9]{6,32}$/

export async function checkAkismet(input: AkismetInput, fetcher: typeof fetch = fetch): Promise<SpamVerdict> {
  const key = input.key.trim()
  if (!key || !HOST.test(key) || !input.content.trim()) return { spam: false }
  const body = new URLSearchParams({ blog: input.site, comment_type: input.type || 'contact-form', comment_content: input.content.slice(0, 5000) })
  if (input.ip) body.set('user_ip', input.ip)
  if (input.userAgent) body.set('user_agent', input.userAgent)
  if (input.email) body.set('comment_author_email', input.email)
  if (input.name) body.set('comment_author', input.name)
  try {
    const response = await fetcher(`https://${key}.rest.akismet.com/1.1/comment-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Engage/1.0 | Akismet' },
      body,
    })
    const text = (await response.text()).trim()
    return text === 'true' ? { spam: true, reason: 'rules', detail: 'akismet' } : { spam: false }
  } catch {
    return { spam: false }
  }
}
