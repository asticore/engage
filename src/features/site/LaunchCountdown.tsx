'use client'

import React, { useEffect, useState } from 'react'

import { timeLeft } from './countdown'

/** Counts down to the launch. The page reloads at zero so the site opens by itself. */
export function LaunchCountdown({ launchAt }: { launchAt: string }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const left = now ? timeLeft(launchAt, now) : null
  useEffect(() => {
    if (left?.done) window.location.reload()
  }, [left?.done])
  if (!left) return <div className="mt-8 min-h-[4rem]" aria-hidden="true" />
  const parts: Array<[number, string]> = [[left.days, 'days'], [left.hours, 'hours'], [left.minutes, 'minutes'], [left.seconds, 'seconds']]
  return (
    <div className="mt-8 flex gap-6" role="timer" aria-label={`${left.days} days, ${left.hours} hours, ${left.minutes} minutes left`}>
      {parts.map(([n, label]) => (
        <div key={label}>
          <div className="text-4xl text-[var(--color-ink)]" style={{ fontFamily: 'var(--font-display)' }}>{String(n).padStart(2, '0')}</div>
          <div className="text-sm text-[var(--color-ink)] opacity-70">{label}</div>
        </div>
      ))}
    </div>
  )
}
