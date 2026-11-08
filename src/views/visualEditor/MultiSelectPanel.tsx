'use client'

import React from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

/** Settings tab body while several elements are selected: only the bulk actions apply. */
export const MultiSelectPanel: React.FC<{
  count: number
  canEditStyle: boolean
  onDelete: () => void
  onDuplicate: () => void
  onCopy: () => void
  onPasteStyle: () => void
  onClear: () => void
}> = ({ count, canEditStyle, onDelete, onDuplicate, onCopy, onPasteStyle, onClear }) => {
  const t = useAdminT()
  return (
    <div className="ve-multi" role="group" aria-label={t('ve.multi.count', { n: count })}>
      <p className="ve-multi__count" role="status">{t('ve.multi.count', { n: count })}</p>
      <p className="ve-dock__empty">{t('ve.multi.hint')}</p>
      <div className="ve-multi__actions">
        <button type="button" className="ve-btn" onClick={onDuplicate}>{t('cv.lit.duplicate')}</button>
        <button type="button" className="ve-btn" onClick={onCopy}>{t('ve.multi.copy')}</button>
        <button type="button" className="ve-btn" onClick={onPasteStyle} disabled={!canEditStyle}>{t('ve.multi.pasteStyle')}</button>
        <button type="button" className="ve-btn ve-btn--danger" onClick={onDelete}>{t('cv.lit.delete')}</button>
        <button type="button" className="ve-btn" onClick={onClear}>{t('ve.multi.clear')}</button>
      </div>
    </div>
  )
}

export default MultiSelectPanel
