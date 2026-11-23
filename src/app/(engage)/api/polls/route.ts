import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { cleanChoice, cleanPollId, toResults, VOTER_COOKIE } from '@/features/polls/core'
import { castVote, countVotes, pollDb, votedChoice } from '@/features/polls/store'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: noStore })

/**
 * Public poll votes (Task 15, 34g2).
 *   GET  ?id=&n=       -> { counts, total, voted }  (voted is this browser's choice or null)
 *   POST { id, choice, n } records one vote per browser (an HttpOnly cookie id), then returns the same.
 * `n` is the number of options on the element, only used to size the result list.
 */
async function voterFrom(create: boolean): Promise<string | null> {
  const jar = await cookies()
  const existing = jar.get(VOTER_COOKIE)?.value
  if (existing && /^[A-Za-z0-9-]{16,64}$/.test(existing)) return existing
  if (!create) return null
  const id = crypto.randomUUID()
  jar.set(VOTER_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 })
  return id
}

async function results(pollId: string, n: number, voter: string | null): Promise<Response> {
  const db = await pollDb()
  return json({ ...toResults(await countVotes(db, pollId), n), voted: voter ? await votedChoice(db, pollId, voter) : null })
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    const id = cleanPollId(url.searchParams.get('id'))
    if (!id) return json({ error: 'bad poll' }, 400)
    return await results(id, Number(url.searchParams.get('n')) || 2, await voterFrom(false))
  } catch {
    return json({ error: 'Internal server error' }, 500)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const origin = (await headers()).get('origin')
    if (origin && new URL(origin).host !== new URL(request.url).host) return json({ error: 'forbidden' }, 403)
    const body = (await request.json().catch((): null => null)) as { id?: unknown; choice?: unknown; n?: unknown } | null
    const id = cleanPollId(body?.id)
    const n = Number(body?.n) || 2
    const choice = cleanChoice(body?.choice, n)
    if (!id || choice === null) return json({ error: 'bad vote' }, 400)
    const voter = await voterFrom(true)
    if (voter) await castVote(await pollDb(), id, voter, choice, new Date().toISOString())
    return await results(id, n, voter)
  } catch {
    return json({ error: 'Internal server error' }, 500)
  }
}
