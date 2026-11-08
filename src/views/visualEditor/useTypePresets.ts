import { useEffect, useState } from 'react'

export type TypePresetOption = { id: string; name: string }

const ID = /^[a-z0-9-]{1,32}$/

/** Keeps only entries with a slug id and a string name. Anything else gives []. */
export function parseTypePresets(json: unknown): TypePresetOption[] {
  const list = (json as { typePresets?: unknown } | null)?.typePresets
  if (!Array.isArray(list)) return []
  const out: TypePresetOption[] = []
  for (const item of list) {
    const { id, name } = (item ?? {}) as { id?: unknown; name?: unknown }
    if (typeof id === 'string' && ID.test(id)) out.push({ id, name: typeof name === 'string' && name.trim() ? name : id })
  }
  return out
}

let cache: Promise<TypePresetOption[]> | null = null

/** One fetch per page load (names only, same public route the other style pickers use). */
export function loadTypePresets(fetchImpl: typeof fetch = fetch): Promise<TypePresetOption[]> {
  if (!cache) {
    cache = fetchImpl('/api/theme-styles-public', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then(parseTypePresets)
      .catch((): TypePresetOption[] => [])
  }
  return cache
}

/** Test hook: forget the cached result. */
export function resetTypePresetsCache(): void {
  cache = null
}

/** Theme typography presets for the Design panel; [] until loaded or on any failure. */
export function useTypePresets(): TypePresetOption[] {
  const [presets, setPresets] = useState<TypePresetOption[]>([])
  useEffect(() => {
    let live = true
    void loadTypePresets().then((p) => {
      if (live) setPresets(p)
    })
    return () => {
      live = false
    }
  }, [])
  return presets
}
