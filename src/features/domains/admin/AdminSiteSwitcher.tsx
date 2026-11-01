'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { ALL_SITES } from '@/features/domains/adminSite'

export type SwitcherSite = { host: string; label: string }

/**
 * The site switcher at the top of the admin sidebar. Lists only the sites this account may use (the server sends that list),
 * and "All sites" only to an account with no domain limit. The choice is saved for this person and the admin re-renders
 * its lists for that site: pages, posts and products show content available on the site plus shared content.
 */
export function AdminSiteSwitcher({
  sites,
  unrestricted,
  current,
}: {
  sites: SwitcherSite[]
  unrestricted: boolean
  current: string | null
}) {
  const t = useAdminT()
  const router = useRouter()
  const [value, setValue] = useState(current ?? (unrestricted ? ALL_SITES : (sites[0]?.host ?? '')))
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  const onChange = async (next: string) => {
    setValue(next)
    setStatus('saving')
    try {
      const response = await fetch('/api/admin-site-choice', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ site: next }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setStatus('idle')
      router.refresh()
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="nav__site" style={{ display: 'grid', gap: 4, padding: '8px 12px', fontSize: 12 }}>
      <label htmlFor="admin-site-switcher" style={{ fontWeight: 600 }}>
        {t('sites.switcherLabel')}
      </label>
      <select id="admin-site-switcher" value={value} disabled={status === 'saving'} onChange={(event) => onChange(event.target.value)}>
        {unrestricted ? <option value={ALL_SITES}>{t('sites.allSites')}</option> : null}
        {sites.map((site) => (
          <option key={site.host} value={site.host}>
            {site.label === site.host ? site.host : `${site.label} (${site.host})`}
          </option>
        ))}
      </select>
      {status === 'error' ? <span role="alert">{t('sites.switcherError')}</span> : null}
    </div>
  )
}

export default AdminSiteSwitcher
