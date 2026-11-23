import React from 'react'

import { cells, mediaOf, num, str } from './elementUtil'
import { ConfiguratorClient, ModelViewerClient, type ConfigGroup, type Hotspot } from './ThreeDClient'

type P = Record<string, unknown>

/** Only .glb and .gltf files load, whatever the address says. */
export const isModelUrl = (url: string): boolean => /\.(glb|gltf)(\?.*)?$/i.test(url)

export const ModelViewerElement: React.FC<P> = (p) => {
  const file = mediaOf(p.file) ?? mediaOf(p.url)
  if (!file || !isModelUrl(file.url)) return <p className="be-el-3d__note">Choose a GLB or glTF model to show.</p>
  const poster = mediaOf(p.poster)
  return <ModelViewerClient src={file.url} poster={poster?.url} alt={str(p.alt, '3D model')} height={Math.round(num(p.height, 480, 200, 900))} autoRotate={p.autoRotate !== false} ar={p.ar !== false} />
}

/** Lines `Group | Option | picture | price` become groups in first-seen order. Exported for tests. */
export function parseConfigurator(layers: unknown): ConfigGroup[] {
  const groups: ConfigGroup[] = []
  for (const [group, option, image, price] of cells(layers, 4)) {
    if (!group || !option) continue
    let g = groups.find((x) => x.name === group)
    if (!g) groups.push((g = { name: group, options: [] }))
    const pic = mediaOf(image || null)
    g.options.push({ name: option, image: pic?.url ?? '', price: Number.isFinite(Number(price)) ? Number(price) : 0 })
  }
  return groups.slice(0, 12).map((g) => ({ ...g, options: g.options.slice(0, 24) }))
}

export function parseHotspots(v: unknown): Hotspot[] {
  return cells(v, 3).flatMap(([x, y, label]) => {
    const px = Number(x)
    const py = Number(y)
    return label && Number.isFinite(px) && Number.isFinite(py) ? [{ x: Math.min(100, Math.max(0, px)), y: Math.min(100, Math.max(0, py)), label }] : []
  }).slice(0, 20)
}

export const ProductConfiguratorElement: React.FC<P> = (p) => {
  const groups = parseConfigurator(p.layers)
  if (groups.length === 0) return <p className="be-el-cfg__note">Add options, one per line: Group | Option | picture | price change.</p>
  return (
    <ConfiguratorClient
      title={str(p.title)}
      groups={groups}
      basePrice={num(p.basePrice, 0, 0, 1_000_000)}
      currency={str(p.currency, '$').slice(0, 4)}
      exploded={p.exploded !== false}
      hotspots={parseHotspots(p.hotspots)}
      height={Math.round(num(p.height, 420, 200, 900))}
    />
  )
}

export const THREE_D_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'model-viewer': ModelViewerElement,
  'product-configurator': ProductConfiguratorElement,
}
