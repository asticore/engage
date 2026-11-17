// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ refusal: null as string | null, places: [] as string[] }))

vi.mock('@/engine', () => ({ getEngine: async () => ({ findByID: async (): Promise<null> => null }) }))
vi.mock('@/features/security/authCaptcha', () => ({
  captchaFormFrom: (body: unknown) => body,
  authCaptchaRefusal: async (_engine: unknown, _form: unknown, _ip: unknown, place: string) => {
    state.places.push(place)
    return state.refusal
  },
}))
vi.mock('@/features/impersonation/policy', () => ({ refuseWhileImpersonating: (): null => null }))

import { POST } from '@/app/(engage)/api/shop-paypal-create/route'
import { CAPTCHA_PLACES } from '@/features/security/captchaPlaces'
import { resetRateLimiter } from '@/features/security/rateLimit'

const post = (body: unknown) => POST(new Request('http://localhost/api/shop-paypal-create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))

beforeEach(() => {
  resetRateLimiter()
  state.refusal = null
  state.places = []
})

describe('PayPal create asks the buy-step challenge', () => {
  it('refuses before touching the cart when the challenge fails', async () => {
    state.refusal = 'Please confirm you are not a robot.'
    const res = await post({ cartID: 1, secret: 'x', customerEmail: 'a@x.com' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Please confirm you are not a robot.' })
    expect(state.places).toEqual(['cardCheckout'])
  })

  it('goes on to the cart checks when the challenge passes or is off', async () => {
    const res = await post({ cartID: 1, secret: 'x', customerEmail: 'a@x.com' })
    expect(res.status).toBe(404) // the stubbed engine has no cart
  })

  it('names the shared place for card and PayPal', () => {
    expect(CAPTCHA_PLACES.find((p) => p.id === 'cardCheckout')?.label).toBe('Checkout: card and PayPal payment')
  })
})
