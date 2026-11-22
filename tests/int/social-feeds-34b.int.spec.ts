import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SocialFeedView } from '@/components/blocks/elements/Wave67Server'
import { ADAPTERS, embedPosts, fetchPosts, needsToken } from '@/features/socialFeeds/adapters'
import { moderatePosts } from '@/features/socialFeeds/moderate'
import { ttlFor } from '@/features/socialFeeds/service'
import type { SocialAccount, SocialPost } from '@/features/socialFeeds/types'

const post = (id: string, caption = '', extra: Partial<SocialPost> = {}): SocialPost => ({ id, url: `https://x.test/${id}`, imageUrl: `https://img.test/${id}.jpg`, caption, date: '2026-01-02T00:00:00Z', likes: 3, video: false, ...extra })
const acct = (provider: SocialAccount['provider'], accountId: string, token = 'tok'): SocialAccount => ({ id: 'a', provider, label: 'l', accountId, token })
const json = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 })

describe('moderation', () => {
  const posts = [post('a', 'Hello #sale'), post('b', 'News'), post('c', 'Spam word')]
  it('hides, filters and pins', () => {
    expect(moderatePosts(posts, { hide: 'https://x.test/b' }).map((p) => p.id)).toEqual(['a', 'c'])
    expect(moderatePosts(posts, { include: '#sale' }).map((p) => p.id)).toEqual(['a'])
    expect(moderatePosts(posts, { exclude: 'spam' }).map((p) => p.id)).toEqual(['a', 'b'])
    expect(moderatePosts(posts, { pin: 'c' }).map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('new providers', () => {
  it('parses Vimeo', async () => {
    const r = await fetchPosts(acct('vimeo', '123'), 5, json({ data: [{ uri: '/videos/1', name: 'V', link: 'https://vimeo.com/1', created_time: '2026-01-01T00:00:00Z', pictures: { sizes: [{ width: 640, link: 'https://i.vimeocdn.com/a.jpg' }] }, stats: { plays: 9 } }] }) as never)
    expect(r[0]).toMatchObject({ caption: 'V', video: true, likes: 9, imageUrl: 'https://i.vimeocdn.com/a.jpg' })
  })
  it('parses Twitch with clientId:token', async () => {
    let seen: Record<string, unknown> = {}
    const f = (async (_u: string, init: Record<string, unknown>) => { seen = init; return new Response(JSON.stringify({ data: [{ id: '1', url: 'https://www.twitch.tv/videos/1', title: 'T', thumbnail_url: 'https://static-cdn.jtvnw.net/x-%{width}x%{height}.jpg', created_at: '2026-01-01T00:00:00Z', view_count: 4 }] })) }) as never
    const r = await fetchPosts(acct('twitch', '99', 'cid:bearer'), 5, f)
    expect(r[0].imageUrl).toContain('640x360')
    expect((seen.headers as Record<string, string>)['Client-Id']).toBe('cid')
  })
  it('parses Spotify and Google Business and refuses a bad business id', async () => {
    const s = await fetchPosts(acct('spotify', 'abc'), 5, json({ items: [{ id: 'e', name: 'Ep', external_urls: { spotify: 'https://open.spotify.com/episode/e' }, images: [{ url: 'https://i.scdn.co/i.jpg' }], release_date: '2026-01-01' }] }) as never)
    expect(s[0].caption).toBe('Ep')
    const g = await fetchPosts(acct('google-business', 'accounts/1/locations/2'), 5, json({ localPosts: [{ name: 'p', summary: 'Hi', searchUrl: 'https://g.page/p', createTime: '2026-01-01T00:00:00Z' }] }) as never)
    expect(g[0].caption).toBe('Hi')
    await expect(fetchPosts(acct('google-business', '../evil'), 5, json({}) as never)).rejects.toThrow()
  })
  it('embed-only providers need no token and keep valid links', async () => {
    expect(needsToken('x')).toBe(false)
    expect(ADAPTERS.linkedin.provider).toBe('linkedin')
    const posts = embedPosts(acct('x', 'https://x.com/jack/status/1234567890123\nhttps://evil.test/a', ''), 5)
    expect(posts).toHaveLength(1)
    expect(posts[0].embed).toBe('x')
    await expect(fetchPosts(acct('x', 'nothing', ''), 5)).rejects.toThrow()
  })
  it('refresh time falls back to the default', () => {
    expect(ttlFor('5')).toBe(300000)
    expect(ttlFor('7')).toBe(1800000)
  })
})

describe('feed view', () => {
  const view = (props: Record<string, unknown>, posts = [post('a', 'One'), post('b', 'Two'), post('c', 'Three')]) => renderToStaticMarkup(React.createElement(SocialFeedView, { posts, props, uid: 'u1' }))
  it('renders masonry, load more, lightbox and follow', () => {
    const out = view({ layout: 'masonry', initial: 2, lightbox: true, followUrl: 'https://insta.test/me', followLabel: 'Follow me' })
    expect(out).toContain('be-social-feed--masonry')
    expect(out.match(/be-social-feed__item--extra/g)).toHaveLength(1)
    expect(out).toContain('Load more')
    expect(out).toContain('role="dialog"')
    expect(out).toContain('Follow me')
  })
  it('applies moderation before rendering', () => {
    expect(view({ exclude: 'Two' })).not.toContain('>Two<')
  })
  it('refuses a javascript follow link', () => {
    expect(view({ followUrl: 'javascript:alert(1)' })).not.toContain('javascript:')
  })
})
