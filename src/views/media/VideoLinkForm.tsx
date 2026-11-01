'use client'

import { useState, type FormEvent } from 'react'

import { postJson } from '@/features/media/admin/mediaApi'

const fieldClass =
  'rounded-[4px] border border-[var(--theme-elevation-200)] bg-transparent px-[calc(var(--base)*0.6)] py-[calc(var(--base)*0.35)] text-[calc(var(--base)*0.82)] text-[var(--theme-elevation-900)] outline-none focus:border-[var(--ac-gold)]'

const buttonClass =
  'rounded-[4px] border border-[var(--theme-elevation-200)] px-[calc(var(--base)*0.6)] py-[calc(var(--base)*0.35)] text-[calc(var(--base)*0.78)] text-[var(--theme-elevation-700)] hover:border-[var(--ac-gold)] hover:text-[var(--ac-gold)] disabled:opacity-50'

/**
 * Adds a YouTube, Vimeo or direct .mp4 / .webm link to the library as a video
 * item. The poster picture is set on the item's edit screen, where the picture
 * picker lives.
 */
export function VideoLinkForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result = await postJson<{ ok: boolean }>('/api/admin-media-video-link', { url, title })
    setBusy(false)
    if (result.ok === false) {
      setError(result.error)
      return
    }
    setTitle('')
    setUrl('')
    onAdded()
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Add video link"
      className="flex flex-wrap items-end gap-[calc(var(--base)*0.5)] rounded-[4px] border border-[var(--theme-elevation-200)] p-[calc(var(--base)*0.6)]"
    >
      <label className="flex flex-col gap-[4px] text-[calc(var(--base)*0.75)] text-[var(--theme-elevation-700)]">
        Title
        <input className={fieldClass} value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="flex min-w-[260px] flex-1 flex-col gap-[4px] text-[calc(var(--base)*0.75)] text-[var(--theme-elevation-700)]">
        Video link
        <input
          className={fieldClass}
          type="url"
          required
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <button type="submit" className={buttonClass} disabled={busy}>
        {busy ? 'Adding...' : 'Add link'}
      </button>
      <button type="button" className={buttonClass} onClick={onCancel}>
        Cancel
      </button>
      {error ? (
        <p role="alert" className="m-0 w-full text-[12px] text-[var(--theme-error-600,#c53030)]">
          {error}
        </p>
      ) : null}
    </form>
  )
}
