'use client'

import React, { useEffect, useState } from 'react'

/**
 * Monthly and yearly switch for pricing tables. It sets data-billing on the page, and pricing tables show
 * their monthly or yearly price from that. Without JavaScript the monthly prices show. The choice is
 * remembered in this tab only.
 */
export const BillingToggle: React.FC<{ monthlyLabel: string; yearlyLabel: string; saveText: string; startYearly: boolean }> = ({ monthlyLabel, yearlyLabel, saveText, startYearly }) => {
  const [yearly, setYearly] = useState(startYearly)

  useEffect(() => {
    let saved: string | null = null
    try { saved = window.sessionStorage.getItem('eg-billing') } catch { /* storage blocked */ }
    if (saved === 'yearly' || saved === 'monthly') setYearly(saved === 'yearly')
  }, [])

  useEffect(() => {
    document.documentElement.dataset.billing = yearly ? 'yearly' : 'monthly'
    try { window.sessionStorage.setItem('eg-billing', yearly ? 'yearly' : 'monthly') } catch { /* storage blocked */ }
  }, [yearly])

  return (
    <div className="el-billing">
      <span className={yearly ? 'el-billing__label' : 'el-billing__label el-billing__label--on'}>{monthlyLabel}</span>
      <button type="button" role="switch" aria-checked={yearly} aria-label={`${yearlyLabel} billing`} className="el-billing__switch" onClick={() => setYearly((v) => !v)}>
        <span className="el-billing__knob" aria-hidden="true" />
      </button>
      <span className={yearly ? 'el-billing__label el-billing__label--on' : 'el-billing__label'}>{yearlyLabel}</span>
      {saveText && <span className="el-billing__save">{saveText}</span>}
    </div>
  )
}
