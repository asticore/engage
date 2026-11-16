'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { AuthCaptcha } from '@/features/security/AuthCaptcha'

import { initials, MAX_CONTENT, type CommentNode } from '../core'

type Loaded = { comments: CommentNode[]; count: number; closed: boolean }

const Thread: React.FC<{ nodes: CommentNode[]; onReply: (id: number) => void; closed: boolean }> = ({ nodes, onReply, closed }) => (
  <ul style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
    {nodes.map((c) => (
      <li key={c.id} id={`comment-${c.id}`} style={{ margin: '1rem 0', paddingLeft: '0.75rem', borderLeft: '2px solid var(--color-line, #ddd)' }}>
        <p style={{ margin: 0 }}>
          <span aria-hidden="true" style={{ display: 'inline-block', width: '1.75rem', height: '1.75rem', lineHeight: '1.75rem', textAlign: 'center', borderRadius: '50%', background: 'var(--color-line, #ddd)', marginRight: '0.5rem', fontSize: '0.75rem' }}>
            {initials(c.name)}
          </span>
          <strong>{c.name}</strong>
          {c.fromTeam ? ' (site team)' : ''} <time dateTime={c.createdAt}>{c.createdAt.slice(0, 10)}</time>
        </p>
        <p style={{ whiteSpace: 'pre-line', margin: '0.25rem 0' }}>{c.content}</p>
        {!closed && (
          <button type="button" className="btn" onClick={() => onReply(c.id)}>
            Reply
          </button>
        )}
        {c.replies.length > 0 && (
          <div style={{ marginLeft: '1rem' }}>
            <Thread nodes={c.replies} onReply={onReply} closed={closed} />
          </div>
        )}
      </li>
    ))}
  </ul>
)

/** Comments under a blog post: the list and the form. English only. */
export const CommentsSection: React.FC<{ postId: number; captcha?: { provider: 'turnstile' | 'recaptcha'; siteKey: string } | null }> = ({ postId, captcha }) => {
  const [data, setData] = useState<Loaded | null>(null)
  const [parent, setParent] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/comments?post=${postId}`)
    if (!res.ok) return
    setData((await res.json().catch((): null => null)) as Loaded | null)
  }, [postId])
  useEffect(() => {
    void load()
  }, [load])

  if (!data) return null
  return (
    <section aria-labelledby="comments-title" style={{ marginTop: '3rem' }}>
      <h2 id="comments-title">Comments ({data.count})</h2>
      <Thread nodes={data.comments} onReply={setParent} closed={data.closed} />
      {data.closed ? (
        <p>Comments are closed on this post.</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setMessage('')
            const form = e.currentTarget
            const values = Object.fromEntries(new FormData(form))
            const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, post: postId, parent }) })
            const out = (await res.json().catch((): null => null)) as { ok?: boolean; status?: string; error?: string } | null
            setBusy(false)
            setFailed(!res.ok || !out?.ok)
            if (!res.ok || !out?.ok) return setMessage(out?.error ?? 'That did not work. Please try again.')
            form.reset()
            setParent(null)
            setMessage(out.status === 'approved' ? 'Thanks, your comment is up.' : 'Thanks. Your comment will appear once it has been approved.')
            if (out.status === 'approved') void load()
          }}
          style={{ display: 'grid', gap: '0.75rem', maxWidth: '36rem', marginTop: '1.5rem' }}
        >
          <h3>{parent ? 'Write a reply' : 'Leave a comment'}</h3>
          {parent ? (
            <button type="button" className="btn" onClick={() => setParent(null)}>
              Cancel reply
            </button>
          ) : null}
          <label>
            Your name
            <br />
            <input name="name" required maxLength={60} autoComplete="name" />
          </label>
          <label>
            Email (never shown)
            <br />
            <input name="email" type="email" required maxLength={200} autoComplete="email" />
          </label>
          <label>
            Comment
            <br />
            <textarea name="content" required rows={5} maxLength={MAX_CONTENT} />
          </label>
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {captcha ? <AuthCaptcha provider={captcha.provider} siteKey={captcha.siteKey} /> : null}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Post comment
          </button>
          {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
        </form>
      )}
    </section>
  )
}
