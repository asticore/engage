'use client'

import React from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

export function PriceTiersHeading() {
  const t = useAdminT()
  return (
    <div className="settings-page__header">
      <h1 className="settings-page__title">{t('shop.tiers.title')}</h1>
      <p className="settings-page__description">{t('shop.tiers.description')}</p>
    </div>
  )
}
