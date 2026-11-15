import { describe, expect, it } from 'vitest'

import { shareHref } from '@/components/blocks/elements/Wave36Elements'
import { pinterestTagScript } from '@/features/seo/components/AnalyticsLoader'

describe('Pinterest', () => {
  it('builds a Pin it link only with an address and a picture', () => {
    expect(shareHref('pinterest', 'https://a.test/p', 'Nice', 'https://a.test/i.jpg')).toBe('https://www.pinterest.com/pin/create/button/?url=https%3A%2F%2Fa.test%2Fp&media=https%3A%2F%2Fa.test%2Fi.jpg&description=Nice')
    expect(shareHref('pinterest', 'https://a.test/p', 'Nice')).toBe('')
    expect(shareHref('pinterest', '', 'Nice', 'https://a.test/i.jpg')).toBe('')
  })
  it('writes the tag script with the id as a safe string', () => {
    const js = pinterestTagScript('2612345678901')
    expect(js).toContain('https://s.pinimg.com/ct/core.js')
    expect(js).toContain(`pintrk('load',"2612345678901");pintrk('page');`)
    expect(pinterestTagScript('1"); alert(1);//')).toContain(JSON.stringify('1"); alert(1);//'))
  })
})
