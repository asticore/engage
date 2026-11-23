import { describe, expect, it } from 'vitest'

import { isModelUrl, parseConfigurator, parseHotspots } from '@/components/blocks/elements/ThreeDElements'
import { getElementDef } from '@/lib/elements/registry'

describe('34d 3D viewer and configurator', () => {
  it('registers both elements', () => {
    expect(getElementDef('model-viewer')).toBeTruthy()
    expect(getElementDef('product-configurator')).toBeTruthy()
  })
  it('only accepts glb and gltf models', () => {
    expect(isModelUrl('/media/chair.glb')).toBe(true)
    expect(isModelUrl('https://x.test/a.gltf?v=2')).toBe(true)
    expect(isModelUrl('/media/page.html')).toBe(false)
  })
  it('groups configurator lines in first-seen order with prices', () => {
    const g = parseConfigurator('Body | Black | /media/b.png | 0\nCase | None | | 0\nBody | White | /media/w.png | 5\nCase | Armour | /media/a.png | 15')
    expect(g.map((x) => x.name)).toEqual(['Body', 'Case'])
    expect(g[0].options.map((o) => o.price)).toEqual([0, 5])
    expect(g[1].options[0].image).toBe('')
    expect(g[1].options[1].image).toBe('/media/a.png')
  })
  it('drops unsafe picture addresses and bad hotspots', () => {
    expect(parseConfigurator('A | B | javascript:alert(1) | 0')[0].options[0].image).toBe('')
    expect(parseHotspots('10 | 20 | Lens\nx | y | bad\n150 | -5 | Edge')).toEqual([{ x: 10, y: 20, label: 'Lens' }, { x: 100, y: 0, label: 'Edge' }])
  })
})
