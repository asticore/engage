import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SectionNode } from '@/lib/sectionTree'

const nav = vi.hoisted(() => ({ path: null as string | null }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }))
vi.mock('@/admin/i18n/AdminUiProvider', () => ({
  useAdminT: () => (key: string) => key,
}))

import { normaliseConsentConfig } from '@/features/consent/config'
import { ConsentManager, isEditorCanvasPath } from '@/features/consent/ConsentManager'
import { comparableTree } from '@/views/visualEditor/blockDraft'
import { isDirtyAfterRestore } from '@/views/visualEditor/dirtyState'
import { NavigatorPanel } from '@/views/visualEditor/NavigatorPanel'
import { SaveAsTemplateDialog } from '@/views/visualEditor/SaveAsTemplate'

const section = (id: string, text: string): SectionNode =>
  ({ id, blockType: 'section', columns: [{ blocks: [{ id: `${id}-h`, blockType: 'element', elementType: 'heading', props: { text } }] }] }) as unknown as SectionNode

afterEach(() => cleanup())

describe('dirty state after undo', () => {
  const saved = [section('a', 'one')]
  const savedTree = comparableTree(saved)
  it('is clean when the restored tree equals the saved tree', () => {
    expect(isDirtyAfterRestore(saved, savedTree, false)).toBe(false)
  })
  it('is dirty when the tree differs', () => {
    expect(isDirtyAfterRestore([section('a', 'two')], savedTree, false)).toBe(true)
  })
  it('stays dirty when locks / page settings changed or the document has not loaded', () => {
    expect(isDirtyAfterRestore(saved, savedTree, true)).toBe(true)
    expect(isDirtyAfterRestore(saved, null, false)).toBe(true)
  })
})

describe('consent banner in the editor canvas', () => {
  it('recognises only the canvas route', () => {
    expect(isEditorCanvasPath('/visual-editor-canvas')).toBe(true)
    expect(isEditorCanvasPath('/visual-editor-canvas/pages/1')).toBe(true)
    expect(isEditorCanvasPath('/visual-editor-canvasx')).toBe(false)
    expect(isEditorCanvasPath('/about')).toBe(false)
    expect(isEditorCanvasPath(null)).toBe(false)
  })
})

describe('consent banner rendering', () => {
  const config = { ...normaliseConsentConfig(null, null), enabled: true, bannerTitle: 'Our cookies' }
  const mount = () => render(h(ConsentManager, { config, optIn: true, initialDecided: false }))
  it('shows on the public site and is suppressed in the canvas', () => {
    nav.path = '/about'
    mount()
    expect(screen.queryByRole('region', { name: 'Our cookies' })).not.toBeNull()
    cleanup()
    nav.path = '/visual-editor-canvas'
    mount()
    expect(screen.queryByRole('region', { name: 'Our cookies' })).toBeNull()
    nav.path = null
  })
})

describe('navigator rows', () => {
  const nodes = [section('a', 'one')]

  it('a row click only reports the selection and double-click opens the rename input', () => {
    const onSelect = vi.fn()
    render(h(NavigatorPanel, { nodes, selectedPath: null, onSelect, onRename: vi.fn(), onSetAnchor: vi.fn() }))
    const rows = document.querySelectorAll<HTMLElement>('.ve-nav__row')
    fireEvent.click(rows[0])
    expect(onSelect).toHaveBeenCalledTimes(1)
    fireEvent.doubleClick(rows[0])
    expect(document.querySelector('.ve-nav__input')).not.toBeNull()
  })

  it('selectFromNavigator no longer switches the dock to Settings', () => {
    const src = readFileSync('src/views/VisualEditor.tsx', 'utf8')
    const start = src.indexOf('const selectFromNavigator')
    const body = src.slice(start, src.indexOf('}, [setMulti])', start))
    expect(body).not.toContain('setDockTab')
  })
})

describe('Save as template dialog', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(h(SaveAsTemplateDialog, { pageBlocks: [section('a', 'one')], onClose, onSaved: vi.fn() }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
