'use client'

/**
 * Own display name and photo, set on My preferences. The photo is uploaded to the media library
 * and linked on the user record; the side menu shows both instead of the email address.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

export function ProfileNamePhoto({
  userId,
  displayName,
  photoUrl,
}: {
  userId: number | string | null | undefined
  displayName: string | null | undefined
  photoUrl: string | null | undefined
}) {
  const t = useAdminT()
  const router = useRouter()
  const [name, setName] = useState(displayName ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  if (userId === null || userId === undefined) return null

  const preview = file ? URL.createObjectURL(file) : removePhoto ? null : (photoUrl ?? null)

  const onSave = async () => {
    setStatus('saving')
    try {
      const body: Record<string, unknown> = { displayName: name.trim() }
      if (file) {
        const form = new FormData()
        form.append('file', file)
        form.append('_payload', JSON.stringify({ alt: name.trim() || 'Profile photo' }))
        const up = await fetch('/api/media', { method: 'POST', credentials: 'include', body: form })
        if (!up.ok) throw new Error(`HTTP ${up.status}`)
        const json = (await up.json()) as { doc?: { id?: number | string } }
        if (json.doc?.id === undefined) throw new Error('no id')
        body.photo = json.doc.id
      } else if (removePhoto) {
        body.photo = null
      }
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setFile(null)
      setRemovePhoto(false)
      setStatus('saved')
      router.refresh()
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="my-prefs__language">
      <label htmlFor="profile-display-name">{t('profile.nameLabel')}</label>
      <input
        id="profile-display-name"
        onChange={(event) => {
          setName(event.target.value)
          setStatus('idle')
        }}
        type="text"
        value={name}
      />
      <label htmlFor="profile-photo">{t('profile.photoLabel')}</label>
      {preview ? (
        <img alt="" className="nav__avatar nav__avatar--large" height={64} src={preview} width={64} />
      ) : null}
      <input
        accept="image/*"
        id="profile-photo"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null)
          setRemovePhoto(false)
          setStatus('idle')
        }}
        type="file"
      />
      {preview ? (
        <button
          className="btn"
          onClick={() => {
            setFile(null)
            setRemovePhoto(true)
            setStatus('idle')
          }}
          type="button"
        >
          {t('profile.photoRemove')}
        </button>
      ) : null}
      <button className="btn" disabled={status === 'saving'} onClick={onSave} type="button">
        {status === 'saved' ? t('profile.nameSaved') : t('profile.nameSave')}
      </button>
      {status === 'error' ? <span role="alert">{t('profile.nameError')}</span> : null}
    </div>
  )
}

export default ProfileNamePhoto
