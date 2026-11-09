'use client'

/**
 * The signed-in person's own preferences: admin interface language (saved to
 * their own user record), light/dark/system theme (the same localStorage-backed
 * preference the sidebar toggle uses) and a button to replay the admin tour.
 */

import React from 'react'

import { type ThemePref, useTheme } from '@/admin/context/ThemeContext'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { AdminLanguagePicker } from '@/admin/ui/AdminLanguagePicker'
import { ADMIN_TOUR_START_EVENT } from '@/features/adminTour/steps'

const THEME_CHOICES: { value: ThemePref; labelKey: 'profile.themeLight' | 'profile.themeDark' | 'profile.themeSystem' }[] = [
  { value: 'light', labelKey: 'profile.themeLight' },
  { value: 'dark', labelKey: 'profile.themeDark' },
  { value: 'auto', labelKey: 'profile.themeSystem' },
]

export function MyPreferencesClient({
  userId,
  adminLanguage,
}: {
  userId: number | string | null | undefined
  adminLanguage: string | null | undefined
}) {
  const t = useAdminT()
  const { setTheme, theme } = useTheme()

  return (
    <div className="my-prefs">
      <section className="my-prefs__card">
        <h2>{t('profile.interfaceLanguage')}</h2>
        <p>{t('profile.interfaceLanguageHelp')}</p>
        <AdminLanguagePicker current={adminLanguage} userId={userId} />
      </section>

      <section className="my-prefs__card">
        <h2>{t('profile.themeTitle')}</h2>
        <p>{t('profile.themeHelp')}</p>
        <div aria-label={t('profile.themeTitle')} className="my-prefs__choices" role="radiogroup">
          {THEME_CHOICES.map((choice) => (
            <label className="my-prefs__choice" key={choice.value}>
              <input
                checked={theme === choice.value}
                name="admin-theme"
                onChange={() => setTheme(choice.value)}
                type="radio"
                value={choice.value}
              />
              {t(choice.labelKey)}
            </label>
          ))}
        </div>
      </section>

      <section className="my-prefs__card">
        <h2>{t('profile.tourTitle')}</h2>
        <p>{t('profile.tourHelp')}</p>
        <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent(ADMIN_TOUR_START_EVENT))} type="button">
          {t('profile.tourReplay')}
        </button>
      </section>
    </div>
  )
}

export default MyPreferencesClient
