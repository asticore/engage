import type { TagChip } from './logic'

/** Small coloured tag labels for a file tile or list row. Renders nothing when there are none. */
export function TagChips({ chips, max = 4 }: { chips?: TagChip[]; max?: number }) {
  if (!chips || chips.length === 0) return null
  const shown = chips.slice(0, max)
  const more = chips.length - shown.length
  return (
    <span className="flex flex-wrap gap-[3px]">
      {shown.map((c) => (
        <span
          key={c.id}
          title={c.title}
          className="inline-flex items-center gap-[4px] rounded-full border border-[var(--theme-elevation-200)] px-[6px] py-[1px] text-[calc(var(--base)*0.62)] text-[var(--theme-elevation-700)]"
        >
          <span aria-hidden="true" className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: c.color }} />
          {c.label}
        </span>
      ))}
      {more > 0 ? <span className="text-[calc(var(--base)*0.62)] text-[var(--theme-elevation-500)]">+{more}</span> : null}
    </span>
  )
}
