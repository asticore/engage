// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { isPinimgUrl, pinApiUrl, pinIdFromAddress, pinImageFromApi } from '@/features/socialFeeds/pinterestImport'

describe('Pinterest import helpers', () => {
  it('reads the pin id from pin addresses and refuses anything else', () => {
    expect(pinIdFromAddress('https://www.pinterest.com/pin/123456789012/')).toBe('123456789012')
    expect(pinIdFromAddress('https://uk.pinterest.com/pin/my-title--123456789012')).toBe('123456789012')
    expect(pinIdFromAddress('http://www.pinterest.com/pin/123456789012/')).toBe('')
    expect(pinIdFromAddress('https://evil.example/pin/123456789012/')).toBe('')
    expect(pinIdFromAddress('https://www.pinterest.com.evil.example/pin/123456789012/')).toBe('')
    expect(pinIdFromAddress('https://www.pinterest.com/someone/board/')).toBe('')
    expect(pinApiUrl('123456789012')).toBe('https://api.pinterest.com/v5/pins/123456789012')
  })

  it('only accepts pictures on the Pinterest image host', () => {
    expect(isPinimgUrl('https://i.pinimg.com/originals/a/b.jpg')).toBe(true)
    expect(isPinimgUrl('https://pinimg.com.evil.example/a.jpg')).toBe(false)
    expect(isPinimgUrl('http://i.pinimg.com/a.jpg')).toBe(false)
  })

  it('picks the originals picture from a pin answer, else a smaller one', () => {
    const both = JSON.stringify({ media: { images: { '600x': { url: 'https://i.pinimg.com/600x/a.jpg' }, originals: { url: 'https://i.pinimg.com/originals/a.jpg' } } } })
    expect(pinImageFromApi(both)).toBe('https://i.pinimg.com/originals/a.jpg')
    const foreign = JSON.stringify({ media: { images: { originals: { url: 'https://evil.example/a.jpg' }, '600x': { url: 'https://i.pinimg.com/600x/a.jpg' } } } })
    expect(pinImageFromApi(foreign)).toBe('https://i.pinimg.com/600x/a.jpg')
    expect(pinImageFromApi('nope')).toBe('')
  })
})
