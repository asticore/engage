'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { PROVIDER_CHOICES, TONES, type ChatbotSettings } from '../core'
import type { AdminConversation } from '../store'

type Filter = 'all' | 'handoff' | 'unhelpful'
type Loaded = {
  settings: ChatbotSettings
  stats: { conversations: number; questions: number; handoffs: number; helpful: number; unhelpful: number; costUsdMonth: number; callsMonth: number }
  conversations: AdminConversation[]
  shared: { month: string; estCostUsd: number; capUsd: number; capReached: boolean }
  aiReady: boolean
  faqOn: boolean
}

const usd = (n: number): string => `$${n.toFixed(2)}`

/** Admin screen for the chatbot: settings, totals and spend, the conversation log, and "teach it". English only. */
export const ChatbotPanel: React.FC = () => {
  const [data, setData] = useState<Loaded | null>(null)
  const [settings, setSettings] = useState<ChatbotSettings | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [message, setMessage] = useState('')
  const [teach, setTeach] = useState<{ messageId: number; question: string; answer: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin-chatbot?filter=${filter}`)
    const out = (await res.json().catch((): null => null)) as (Loaded & { error?: string }) | null
    if (!res.ok || !out) return setMessage(out?.error ?? 'Could not load the chatbot.')
    setData(out)
    setSettings((cur) => cur ?? out.settings)
  }, [filter])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok = ''): Promise<boolean> => {
    const res = await fetch('/api/admin-chatbot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = (await res.json().catch((): null => null)) as { error?: string; removed?: number } | null
    if (!res.ok) {
      setMessage(out?.error ?? 'That did not work.')
      return false
    }
    setMessage(typeof out?.removed === 'number' ? `Removed ${out.removed} old conversations.` : ok)
    await load()
    return true
  }
  const set = (patch: Partial<ChatbotSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s))
  const check = (key: keyof ChatbotSettings, label: string) =>
    settings ? (
      <label style={{ display: 'block' }}>
        <input type="checkbox" checked={Boolean(settings[key])} onChange={(e) => set({ [key]: e.target.checked } as Partial<ChatbotSettings>)} /> {label}
      </label>
    ) : null
  const text = (key: keyof ChatbotSettings, label: string, max = 300) =>
    settings ? (
      <label>
        {label}
        <br />
        <input style={{ width: '100%' }} maxLength={max} value={String(settings[key] ?? '')} onChange={(e) => set({ [key]: e.target.value } as Partial<ChatbotSettings>)} />
      </label>
    ) : null
  const area = (key: keyof ChatbotSettings, label: string, max = 1500) =>
    settings ? (
      <label>
        {label}
        <br />
        <textarea rows={3} style={{ width: '100%' }} maxLength={max} value={String(settings[key] ?? '')} onChange={(e) => set({ [key]: e.target.value } as Partial<ChatbotSettings>)} />
      </label>
    ) : null

  if (!data || !settings) return <p role="status">{message || 'Loading…'}</p>
  const { stats, shared } = data
  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}
      {!data.aiReady && <p role="status">No Claude or OpenAI key is set in Integrations, so the chatbot answers from the FAQ only. Add a key to let it write answers from your site content.</p>}
      {!data.faqOn && <p role="status">FAQ is switched off, so there is nothing to answer from first. Switch FAQ on in Site Settings.</p>}
      {shared.capReached && <p role="alert">The monthly AI spend cap ({usd(shared.capUsd)}) is reached. The chatbot now only points visitors to pages.</p>}

      <section aria-labelledby="chatbot-stats">
        <h2 id="chatbot-stats">Use and spend</h2>
        <p>
          {stats.conversations} conversations, {stats.questions} questions, {stats.handoffs} handed off. Ratings: {stats.helpful} helpful, {stats.unhelpful} not helpful.
        </p>
        <p>
          This month ({shared.month}): chatbot {usd(stats.costUsdMonth)} in {stats.callsMonth} calls. All AI features together {usd(shared.estCostUsd)}
          {shared.capUsd > 0 ? ` of a ${usd(shared.capUsd)} cap (set in Integrations)` : ' (no cap set in Integrations)'}. Costs are estimates from list prices.
        </p>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void post({ action: 'settings', settings }, 'Settings saved.')
        }}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: '44rem' }}
      >
        <h2>Settings</h2>
        {check('sitewide', 'Show the chat button on every page (or place the Chatbot element on a page instead)')}
        <label>
          Button position
          <br />
          <select value={settings.position} onChange={(e) => set({ position: e.target.value as ChatbotSettings['position'] })}>
            <option value="right">Bottom right</option>
            <option value="left">Bottom left</option>
          </select>
        </label>
        {text('name', 'Name', 40)}
        {text('avatar', 'Avatar picture address (optional)', 300)}
        {text('greeting', 'Greeting', 300)}
        <label>
          Tone
          <br />
          <select value={settings.tone} onChange={(e) => set({ tone: e.target.value as ChatbotSettings['tone'] })}>
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {area('brandVoice', 'Brand voice (how you like to sound)', 600)}
        {area('instructions', 'Extra instructions, one per line', 1500)}
        {area('allowedTopics', 'Topics it may discuss, one per line (empty means anything on the site)', 1000)}
        {area('blockedTopics', 'Words or topics it must refuse, one per line', 1000)}
        {text('languages', 'Languages, for example English, Spanish (empty means the visitor’s language)', 120)}
        {text('hours', 'Opening hours shown when it hands off, for example Mon to Fri 9 to 5', 200)}
        {area('handoffMessage', 'Message when it hands off', 400)}
        {text('handoffUrl', 'Contact page (a path such as /contact, or a full https address)', 300)}
        {text('handoffEmail', 'Contact email (optional)', 200)}

        <h3>Extras (all off until you switch them on)</h3>
        {check('storeHelp', 'Store help: use shipping, returns and policy pages as sources')}
        {check('orderStatus', 'Order status: signed-in customers can ask about their own orders')}
        {check('recommendations', 'Product recommendations: link products that match the question')}

        <h3>AI, limits and privacy</h3>
        {check('useAi', 'Let AI write the answers (needs a key in Integrations). Off answers from the FAQ only.')}
        <label>
          Provider
          <br />
          <select value={settings.provider} onChange={(e) => set({ provider: e.target.value as ChatbotSettings['provider'] })}>
            {PROVIDER_CHOICES.map((p) => (
              <option key={p} value={p}>
                {p === 'auto' ? 'Whichever has a key (Claude first)' : p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Questions per visitor per hour
          <br />
          <input type="number" min={1} max={200} value={settings.ratePerHour} onChange={(e) => set({ ratePerHour: Number(e.target.value) })} />
        </label>
        <label>
          Extra monthly cap for the chatbot in US dollars (0 none). The shared AI cap in Integrations always applies too.
          <br />
          <input type="number" min={0} step="0.01" value={settings.capUsd} onChange={(e) => set({ capUsd: Number(e.target.value) })} />
        </label>
        {check('requireConsent', 'Ask visitors to agree before the first message')}
        {area('consentText', 'Consent notice', 500)}
        <label>
          Delete conversations after this many days (0 keeps them until erased)
          <br />
          <input type="number" min={0} max={3650} value={settings.retentionDays} onChange={(e) => set({ retentionDays: Number(e.target.value) })} />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit">Save settings</button>
          <button type="button" onClick={() => void post({ action: 'purge' })}>
            Delete old conversations now
          </button>
        </div>
      </form>

      <section aria-labelledby="chatbot-log">
        <h2 id="chatbot-log">Conversations</h2>
        <div role="tablist" style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0' }}>
          {(['all', 'handoff', 'unhelpful'] as Filter[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'handoff' ? 'Handed off' : 'Rated not helpful'}
            </button>
          ))}
        </div>
        {data.conversations.length === 0 && <p>No conversations yet.</p>}
        {data.conversations.map((c) => (
          <details key={c.id} style={{ borderTop: '1px solid var(--color-line, #ddd)', padding: '0.5rem 0' }}>
            <summary>
              {c.updatedAt.slice(0, 16).replace('T', ' ')} · {c.messages.length} messages{c.userId ? ' · signed in' : ''}
              {c.handedOff ? ' · handed off' : ''}
              {c.unhelpful ? ` · ${c.unhelpful} not helpful` : ''}
            </summary>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {c.messages.map((m) => (
                <li key={m.id} style={{ margin: '0.5rem 0' }}>
                  <strong>{m.role === 'user' ? 'Visitor' : 'Bot'}</strong>
                  {m.via ? ` (${m.via})` : ''}
                  {m.rating === 1 ? ' 👍' : m.rating === -1 ? ' 👎' : ''}: <span style={{ whiteSpace: 'pre-line' }}>{m.content}</span>
                  {m.sources.length > 0 && <span> Sources: {m.sources.map((s) => s.url).join(', ')}</span>}
                  {m.role === 'assistant' && data.faqOn && (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => {
                          const q = [...c.messages].reverse().find((x) => x.role === 'user' && x.id < m.id)
                          setTeach({ messageId: m.id, question: q?.content ?? '', answer: '' })
                        }}
                      >
                        Teach it
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => void post({ action: 'delete', id: c.id }, 'Conversation deleted.')}>
              Delete conversation
            </button>
          </details>
        ))}
      </section>

      {teach && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (await post({ action: 'teach', ...teach }, 'Saved to the FAQ. The bot will use it from the next question.')) setTeach(null)
          }}
          style={{ display: 'grid', gap: '0.5rem', maxWidth: '40rem', border: '1px solid var(--color-line, #ddd)', padding: '1rem' }}
        >
          <h3>Teach it: add to the FAQ</h3>
          <label>
            Question
            <br />
            <input required style={{ width: '100%' }} maxLength={300} value={teach.question} onChange={(e) => setTeach({ ...teach, question: e.target.value })} />
          </label>
          <label>
            Correct answer
            <br />
            <textarea required rows={4} style={{ width: '100%' }} maxLength={2000} value={teach.answer} onChange={(e) => setTeach({ ...teach, answer: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit">Save to FAQ</button>
            <button type="button" onClick={() => setTeach(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
