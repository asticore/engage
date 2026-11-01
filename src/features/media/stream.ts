/**
 * MP4 conversion of uploaded videos through Cloudflare Stream (Task 12b).
 *
 * Workers cannot transcode video, so the work is done by Stream. One Optimise
 * press moves a video one step, and the step is stored on the media row
 * (`conversion_status`, `stream_uid`) so the next press picks it up:
 *
 *   none        -> copy the file into Stream                 -> copying
 *   copying     -> wait until Stream has processed it, then
 *                  ask for an MP4 download                    -> downloading
 *   downloading -> when Stream has the MP4, fetch it, save it
 *                  over the uploaded file (only when smaller),
 *                  delete the Stream copy                     -> done | kept
 *
 * The uploaded file stays in place until the MP4 is fetched, so a failed step
 * never leaves the video missing. Everything here takes `fetch` as an argument
 * so the steps can be tested without Cloudflare.
 */

export type StreamCredentials = { accountId: string; token: string }

export type StreamFetch = (url: string, init?: RequestInit) => Promise<Response>

export type StreamStep =
  | { status: 'copying'; uid: string }
  | { status: 'downloading'; uid: string }
  | { status: 'ready'; uid: string; mp4Url: string }
  | { status: 'failed'; reason: string; uid?: string }

const API = 'https://api.cloudflare.com/client/v4'

export class StreamError extends Error {}

/** The Stream account id and token, when both are filled in. Absent means video conversion is not available. */
export function streamCredentials(video: { streamAccountId?: unknown; streamApiToken?: unknown } | null | undefined): StreamCredentials | null {
  const accountId = typeof video?.streamAccountId === 'string' ? video.streamAccountId.trim() : ''
  const token = typeof video?.streamApiToken === 'string' ? video.streamApiToken.trim() : ''
  return accountId && token ? { accountId, token } : null
}

async function call<T>(
  fetchImpl: StreamFetch,
  creds: StreamCredentials,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetchImpl(`${API}/accounts/${encodeURIComponent(creds.accountId)}/stream${path}`, {
    method,
    headers: {
      authorization: `Bearer ${creds.token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = (await response.json().catch((): null => null)) as
    | { success?: boolean; result?: T; errors?: { message?: string }[] }
    | null
  if (!response.ok || !json || json.success === false) {
    const message = json?.errors?.[0]?.message
    throw new StreamError(message ? `Cloudflare Stream said: ${message}` : `Cloudflare Stream answered ${response.status}.`)
  }
  return json.result as T
}

type StreamVideo = { uid: string; readyToStream?: boolean; status?: { state?: string } }
type StreamDownload = { default?: { status?: string; url?: string } }

/**
 * One step of the conversion. `sourceUrl` must be an address Stream can fetch
 * (the public address of the uploaded video). `current` is the stored state.
 */
export async function advanceVideoConversion(
  fetchImpl: StreamFetch,
  creds: StreamCredentials,
  current: { conversionStatus?: string | null; streamUid?: string | null },
  sourceUrl: string,
  name: string,
): Promise<StreamStep> {
  const uid = current.streamUid ?? ''
  try {
    if (!uid || (current.conversionStatus !== "copying" && current.conversionStatus !== "downloading")) {
      const copied = await call<StreamVideo>(fetchImpl, creds, 'POST', '/copy', { url: sourceUrl, meta: { name } })
      return { status: 'copying', uid: copied.uid }
    }

    if (current.conversionStatus === 'copying') {
      const video = await call<StreamVideo>(fetchImpl, creds, 'GET', `/${encodeURIComponent(uid)}`)
      if (video.status?.state === 'error') return { status: 'failed', reason: 'Stream could not read this video.', uid }
      if (!video.readyToStream) return { status: 'copying', uid }
      await call<StreamDownload>(fetchImpl, creds, 'POST', `/${encodeURIComponent(uid)}/downloads`)
      return { status: 'downloading', uid }
    }

    const downloads = await call<StreamDownload>(fetchImpl, creds, 'GET', `/${encodeURIComponent(uid)}/downloads`)
    const mp4 = downloads.default
    if (mp4?.status === 'error') return { status: 'failed', reason: 'Stream could not make the MP4.', uid }
    if (mp4?.status === 'ready' && mp4.url) return { status: 'ready', uid, mp4Url: mp4.url }
    return { status: 'downloading', uid }
  } catch (error) {
    const reason = error instanceof StreamError ? error.message : 'Stream could not be reached. Try again.'
    return { status: 'failed', reason, uid: uid || undefined }
  }
}

/** Deletes the Stream copy once it is no longer needed. Failures are ignored: the copy is only a cost, not a problem for the site. */
export async function deleteStreamCopy(fetchImpl: StreamFetch, creds: StreamCredentials, uid: string): Promise<void> {
  await call<unknown>(fetchImpl, creds, 'DELETE', `/${encodeURIComponent(uid)}`).catch((): null => null)
}
