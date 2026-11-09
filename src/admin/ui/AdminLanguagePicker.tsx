'use client'

/**
 * The signed-in person's admin language, chosen on the My preferences page
 * (Settings > My preferences). Saves to their user record and refreshes, so the layout re-reads
 * the language and sets <html lang/dir>.
 *
 * Only the user's own admin screens change. Website languages are separate.
 * An admin editing another user changes that user's language from the Users
 * edit screen instead, which is the same field.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { ADMIN_UI_LOCALES, ADMIN_UI_LOCALE_LABELS } from '@/features/uiStrings/locales'

export function AdminLanguagePicker({
  userId,
  current,
}: {
  userId: number | string | null | undefined
  current: string | null | undefined
}) {
  const t = useAdminT()
  const router = useRouter()
  const [value, setValue] = useState(current && current !== 'auto' ? current : 'auto')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  if (userId === null || userId === undefined) return null

  const onSave = async () => {
    setStatus('saving')
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ adminLanguage: value }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setStatus('saved')
      router.refresh()
    } catch {
      setStatus('error')
    }
  }

  return (
    <div
      className="my-prefs__language"
    >
      <label className="my-prefs__sr" htmlFor="admin-ui-language">
        {t('profile.interfaceLanguage')}
      </label>
      <select
        id="admin-ui-language"
        onChange={(event) => {
          setValue(event.target.value)
          setStatus('idle')
        }}
        value={value}
      >
        <option value="auto">{t('profile.interfaceLanguageAuto')}</option>
        {ADMIN_UI_LOCALES.map((code) => (
          <option key={code} value={code}>
            {ADMIN_UI_LOCALE_LABELS[code].native}
          </option>
        ))}
      </select>
      <button className="btn" disabled={status === 'saving'} onClick={onSave} type="button">
        {status === 'saved'
          ? t('profile.interfaceLanguageSaved')
          : t('profile.interfaceLanguageSave')}
      </button>
      {status === 'error' ? <span role="alert">{t('profile.interfaceLanguageError')}</span> : null}
    </div>
  )
}

export default AdminLanguagePicker
