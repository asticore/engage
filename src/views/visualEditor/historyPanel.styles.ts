/** History panel (Actions / Revisions) styles. Injected next to NAVIGATOR_CSS in VisualEditor.tsx. */
export const HISTORY_PANEL_CSS = `
.ve-hist{display:flex;flex-direction:column;gap:8px;padding:10px 12px;font-size:13px;min-height:0}
.ve-hist__tabs{display:flex;gap:4px}
.ve-hist__tab{flex:1;border:1px solid var(--ve-border,rgba(128,128,128,.35));background:transparent;color:inherit;border-radius:6px;padding:5px 8px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.ve-hist__tab[aria-selected='true']{background:var(--ve-accent,#2e3192);border-color:var(--ve-accent,#2e3192);color:var(--ve-accent-contrast,#fff)}
.ve-hist__list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.ve-hist__row{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:6px 8px;border-radius:6px;cursor:pointer;min-height:30px}
.ve-hist__row:hover{background:rgba(128,128,128,.14)}
.ve-hist__row:focus-visible{outline:2px solid var(--ve-accent,#3b82f6)}
.ve-hist__row--current{background:rgba(59,130,246,.18);font-weight:600}
.ve-hist__row--future{opacity:.55}
.ve-hist__label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ve-hist__badge{flex:none;font-size:11px;padding:0 6px;border-radius:9px;background:rgba(128,128,128,.22)}
.ve-hist__meta{display:flex;flex-direction:column;flex:1;min-width:0}
.ve-hist__sub{font-size:11px;opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ve-hist__item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;border:1px solid var(--ve-border,rgba(128,128,128,.25))}
.ve-hist__apply{flex:none;border:1px solid var(--ve-border,rgba(128,128,128,.35));background:transparent;color:inherit;border-radius:6px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}
.ve-hist__apply:hover:not(:disabled){background:rgba(128,128,128,.15)}
.ve-hist__apply:disabled{opacity:.5;cursor:not-allowed}
.ve-hist__note{opacity:.65;margin:0;font-size:12px;line-height:1.4}
.ve-hist__error{color:var(--ve-danger,#b42318);margin:0;font-size:12px}
`
