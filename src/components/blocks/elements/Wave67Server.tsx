import React from 'react'

import { getEngine } from '@/lib/engine'
import { SOCIAL_FEED_LIMIT } from '@/lib/elements/wave67Defs'
import { ConsentGate } from '@/features/consent/ConsentGate'
import { EMBED_NAME, embedLayout, resolveEmbed } from '@/lib/embedProviders'
import { moderatePosts } from '@/features/socialFeeds/moderate'
import { getFeed, readSocialAccounts, ttlFor } from '@/features/socialFeeds/service'
import type { SocialPost } from '@/features/socialFeeds/types'

import { EmbedConsentFrame } from './EmbedConsentFrame'
import { flag, linkHref, num, pick, str } from './elementUtil'
import './social-feed.css'

/**
 * Wave 67 social feed (def: src/lib/elements/wave67Defs.ts). Server rendered from a connected account. The output
 * depends only on the saved props and the cached posts, so it is identical for every visitor and safe to edge cache.
 * No token ever reaches this markup. Failures render nothing.
 */

type P = Record<string, unknown>

const LAYOUTS = ['grid', 'masonry', 'highlight', 'list', 'carousel'] as const
const ASPECTS = ['square', 'portrait', 'landscape'] as const
const SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation'

/** A fixed, locale independent date so every visitor sees the same text. */
export const feedDate = (iso: string): string => (iso ? iso.slice(0, 10) : '')

/** Id safe for a fragment link (the popup uses :target, so no script is needed). */
const frag = (base: string, i: number): string => `${base.replace(/[^a-zA-Z0-9_-]/g, '')}-p${i}`

export function SocialFeedView({ posts, props, uid = 'sf' }: { posts: SocialPost[]; props: P; uid?: string }): React.ReactElement | null {
  const layout = pick(props.layout, LAYOUTS, 'grid')
  const aspect = pick(props.aspect, ASPECTS, 'square')
  const columns = Math.round(num(props.columns, 3, 1, 6))
  const limit = Math.round(num(props.limit, 9, 1, SOCIAL_FEED_LIMIT))
  const showCaption = flag(props.showCaption, true)
  const showDate = flag(props.showDate, false)
  const showLikes = flag(props.showLikes, false)
  const newTab = flag(props.newTab, true)
  const lightbox = flag(props.lightbox, false)
  const initial = Math.round(num(props.initial, 0, 0, SOCIAL_FEED_LIMIT))
  const moderated = moderatePosts(posts, props)
  const shown = moderated.slice(0, limit)
  const followHref = linkHref(props.followUrl)
  if (!shown.length) return null
  const rel = newTab ? 'noopener noreferrer' : 'noopener'
  const base = frag(uid, 0).replace(/-p0$/, '')
  const toggleId = `${base}-more`
  const hasMore = initial > 0 && shown.length > initial
  return (
    <div className="be-social-feed__wrap">
      {hasMore ? <input type="checkbox" id={toggleId} className="be-social-feed__toggle" aria-label={str(props.loadMoreLabel) || 'Load more'} /> : null}
      <ul className={`be-social-feed be-social-feed--${layout} be-social-feed--${aspect}`} style={{ '--be-social-cols': columns } as React.CSSProperties}>
        {shown.map((p, i) => {
          const extra = hasMore && i >= initial
          const id = frag(base, i)
          const itemClass = `be-social-feed__item${extra ? ' be-social-feed__item--extra' : ''}`
          if (p.embed) {
            const target = resolveEmbed(p.embed, p.url)
            if (target?.kind !== 'iframe') return null
            return (
              <li key={p.id || p.url} className={itemClass}>
                <EmbedConsentFrame src={target.src} title={`${EMBED_NAME[p.embed]} post`} providerName={EMBED_NAME[p.embed]} aspectRatio="1 / 1" sandbox={SANDBOX} allow="encrypted-media; clipboard-write" {...embedLayout(p.embed, target.src)} />
              </li>
            )
          }
          const useBox = lightbox && !!p.imageUrl
          const inner = (
            <>
              {p.imageUrl ? (
                <img className="be-social-feed__img" src={p.imageUrl} alt={p.caption.slice(0, 100)} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              ) : (
                <span className="be-social-feed__img be-social-feed__img--empty" aria-hidden="true" />
              )}
              {showCaption && p.caption ? <span className="be-social-feed__caption">{p.caption}</span> : null}
              {(showDate && p.date) || (showLikes && p.likes !== null) ? (
                <span className="be-social-feed__meta">
                  {showDate && p.date ? <time dateTime={p.date}>{feedDate(p.date)}</time> : null}
                  {showLikes && p.likes !== null ? <span>{`${p.likes} likes`}</span> : null}
                </span>
              ) : null}
            </>
          )
          return (
            <li key={p.id || p.url} className={itemClass}>
              {useBox ? (
                <a className="be-social-feed__card" href={`#${id}`} aria-haspopup="dialog">
                  {inner}
                </a>
              ) : (
                <a className="be-social-feed__card" href={p.url} target={newTab ? '_blank' : undefined} rel={rel}>
                  {inner}
                </a>
              )}
              {useBox ? (
                <div id={id} className="be-social-feed__box" role="dialog" aria-label={p.caption.slice(0, 80) || 'Post'}>
                  <a className="be-social-feed__box-close" href="#!" aria-label="Close">
                    {'\u00d7'}
                  </a>
                  <figure className="be-social-feed__box-body">
                    <img src={p.imageUrl} alt={p.caption.slice(0, 100)} referrerPolicy="no-referrer" />
                    {p.caption ? <figcaption>{p.caption}</figcaption> : null}
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      View original post
                    </a>
                  </figure>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
      {hasMore ? (
        <label htmlFor={toggleId} className="be-social-feed__more btn">
          {str(props.loadMoreLabel) || 'Load more'}
        </label>
      ) : null}
      {followHref ? (
        <a className="be-social-feed__follow btn" href={followHref} target="_blank" rel="noopener noreferrer">
          {str(props.followLabel) || 'Follow'}
        </a>
      ) : null}
    </div>
  )
}

export async function SocialFeedElement(props: P): Promise<React.ReactElement | null> {
  const wanted = str(props.account)
  if (!wanted) return null
  let posts: SocialPost[] = []
  try {
    const engine = await getEngine()
    const accounts = await readSocialAccounts(engine as never)
    const account = accounts.find((a) => a.id === wanted)
    if (!account) return null
    posts = await getFeed(account, undefined, Date.now(), ttlFor(props.refresh))
  } catch {
    return null
  }
  const view = <SocialFeedView posts={posts} props={props} uid={`sf${wanted}`} />
  if (flag(props.consent, false) && !posts.some((p) => p.embed)) {
    return (
      <ConsentGate category="marketing" title="Social feed" description="The pictures in this feed come from a third party and need marketing cookies. Accept to load them." acceptLabel="Accept and load">
        {view}
      </ConsentGate>
    )
  }
  return view
}

export const WAVE67_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'social-feed': SocialFeedElement as never,
}
