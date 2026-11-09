/**
 * Canvas and Elements-panel polish from the live QA sweep. Appended last to VISUAL_EDITOR_CSS (see
 * visualEditor.styles.ts), so it overrides the base rules without editing them. A plain string for the
 * same reason as the base file: no .css loader under generate:importmap / generate:types.
 */
export const CANVAS_POLISH_CSS = `
/* Inline text editing: the preview is pointer-events:none (inert links, clicks select the block),
   which the editor inside it would inherit, so give it and its format bar their pointer back. */
.ve-node__preview .ve-inline-editor,
.ve-node__preview [role='toolbar'] { pointer-events: auto; }

/* Block toolbar: readable text and real hit areas (was 10px text, 7x12 handle). */
.ve-node__toolbar { font-size: 12px; padding: 2px 4px; gap: 2px; }
.ve-drag-handle,
.ve-node__act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  min-height: 22px;
  box-sizing: border-box;
  padding: 0 4px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.ve-drag-handle { width: 24px; cursor: grab; touch-action: none; opacity: 0.9; }
.ve-drag-handle:active { cursor: grabbing; }
.ve-drag-handle:hover:not(:disabled) { background: rgba(255, 255, 255, 0.16); opacity: 1; }
.ve-drag-handle:disabled { opacity: 0.3; cursor: default; }
.ve-node__label { font-size: 12px; padding: 0 4px; }

/* An element whose preview shows nothing (a fresh Rich Text, an emptied Heading): a visible,
   editor-only placeholder, so an insert never looks like it failed. Never rendered on the public site. */
.ve-node__empty {
  box-sizing: border-box;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 1px dashed var(--ve-border-strong, rgba(128, 128, 128, 0.6));
  border-radius: 6px;
  background: var(--ve-surface-alt, rgba(128, 128, 128, 0.08));
  color: var(--ve-text-muted, #6b7280);
  font: 500 13px/1.4 system-ui, sans-serif;
  text-align: center;
  pointer-events: none;
}

/* Elements panel: the tooltip wrapper is the real grid item, so make it and the card fill equal tracks. */
.ve-library__grid,
.ve-tpl__grid { align-items: stretch; }
.ve-library__grid > .admin-tip,
.ve-tpl__grid > .admin-tip { display: block; min-width: 0; width: 100%; max-width: none; }
.ve-library__grid > .admin-tip > .ve-library__card,
.ve-tpl__grid > .admin-tip > .ve-tpl__card { width: 100%; height: 100%; min-width: 0; box-sizing: border-box; }
.ve-library--comfortable .ve-library__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.ve-library--comfortable .ve-library__card-label { overflow-wrap: anywhere; }
.ve-library--compact .ve-library__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }

/* Tooltips in the panel hug the dock edges instead of being centred over a card and clipped. */
.ve-library__grid .admin-tip__bubble,
.ve-tpl__grid .admin-tip__bubble { max-width: min(220px, 70vw); }
.ve-library--comfortable .ve-library__grid > .admin-tip:nth-child(2n + 1) .admin-tip__bubble,
.ve-library--compact .ve-library__grid > .admin-tip:nth-child(3n + 1) .admin-tip__bubble,
.ve-tpl__grid > .admin-tip:nth-child(2n + 1) .admin-tip__bubble { left: 0; transform: none; }
.ve-library--comfortable .ve-library__grid > .admin-tip:nth-child(2n) .admin-tip__bubble,
.ve-library--compact .ve-library__grid > .admin-tip:nth-child(3n) .admin-tip__bubble,
.ve-tpl__grid > .admin-tip:nth-child(2n) .admin-tip__bubble { left: auto; right: 0; transform: none; }

/* Template thumbnails stay inside their card. */
.ve-tpl__card { overflow: hidden; }
.ve-tpl__thumb { width: 100%; box-sizing: border-box; contain: paint; }
.ve-tpl__thumb img { position: absolute; inset: 0; max-width: 100%; }
`
