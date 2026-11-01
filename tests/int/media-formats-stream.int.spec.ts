// @vitest-environment node
// Task 12b: picture and video output formats, the per-file override in the
// delivery URL, the Stream conversion steps (fake Stream API) and the video
// link rules. Storage is mocked; nothing reaches R2, D1 or Cloudflare.
import { describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({
  putMediaObject: vi.fn(async () => undefined),
  putOriginalIfMissing: vi.fn(async () => true),
  readMediaObject: vi.fn(async () => null as null | { data: Uint8Array; contentType: string }),
  deleteMediaObject: vi.fn(async () => undefined),
}))
vi.mock('@/localapi/storage', () => storage)

import { fileTypeLabel, effectivePictureFormat, effectiveVideoFormat, pictureFormatOf, siteImageFormat } from '@/features/media/formats'
import { chooseOutputMimeType, resolveOptimiseSettings, settingsForFile } from '@/features/media/optimise'
import { resolveMediaConfig } from '@/features/media/config'
import { buildImageUrl, deliveryFormatFor } from '@/features/media/url'
import { advanceVideoConversion, streamCredentials, type StreamFetch } from '@/features/media/stream'
import { absoluteMediaUrl, optimiseStoredVideo } from '@/features/media/videoOptimise'
import { DISABLED_CONFIG } from '@/features/media/url'
import type { MediaConfig } from '@/features/media/types'

const cloudflare: MediaConfig = {
  ...DISABLED_CONFIG,
  enabled: true,
  provider: 'cloudflare-resizing',
  format: 'webp',
  quality: 80,
  maxWidth: 2000,
  maxHeight: 2000,
  responsiveWidths: [],
  deliveryPrefix: '',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('picture and video format choices', () => {
  it('keeps the WebP and AVIF switches when the site format says switches, and uses an explicit choice otherwise', () => {
    const switches = resolveMediaConfig({ optimisation: { provider: 'cloudflare-resizing', convertToWebp: true, convertToAvif: true, outputImageFormat: 'switches' } }, true)
    expect(switches.format).toBe('auto')
    const jpeg = resolveMediaConfig({ optimisation: { provider: 'cloudflare-resizing', convertToWebp: true, outputImageFormat: 'jpeg' } }, true)
    expect(jpeg.format).toBe('jpeg')
    const jxl = resolveMediaConfig({ optimisation: { provider: 'cloudflare-resizing', convertToWebp: true, outputImageFormat: 'jxl' } }, true)
    expect(jxl.format).toBe('original')
  })

  it('maps the site format and file overrides; JPEG XL and videos keep the stored format', () => {
    expect(siteImageFormat('jxl', true, true)).toBe('original')
    expect(siteImageFormat('switches', false, true)).toBe('avif')
    expect(effectivePictureFormat('default', 'webp')).toBe('webp')
    expect(effectivePictureFormat('jpeg', 'webp')).toBe('jpeg')
    expect(effectivePictureFormat('jxl', 'webp')).toBe('original')
    expect(effectivePictureFormat('mp4', 'webp')).toBe('webp')
    expect(pictureFormatOf(undefined)).toBeNull()
  })

  it('puts a file override into the delivery URL and leaves other files on the site format', () => {
    const plain = { url: 'https://media.example.com/a.png', filename: 'a.png', mimeType: 'image/png', width: 800, height: 600 }
    expect(buildImageUrl(plain, cloudflare)).toContain('/cdn-cgi/image/width=2000,height=2000,fit=scale-down,quality=80,format=webp,metadata=copyright/a.png')
    const jpeg = { ...plain, outputFormat: 'jpeg' }
    expect(deliveryFormatFor(jpeg, cloudflare)).toBe('jpeg')
    expect(buildImageUrl(jpeg, cloudflare)).toContain(',format=jpeg,')
    const original = { ...plain, outputFormat: 'original' }
    expect(buildImageUrl(original, cloudflare)).not.toMatch(/format=/)
    const video = { url: 'https://media.example.com/v.mp4', mimeType: 'video/mp4', outputFormat: 'mp4' }
    expect(buildImageUrl(video, cloudflare)).toBe(video.url)
  })

  it('writes the chosen format for Optimise and only overrides the site setting for pictures', () => {
    const settings = resolveOptimiseSettings({ optimisation: { provider: 'cloudflare-images', convertToWebp: true, outputImageFormat: 'avif' } })
    expect(chooseOutputMimeType('image/jpeg', settings)).toBe('image/avif')
    expect(chooseOutputMimeType('image/jpeg', settingsForFile(settings, 'original'))).toBe('image/jpeg')
    expect(chooseOutputMimeType('image/jpeg', settingsForFile(settings, 'webp'))).toBe('image/webp')
    expect(chooseOutputMimeType('image/jpeg', settingsForFile(settings, 'default'))).toBe('image/avif')
    const legacy = resolveOptimiseSettings({ optimisation: { provider: 'cloudflare-images', convertToWebp: true } })
    expect(chooseOutputMimeType('image/png', legacy)).toBe('image/webp')
  })

  it('picks the video format from the file first, then the site, and labels files for the gallery', () => {
    expect(effectiveVideoFormat('webm', 'mp4')).toBe('webm')
    expect(effectiveVideoFormat('default', 'mp4')).toBe('mp4')
    expect(effectiveVideoFormat(undefined, undefined)).toBe('original')
    expect(fileTypeLabel('video/link')).toBe('Video link')
    expect(fileTypeLabel('image/webp')).toBe('WebP')
  })

  it('reads Stream credentials only when both the account ID and the token are set', () => {
    expect(streamCredentials({ streamAccountId: 'acc', streamApiToken: 'tok' })).toEqual({ accountId: 'acc', token: 'tok' })
    expect(streamCredentials({ streamAccountId: 'acc', streamApiToken: '' })).toBeNull()
    expect(streamCredentials(undefined)).toBeNull()
  })
})

describe('Stream conversion steps', () => {
  const creds = { accountId: 'acc', token: 'tok' }
  const calls: string[] = []

  const stream = (responses: Array<Record<string, unknown> | 'fail'>): StreamFetch =>
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url.replace('https://api.cloudflare.com/client/v4/accounts/acc/stream', '')}`)
      const next = responses.shift()
      if (next === 'fail' || next === undefined) return new Response('nope', { status: 500 })
      return json({ success: true, result: next })
    }) as unknown as StreamFetch

  it('copies, waits for processing, asks for an MP4 and then reports the download when ready', async () => {
    const fetchImpl = stream([
      { uid: 'vid1' },
      { uid: 'vid1', readyToStream: false, status: { state: 'inprogress' } },
      { uid: 'vid1', readyToStream: true, status: { state: 'ready' } },
      { default: { status: 'inprogress' } },
      { default: { status: 'ready', url: 'https://customer.cloudflarestream.com/vid1/downloads/default.mp4' } },
    ])
    const src = 'https://media.example.com/clip.mov'
    const one = await advanceVideoConversion(fetchImpl, creds, { conversionStatus: null, streamUid: null }, src, 'clip.mov')
    expect(one).toEqual({ status: 'copying', uid: 'vid1' })
    const two = await advanceVideoConversion(fetchImpl, creds, { conversionStatus: 'copying', streamUid: 'vid1' }, src, 'clip.mov')
    expect(two).toEqual({ status: 'copying', uid: 'vid1' })
    const three = await advanceVideoConversion(fetchImpl, creds, { conversionStatus: 'copying', streamUid: 'vid1' }, src, 'clip.mov')
    expect(three).toEqual({ status: 'downloading', uid: 'vid1' })
    const four = await advanceVideoConversion(fetchImpl, creds, { conversionStatus: 'downloading', streamUid: 'vid1' }, src, 'clip.mov')
    expect(four).toEqual({ status: 'ready', uid: 'vid1', mp4Url: 'https://customer.cloudflarestream.com/vid1/downloads/default.mp4' })
    expect(calls[0]).toBe('POST /copy')
  })

  it('turns a Stream error into a failed step that names the reason', async () => {
    const fetchImpl = stream(['fail'])
    const step = await advanceVideoConversion(fetchImpl, creds, { conversionStatus: null }, 'https://media.example.com/x.mp4', 'x.mp4')
    expect(step.status).toBe('failed')
  })

  it('keeps the uploaded file when the MP4 is not smaller, and replaces it when it is', async () => {
    const update = vi.fn(async () => undefined)
    const big = new Uint8Array(900)
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('.mp4')) return new Response(big, { status: 200 })
      return json({ success: true, result: {} })
    }) as unknown as StreamFetch
    const doc = {
      id: 7,
      filename: 'clip.mov',
      mimeType: 'video/quicktime',
      filesize: 500,
      url: 'https://media.example.com/clip.mov',
      outputFormat: 'mp4',
      conversionStatus: 'downloading',
      streamUid: 'vid1',
    }
    const readyStream = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('.mp4')) return new Response(big, { status: 200 })
      if ((init?.method ?? 'GET') === 'GET' && url.endsWith('/downloads')) {
        return json({ success: true, result: { default: { status: 'ready', url: 'https://customer.cloudflarestream.com/vid1/downloads/default.mp4' } } })
      }
      return json({ success: true, result: {} })
    }) as unknown as StreamFetch
    const kept = await optimiseStoredVideo(doc, { outputFormat: 'mp4' }, creds, 'https://site.example', { update, fetch: readyStream })
    expect(kept.status).toBe('kept')
    expect(storage.putMediaObject).not.toHaveBeenCalled()

    const smaller = new Uint8Array(100)
    const shrinking = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('.mp4')) return new Response(smaller, { status: 200 })
      if ((init?.method ?? 'GET') === 'GET' && url.endsWith('/downloads')) {
        return json({ success: true, result: { default: { status: 'ready', url: 'https://customer.cloudflarestream.com/vid1/downloads/default.mp4' } } })
      }
      return json({ success: true, result: {} })
    }) as unknown as StreamFetch
    const put = vi.fn(async (..._args: unknown[]) => undefined)
    const io = { read: vi.fn(async () => null), put, putOriginalIfMissing: vi.fn(async () => true) }
    const done = await optimiseStoredVideo(doc, { outputFormat: 'mp4' }, creds, 'https://site.example', { update, fetch: shrinking, io })
    expect(done.status).toBe('optimised')
    expect(done.after).toBe(100)
    expect(put).toHaveBeenCalledWith('clip.mov', smaller, 'video/mp4')
    expect(fetchImpl).toBeDefined()
  })

  it('explains what is needed instead of calling Stream: no token, a WebM choice, a link, or no format', async () => {
    const update = vi.fn(async () => undefined)
    const base = { id: 1, filename: 'v.mp4', mimeType: 'video/webm', filesize: 10, url: 'https://media.example.com/v.webm' }
    const noStream = await optimiseStoredVideo({ ...base, outputFormat: 'mp4' }, {}, null, 'https://site.example', { update, fetch: vi.fn() as never })
    expect(noStream.status).toBe('needs-stream')
    const webm = await optimiseStoredVideo({ ...base, outputFormat: 'webm' }, {}, creds, 'https://site.example', { update, fetch: vi.fn() as never })
    expect(webm.status).toBe('skipped')
    const none = await optimiseStoredVideo({ ...base, outputFormat: 'default' }, {}, creds, 'https://site.example', { update, fetch: vi.fn() as never })
    expect(none.status).toBe('skipped')
    const link = await optimiseStoredVideo({ ...base, mimeType: 'video/link', outputFormat: 'mp4' }, { outputFormat: 'mp4' }, creds, 'https://site.example', { update, fetch: vi.fn() as never })
    expect(link.status).toBe('skipped')
    expect(update).not.toHaveBeenCalled()
  })

  it('makes a site path absolute with the request origin and leaves other addresses alone', () => {
    expect(absoluteMediaUrl('/media/a.mp4', 'https://site.example')).toBe('https://site.example/media/a.mp4')
    expect(absoluteMediaUrl('https://cdn.example/a.mp4', 'https://site.example')).toBe('https://cdn.example/a.mp4')
    expect(absoluteMediaUrl('a.mp4', 'https://site.example')).toBeNull()
  })

  it('does not change the settings of a file with no override', () => {
    const settings = resolveOptimiseSettings({ optimisation: { provider: 'cloudflare-images' } })
    expect(settingsForFile(settings, 'default')).toBe(settings)
  })
})
