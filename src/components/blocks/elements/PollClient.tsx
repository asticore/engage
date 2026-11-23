'use client'

import React, { useEffect, useState } from 'react'

import { percent } from '@/features/polls/core'

type Results = { counts: number[]; total: number; voted: number | null }

/** A poll: shows the options, records one vote per browser, then shows the results. Fetched in the browser so published pages stay static. */
export const PollClient: React.FC<{ pollId: string; question: string; options: string[]; showResults: boolean }> = ({ pollId, question, options, showResults }) => {
  const [res, setRes] = useState<Results | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const q = `id=${encodeURIComponent(pollId)}&n=${options.length}`

  useEffect(() => {
    let live = true
    fetch(`/api/polls?${q}`, { cache: 'no-store' })
      .then((r): Promise<Results> | null => (r.ok ? (r.json() as Promise<Results>) : null))
      .then((d) => { if (live && d) setRes(d) })
      .catch((): void => undefined)
    return (): void => { live = false }
  }, [q])

  const vote = async (choice: number) => {
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/polls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pollId, choice, n: options.length }) })
      if (!r.ok) throw new Error('failed')
      setRes((await r.json()) as Results)
    } catch {
      setError('Your vote could not be sent. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const done = res?.voted !== null && res?.voted !== undefined
  return (
    <div className="be-el-poll">
      <p className="be-el-poll__q"><strong>{question}</strong></p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {options.map((o, i) => {
          const count = res?.counts[i] ?? 0
          const pct = percent(count, res?.total ?? 0)
          return (
            <li key={o} style={{ margin: '6px 0' }}>
              {done ? (
                <div aria-label={`${o}: ${pct}%`}>
                  <div>{o}{res?.voted === i ? ' (your vote)' : ''}{showResults ? ` - ${pct}%` : ''}</div>
                  {showResults ? <div style={{ background: 'rgb(0 0 0 / .1)', borderRadius: 4, height: 8 }}><div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: 'var(--accent, #111)' }} /></div> : null}
                </div>
              ) : (
                <button type="button" disabled={busy} onClick={() => vote(i)} className="be-el-poll__btn" style={{ width: '100%', textAlign: 'left' }}>{o}</button>
              )}
            </li>
          )
        })}
      </ul>
      {done ? <p className="be-el-poll__note" role="status">{showResults ? `Thanks for voting. ${res?.total ?? 0} vote${res?.total === 1 ? '' : 's'} so far.` : 'Thanks for voting.'}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
