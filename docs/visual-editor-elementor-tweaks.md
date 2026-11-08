# Visual editor – Elementor-parity tweaks (task list)

Review of `src/views/VisualEditor.tsx` + `src/views/visualEditor/*` against how Elementor's editor behaves.
The editor already covers most of Elementor's surface (section/column tree, responsive overrides, hover/focus
states, navigator with drag/rename/hide/anchor, element library with search/favourites/recents, "/" quick
insert, inline text editing, copy/paste + copy/paste style, undo/redo, context menu, templates, locks,
local draft recovery, translate mode). The tasks below are the gaps and bugs found. Each task is self-contained.

## Conventions for every task

- Tree mutations go through `applyBlocks(change, key?)` in `src/views/VisualEditor.tsx`. It enforces the
  translate-mode guard, pushes undo history and sets `dirty`. Do not call `setBlocks` + `pushHistory` by hand.
- Lock checks: `lockedOut(path)` before editing a node, `insertBlocked(containerPath)` before inserting.
- Style edits require `userPermissions?.canEditStyle`.
- Paths: `NodePath` = number[]. Odd length = node, even length = column (`isColumnPath`).
- New UI text: add an English key to `src/features/uiStrings/keys.ts` and read it with `t('key')`
  (`useAdminT()`). Other locale dictionaries fall back to English; do not edit them.
- Keyboard shortcuts: `resolveShortcut()` in `src/views/visualEditor/useEditorShortcuts.ts`. Any key it
  resolves is automatically forwarded from the canvas iframe (`CanvasFrame.tsx` line ~156), so no frame change
  is needed for new shortcuts.
- Tests: vitest, `tests/int/*.int.spec.ts` (see `tests/int/visual-editor-history-clipboard.int.spec.ts`,
  `tests/int/responsive-editing.int.spec.ts`). Run one file: `pnpm vitest run --config ./vitest.config.mts tests/int/<file>`.
  Put pure logic in a pure helper module so it can be unit-tested without React.
- Before finishing: `pnpm lint` and the touched test files must pass.

Model hint per task: **Haiku** = mechanical, fully specified. **Sonnet** = needs reading surrounding code / design choices.

---

## P0 – bugs

### VE-01 · Paste style bypasses locks/translate/permissions and corrupts cross-device pastes — Haiku

**Elementor behaviour:** Right-click → Paste Style copies all style settings (every breakpoint) onto the target; it is one undo step and respects permissions.

**Problem** (`src/views/VisualEditor.tsx`, `pasteStyle`, ~line 905):
1. Calls `setBlocks` + `pushHistory` directly → skips `applyBlocks` (translate-mode guard), skips `lockedOut(path)`, skips `canEditStyle`.
2. When copy device ≠ current device it writes `design[sourceDevice] = sourceDesign` — e.g. copied on desktop, pasted while previewing mobile → stores a junk `design.desktop` key; copied on mobile, pasted on desktop → nests the *whole* design (incl. its own `tablet`/`mobile`) under `design.mobile`. `DeviceOverride` only accepts `RESPONSIVE_KEYS`.
3. History key `'pasteStyle'` coalesces two pastes on different nodes within 800 ms into one undo step.
4. Copies the source's `anchorId` → duplicate HTML ids.

**Do:**
1. Create pure helper `applyPastedStyle(target: BlockStyle | undefined, source: BlockStyle): BlockStyle` in `src/views/visualEditor/editorClipboard.ts`: returns `{ ...source, anchorId: target?.anchorId }` with `anchorId` removed when undefined. Ignore the clipboard `device` field entirely (the copied design already holds all breakpoints, same as Elementor).
2. Rewrite `pasteStyle`:
   ```ts
   if (!path || path.length === 0) return
   if (!userPermissions?.canEditStyle) { flashNotice('Your role cannot edit styles.'); return }
   if (lockedOut(path)) return
   const result = await readStyleClipboard(); if (result.ok === false) { flashNotice(result.error); return }
   const changed = applyBlocks((prev) => updateNode(prev, path, (node) => ({ ...node, design: applyPastedStyle(node.design, result.design as BlockStyle) })))
   if (changed) flashNotice('Style pasted')
   ```
   No history key (each paste = own undo step). Remove `device` from the deps if unused; add `userPermissions`, `lockedOut`, `applyBlocks`.
3. Keep `serializeStyle(design, device)` signature as is (backward-compatible clipboard format).

**Accept:** paste on locked node shows lock notice and changes nothing; paste in translate mode does nothing; paste across devices produces `design` equal to source design (plus target anchorId); two quick pastes = two undo steps.
**Tests:** add cases for `applyPastedStyle` to `tests/int/visual-editor-history-clipboard.int.spec.ts`.

### VE-02 · Duplicate / paste / template insert duplicate `anchorId` (CSS ID) — Haiku

**Elementor behaviour:** CSS ID must be unique; Elementor warns. Duplicating here silently creates two elements with the same `id`, which breaks anchor links (`#contact`) and the scoped CSS that uses `#id`.

**Do:**
1. In `src/views/visualEditor/treeOps.ts` add pure `uniquifyAnchors(existing: SectionNode[], incoming: SectionNode[]): SectionNode[]`:
   - Collect every `design.anchorId` in `existing` (walk nodes, `columns[].blocks`, and column `design.anchorId`).
   - Walk `incoming` (deep, same shape); for any anchor already taken, rename to `${id}-2`, `-3`, … first free; add each final id to the taken set (so two incoming nodes don't collide either).
   - Return new objects; never mutate.
2. Apply it in `VisualEditor.tsx`: `duplicateBlock` (wrap the cloned node), `pasteAt` (the nodes from `withFreshIds`), `insertTemplateAt`, `importAppend`, `aiInsertAtEnd`. Pass the current tree (`prev`) as `existing`. Do **not** apply to `cutNode`→paste of the same node after it was removed (it is no longer in the tree, so it keeps its id naturally) or to `moveBlockTo`.
3. In `src/views/visualEditor/designWarnings.ts` add a warning "Duplicate CSS ID “x”" for any anchor used more than once (follow existing warning shape in that file).

**Accept:** duplicate a block with anchor `contact` → copy has `contact-2`; original unchanged; warnings list flags a hand-made duplicate.
**Tests:** `uniquifyAnchors` cases (nested section, column-level anchor, two incoming collide).

### VE-03 · Legacy "hide on desktop / hide on mobile" makes blocks vanish in the editor — Haiku

**Elementor behaviour:** a widget hidden on the current device is shown faded in the editor so it can still be selected.

**Problem:** `blockStyleCss()` in `src/lib/blockStyle.ts` (~line 1291) honours `options.editor` (opacity 0.3) only for `tablet.hide` / `mobile.hide`. Legacy `hideOnMobile` and `hideOnDesktop` always emit `display:none`, so on the canvas the block disappears and cannot be clicked.

**Do:** compute `const hidden = options.editor ? 'opacity:0.3 !important' : 'display:none !important'` at the top of the function, and use it for both legacy rules (`hideOnMobile` inside `mobileDecls` → push `hidden` instead of `'display:none'`; `hideOnDesktop` rule → `${sel}{${hidden}}`). Leave non-editor output byte-identical except `!important` — check existing tests in `tests/int/responsive-editing.int.spec.ts`; if a test asserts the exact old string for the non-editor case, keep `display:none` (no `!important`) for the non-editor branch of the legacy rules.

**Accept:** in the editor at desktop width a block with `hideOnDesktop: true` is visible at 30 % opacity and selectable; live site still hides it.
**Tests:** `blockStyleCss({hideOnDesktop:true}, 'x', {editor:true})` contains `opacity:0.3`; without `editor` contains `display:none`.

### VE-04 · No concurrent-edit protection in the visual editor — Sonnet

**Elementor behaviour:** "X is currently editing this page" takeover lock with heartbeat; prevents silent overwrites.

**Problem:** the normal admin edit form mounts `EditLockBanner` (`src/admin/views/EditLockBanner.tsx`, API `src/app/(engage)/api/admin-edit-lock/route.ts`), but the visual editor does not. `save()` (~line 1216) PATCHes blindly: two tabs/users overwrite each other.

**Do:**
1. Read `EditLockBanner.tsx` and the route to understand acquire/heartbeat/release/takeover. Mount `<EditLockBanner collectionSlug={surface.slug} id={route.id} … />` in the VE top area for `surface.kind === 'collection'` (match the props `DocumentPanel.tsx` passes). If the banner reports the doc is locked by someone else and not taken over, disable Save/Publish buttons and show the banner.
2. Optimistic check in `save()`: store `doc.updatedAt` on load in a ref (`loadedUpdatedAtRef`). Before the PATCH, `GET ${apiUrl}?depth=0` and compare `updatedAt`. If newer than the ref → `window.confirm('This page was changed by someone else since you opened it. Overwrite their changes?')`; cancel aborts the save with `setSaving('idle')`. After a successful PATCH set the ref from the response (`(await res.json()).doc?.updatedAt`) — note the form-mode branch already reads `res.json()`; read the body once and reuse it.
3. Globals (`surface.kind === 'global'`): only do step 2.

**Accept:** open same page in two tabs, save in tab A, save in tab B → B asks before overwriting. Second user sees lock banner.

---

## P1 – Elementor parity

### VE-05 · Missing Elementor keyboard shortcuts — Haiku

**Elementor:** Ctrl/Cmd+S save, Ctrl+Shift+C / Ctrl+Shift+V copy/paste style, Ctrl+I navigator, Ctrl+Shift+M responsive mode, Ctrl+P toggle panel. Today Ctrl+S opens the browser's "Save page as" dialog.

**Do** (`src/views/visualEditor/useEditorShortcuts.ts`):
1. Extend `ShortcutAction` with `'save' | 'copyStyle' | 'pasteStyle' | 'navigator' | 'cycleDevice' | 'togglePanel'`.
2. In `resolveShortcut`, inside `if (mod && !k.alt)`: before the `if (k.shift) return null` line add
   `if (key === 's' && !k.shift) return 'save'`, `if (k.shift && key === 'c') return 'copyStyle'`, `if (k.shift && key === 'v') return 'pasteStyle'`, `if (k.shift && key === 'm') return 'cycleDevice'`; after it add `if (key === 'i') return 'navigator'`, `if (key === 'p') return 'togglePanel'`.
3. Add `'copyStyle','pasteStyle'` to `NEEDS_SELECTION`.
4. In `handleKey`, `save` must work even while typing in an input: move the `isEditableTarget` check below `resolveShortcut` and skip it when `action === 'save'`.
5. Add rows to `SHORTCUT_LIST` + keys in `keys.ts` (`ve.shortcut.save`, `ve.shortcut.copyStyle`, `ve.shortcut.pasteStyle`, `ve.shortcut.navigator`, `ve.shortcut.device`, `ve.shortcut.panel`).
6. Wire handlers in `VisualEditor.tsx` (`useEditorShortcuts({... handlers})`, ~line 1056):
   `save: () => void save(false)`, `copyStyle: () => selectedPath && void copyStyle(selectedPath)`, `pasteStyle: () => void pasteStyle(selectedPath)`, `navigator: () => setDockTab((t) => (t === 'navigator' ? 'elements' : 'navigator'))`, `cycleDevice: () => setDevice((d) => (d === 'desktop' ? 'tablet' : d === 'tablet' ? 'mobile' : 'desktop'))`, `togglePanel: () => setDockCollapsed((c) => !c)`. `save` is declared after the hook — move the hook call below `save` or call through a ref (`saveRef.current = save`).
7. Context-menu hints: add `hint: \`${modLabel}+Shift+C\`` / `+Shift+V` to copy/paste style items (~line 1339).

**Accept:** each shortcut works from the parent page and from inside the canvas iframe; Ctrl+S in a text field saves and does not open browser dialog.
**Tests:** extend `resolveShortcut` tests for every new combo, and that Ctrl+Shift+Z still = redo.

### VE-06 · Context menu: add Edit, Navigator, Reset style — Haiku

**Elementor:** right-click menu has Edit, Duplicate, Copy, Paste, Paste Style, Reset Style, Navigator, Save as Global, Delete.

**Do** (`VisualEditor.tsx`, items array ~line 1335 and the `onSelect` handler of `<ContextMenu>` ~line 1705):
- `{ id: 'edit', label: 'Edit' }` first → `setSelectedPath(path); setDockTab('settings')`.
- `{ id: 'navigator', label: 'Show in Navigator' }` → `setSelectedPath(path); setDockTab('navigator')`; ensure ancestors expanded via `setNavigatorExpandedState` (check `NavigatorPanel` key format, usually `pathKey(ancestorPath)` → `true`).
- `{ id: 'reset-style', label: 'Reset style', disabled: locked || !userPermissions?.canEditStyle }` after paste-style → `applyBlocks((prev) => updateNode(prev, path, (n) => ({ ...n, design: n.design?.anchorId ? { anchorId: n.design.anchorId } : undefined })))` after `lockedOut(path)` check. Then remove `design` key entirely when undefined (spread without it).
- Disable `paste-style` also when `!userPermissions?.canEditStyle`.

**Accept:** menu shows new items; Reset style is one undo step and keeps the CSS ID.

### VE-07 · History panel (Actions) — Sonnet

**Elementor:** History panel (Ctrl+Shift+H) lists every action ("Heading – Edited", "Section – Added") and jumps to any point.

**Do:**
1. `src/views/visualEditor/history.ts`: add optional `label?: string` to `Snapshot`; `pushHistory(h, before, { key, label })` stores label on the pushed entry (and on coalesce, keep the existing entry). Export pure `jumpHistory(h, current, steps: number)` that applies undo (negative) / redo (positive) `|steps|` times and returns `{history, snapshot}` or null.
2. `applyBlocks(change, key?, label?)`: pass label. Give labels at call sites: Added <Type>, Deleted <Type>, Duplicated, Moved, Edited <Type> (in `updateSelected` – use `selectedDef?.label`), Pasted, Style pasted, Column change, Template inserted, Imported, AI insert. Type label: `getBlockDef(node.blockType)?.label` or element def label.
3. New `src/views/visualEditor/HistoryPanel.tsx`: list `past` (oldest → newest), a "Current" row, then `future` reversed; click row → `restoreSnapshot` from `jumpHistory`. Re-render on `historyFlags` change (add a counter to force refresh).
4. Add `'history'` to `DockTab` (`EditorDock.tsx`), tab button with clock icon, shortcut Ctrl+Shift+H (`resolveShortcut` → `'history'`).

**Accept:** 5 edits → 5 labelled rows; clicking row 2 restores that state; redo rows remain clickable.
**Tests:** `jumpHistory` and label storage in history tests.

### VE-08 · Revisions tab (server versions) — Sonnet. Depends on VE-07 (shares the History panel).

**Elementor:** History → Revisions lists saved revisions with author/time; preview and Apply.

**Do:**
1. Second tab "Revisions" inside `HistoryPanel`. Load `GET /api/${surface.slug}/versions?where[parent][equals]=${route.id}&limit=50&sort=-updatedAt&depth=0` (globals: `/api/globals/${slug}/versions?limit=50&sort=-updatedAt&depth=0`), `credentials: 'include'`. Reference implementation: `src/admin/views/VersionsList.tsx` (author resolution, error handling). Hide the tab when the endpoint 404s (collection without versions).
2. Each row: relative time, author, status (draft/published).
3. "Apply" → `const raw = version.version[surface.blocksField]`; `applyBlocks(() => withIds(raw), undefined, 'Revision restored')`. It becomes an undoable edit; nothing is saved until the user saves (same as Elementor).
4. Refresh the list after each successful `save()`.

**Accept:** apply a revision → canvas shows old content, Undo returns to current, Save persists.

### VE-09 · More properties responsive — Sonnet

**Elementor:** nearly every style control has per-device values. Here `RESPONSIVE_KEYS` (`src/lib/blockStyle.ts` line 57) omits position offsets, z-index, opacity, word spacing, transforms, font weight.

**Do:**
1. Add to `RESPONSIVE_KEYS`: `'position','posTop','posRight','posBottom','posLeft','zIndex','opacity','fontWeight','wordSpacing','tfRotate','tfScale','tfTranslateX','tfTranslateY'`.
2. `deviceOverrideDecls()` (~line 1230): emit `position`, `top/right/bottom/left` (same units logic as the base in `selfPositionCss`/`advancedCss` — read them first), `z-index`, `opacity`, `font-weight`, `word-spacing`, and `transform` built with the existing `transformValue()` over the merged style (`mergedU`) when any `tf*` key is in `own`. All with `!important` like the others.
3. Check sanitizers that whitelist override keys (`src/lib/design/storeDesign.ts`, `upgrade.ts`, `resolveDeviceOverride`) and extend them.
4. `DesignPanel.tsx`: switch the corresponding controls in Position / Typography / Effects-transform / Advanced groups to the responsive components (`RespNumber`, `RespSelect`, `ctl = makeResponsive(...)`) so they show the device icon + inherited value, exactly like padding does.
5. `designHelpers.ts` group reset must also clear these keys from `tablet`/`mobile`.

**Accept:** set z-index 5 desktop, 10 mobile → mobile canvas uses 10, desktop 5; reset group clears both.
**Tests:** add to `tests/int/responsive-editing.int.spec.ts`.

---

## P2 – workflow polish

### VE-10 · Preview / view page button — Haiku

**Elementor:** "Preview changes" eye icon in the top bar.

**Do:** in the top bar (`VisualEditor.tsx` ~line 1490, before Save) add an eye-icon button, collection pages only (`pageSettings` present). URL: `/${pageSettings.slug}` (`/` when slug is `home` — check how `src/app/(frontend)/[...slug]` resolves home and reuse its rule). On click: if `dirty`, `await save(false)` first; then `window.open(url, '_blank', 'noopener')`. Tooltip: if `status !== 'published'` say "Draft changes are only visible after publishing". Key `ve.top.preview`.

### VE-11 · Save buttons reflect state — Haiku

**Elementor:** "Update" button is greyed when there are no changes and shows a dot when there are.

**Do:** "Save draft" button: `disabled={saving === 'saving' || !dirty}`. Publish button: add class `ve-btn--dirty` (small dot via `::after`, add CSS in `visualEditor.styles.ts`) when `dirty || status !== 'published'`. Keep `title`/tooltip explaining.

### VE-12 · Finder (Ctrl+E) — Sonnet

**Elementor:** Finder jumps to pages, settings and commands.

**Do:** new `FinderPalette.tsx` modelled on `QuickInsertPalette.tsx` (reuse its CSS + `filterQuickInsert`-style ranking from `quickInsert.ts`). Sources: (a) every node in the tree by navigator name (`label` or type label) → select + scroll into view (send `selected` to frame); (b) commands: Save, Publish, Page settings (`setDockTab('settings')` with no selection), Navigator, History, Desktop/Tablet/Mobile, Import/Export, Keyboard shortcuts; (c) other pages: `GET /api/pages?limit=20&where[title][like]=<q>&depth=0` → navigate to `/admin/visual-editor/collection/pages/<id>` (confirm if `dirty`). Shortcut Ctrl+E (`'finder'` action).

### VE-13 · Drag padding handles on canvas — Sonnet

**Elementor:** hover a section → drag top/bottom padding bars on canvas.

**Do:** in `Canvas.tsx` section render, add two thin handles (top/bottom edge, visible on hover/selected). Pointer-drag changes padding live (local preview state), on pointerup post a new bridge message `{ type: 'padding', path, side: 'top'|'bottom', value }` (add type + guard in `canvasBridge.ts`). Parent handler: `lockedOut` + `canEditStyle`, then `applyBlocks(...)` writing `design.paddingTop` on desktop or `design[device].paddingTop` on tablet/mobile (reuse logic in `makeResponsive` from `DesignPanel.tsx`), key `pad:${pathKey}`. Show px tooltip while dragging. Respect `paddingUnit`: only allow drag when unit is px/undefined.

### VE-14 · Multi-select — Sonnet (largest)

**Elementor (Pro 3.x)** supports selecting several elements for delete/duplicate/copy.

**Do:** `selectedPaths: NodePath[]` alongside `selectedPath` (primary). Ctrl/Cmd-click (canvas: add `additive` flag to the `select` bridge message; navigator: same) toggles; Shift-click in navigator selects range within the same container. Bulk ops: delete (delete deepest/last index first so paths stay valid), duplicate, copy (serialize as multi-node clipboard – `serializeSelection` already handles a list? check; else extend), paste style to all. Settings panel shows "N elements selected" with only the bulk actions. All bulk ops = one `applyBlocks` call (one undo step). Locked nodes are skipped with a notice.

### VE-15 · Global typography presets — Sonnet (needs product decision on data model)

**Elementor:** Site Settings → Global Fonts (Primary/Secondary/Text/Accent) selectable from any typography control, updates everywhere when changed.

**Today:** colours have theme tokens (`ColorRow` "Theme" button → `var(--…)`); typography has no global presets.

**Do:** add `typePresets: { id, name, fontFamily, fontSize, fontSizeUnit, fontWeight, lineHeight, letterSpacing, textTransform }[]` to theme settings (see `src/admin/views/ThemeStylesView.tsx` and the theme global), emitted as CSS classes `.tp-<id>` + custom properties in the site theme CSS. `BlockStyle.typePreset?: string` → wrapper gets class `tp-<id>`; per-block typography values still override. DesignPanel Typography group: preset dropdown at top ("Custom" = none). Admin UI to edit presets on Theme styles page.
