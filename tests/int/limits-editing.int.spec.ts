import { describe, expect, it, vi } from 'vitest'

import { hashReviewedContent, normaliseReviewedValue } from '@/features/approval/stateMachine'
import { mergeEditPrefs, saveEditPrefs } from '@/admin/editPrefs'
import { cardDelta, revealCardForField, getOpenIds } from '@/admin/components/collapseStore'
import { copyNodeLocks, pairLockKeys, parseLocks } from '@/features/roles/locks'
import { ELEMENTS } from '@/lib/elements/registry'
import { elementStyleKeys, restoreStyleProps } from '@/features/roles/elementStyleKeys'
import { mediaProblems } from '@/features/customFields/serverHook'
import type { CustomFieldDef } from '@/fields/customFields/types'

/** Known-limit fixes from the 1 Nov sweep of Editing, Approval and roles, Custom fields, Admin and Locks. */

describe('approval: the reviewed-content hash agrees between the form and the database', () => {
  it('treats an empty text, a missing key and null alike', () => {
    expect(normaliseReviewedValue('')).toBeNull()
    expect(normaliseReviewedValue(undefined)).toBeNull()
    expect(hashReviewedContent({ title: 'Spring', seo: { description: '', title: 'x' } })).toBe(
      hashReviewedContent({ title: 'Spring', seo: { title: 'x', description: null } }),
    )
  })

  it('reads numbers sent as text and relations sent as objects the same as the stored values', () => {
    expect(normaliseReviewedValue('12')).toBe(12)
    expect(normaliseReviewedValue({ id: 4, name: 'Ann' })).toEqual({ id: 4, name: 'Ann' })
    expect(normaliseReviewedValue({ id: 4 })).toBe(4)
    expect(hashReviewedContent({ title: 'a', layout: [{ id: 'n1', columns: '2' }] })).toBe(hashReviewedContent({ title: 'a', layout: [{ id: 'n1', columns: 2 }] }))
  })

  it('still changes when the content really changes', () => {
    expect(hashReviewedContent({ title: 'a' })).not.toBe(hashReviewedContent({ title: 'b' }))
  })
})

describe('admin: card state is saved as a change, so two tabs keep each other changes', () => {
  it('sends only the cards changed since the last save', () => {
    expect(cardDelta(new Set(['a', 'b']), new Set(['c']))).toEqual({ set: ['a', 'b'], unset: ['c'] })
  })

  it('merges a delta into the stored set', () => {
    expect(mergeEditPrefs({ open: ['a', 'b'] }, { set: ['c'], unset: ['a'] })).toEqual({ open: ['b', 'c'] })
  })

  it('keeps up to 500 cards', () => {
    const many = Array.from({ length: 600 }, (_, i) => `card-${i}`)
    expect(mergeEditPrefs({ open: [] }, { set: many }).open).toHaveLength(500)
  })

  it('saveEditPrefs applies a delta to what is stored, not to an empty set', async () => {
    const stored = { id: 9, user: [7], value: { open: ['keep', 'drop'] } }
    const update = vi.fn(async () => ({}))
    const engine = {
      find: async () => ({ docs: [stored] }),
      update,
      create: vi.fn(),
    }
    const result = await saveEditPrefs(engine as never, { id: 7 } as never, { set: ['new'], unset: ['drop'] })
    expect(result).toEqual({ open: ['keep', 'new'] })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 9, data: { value: { open: ['keep', 'new'] } } }))
  })

  it('opens the card that holds a field with an error', () => {
    document.body.innerHTML = `
      <section data-collapse-id="seo-card"><input name="seo.title" /></section>
      <section data-collapse-id="main-fields"><input name="title" /></section>`
    expect(revealCardForField('seo.title')).toEqual(['seo-card'])
    expect(getOpenIds()).toContain('seo-card')
    expect(revealCardForField('nothing-here')).toEqual([])
    document.body.innerHTML = ''
  })
})

describe('locks: a template keeps its section locks when a page is made from it', () => {
  const template = [
    { _id: 'a1', blockType: 'section', columns: [{ _id: 'c1', blocks: [{ _id: 'e1', blockType: 'element' }] }] },
    { _id: 'a2', blockType: 'section' },
  ]
  const copies = [
    { _id: 'x1', blockType: 'section', columns: [{ _id: 'y1', blocks: [{ _id: 'z1', blockType: 'element' }] }] },
    { _id: 'x2', blockType: 'section' },
  ]

  it('pairs each template node key with the key of the copy at the same place', () => {
    expect(pairLockKeys(template, copies)).toEqual([
      ['a1', 'x1'],
      ['c1', 'y1'],
      ['e1', 'z1'],
      ['a2', 'x2'],
    ])
  })

  it('copies node locks onto the new keys and leaves the document lock behind', () => {
    const source = parseLocks({
      document: { mode: 'full', unlockRoles: [], editableProps: [] },
      nodes: { a2: { mode: 'structure', unlockRoles: ['editor'], editableProps: ['text'] } },
    })
    const result = copyNodeLocks(source, pairLockKeys(template, copies))
    expect(result.document).toBeUndefined()
    expect(Object.keys(result.nodes)).toEqual(['x2'])
    expect(result.nodes.x2.mode).toBe('structure')
  })
})

describe('editing: a text-only save keeps the styling props of an element', () => {
  const withColour = ELEMENTS.find((def) => def.fields.some((field) => field.type === 'color'))

  it('lists the colour props of an element as styling', () => {
    expect(withColour).toBeDefined()
    const colourNames = withColour!.fields.filter((field) => field.type === 'color').map((field) => field.name)
    expect(elementStyleKeys(withColour!.type)).toEqual(expect.arrayContaining(colourNames))
  })

  it('puts the stored styling back and keeps the text the user sent', () => {
    const merged = restoreStyleProps({ text: 'New words', color: '#ff0000' }, { text: 'Old', color: '#000000' }, ['color'])
    expect(merged).toEqual({ text: 'New words', color: '#000000' })
    expect(restoreStyleProps({ text: 'x', color: '#f00' }, { text: 'y' }, ['color'])).toEqual({ text: 'x' })
  })

  it('has no styling keys for an unknown element type', () => {
    expect(elementStyleKeys('no-such-element')).toEqual([])
  })
})

describe('custom fields: picture and file fields are checked on the server', () => {
  const defs: CustomFieldDef[] = [
    { name: 'hero', type: 'image', label: 'Hero' } as CustomFieldDef,
    { name: 'brochure', type: 'file', label: 'Brochure' } as CustomFieldDef,
    { name: 'shots', type: 'gallery', label: 'Shots' } as CustomFieldDef,
  ]
  const library: Record<number, string> = { 1: 'image/png', 2: 'application/pdf', 3: 'image/jpeg' }
  const engine = {
    find: async (args: Record<string, unknown>) => {
      const ids = ((args.where as { id: { in: number[] } }).id.in)
      return { docs: ids.filter((id) => id in library).map((id) => ({ id, mimeType: library[id] })) }
    },
  }

  it('accepts a picture for an image field, any file for a file field and pictures for a gallery', async () => {
    expect(await mediaProblems(defs, { hero: 1, brochure: 2, shots: [3] }, engine)).toEqual([])
  })

  it('refuses a non-picture in an image field and a non-picture in a gallery', async () => {
    const problems = await mediaProblems(defs, { hero: 2, shots: [1, 2] }, engine)
    expect(problems.map((p) => p.path)).toEqual(['hero', 'shots'])
  })

  it('refuses media that is not in the library', async () => {
    const problems = await mediaProblems(defs, { brochure: 99 }, engine)
    expect(problems).toEqual([{ path: 'brochure', message: 'must be a media item that exists in the media library' }])
  })

  it('skips the check for web addresses and when there is no engine', async () => {
    expect(await mediaProblems(defs, { hero: 'https://example.com/a.png' }, engine)).toEqual([])
    expect(await mediaProblems(defs, { hero: 99 }, null)).toEqual([])
  })
})
