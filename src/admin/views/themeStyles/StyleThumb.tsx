import { hslToHex, type StyleCard } from '@/features/themeStyles/styleCards'

/**
 * A small drawn preview of a style card: page colour, heading bars, a button with the card's corner radius and case, and
 * the accent. Drawn from the card's own numbers, so it needs no image files and always matches what the generator makes.
 */
export function StyleThumb({ card }: { card: StyleCard }) {
  const dark = card.lightness < 35
  const page = dark ? hslToHex(card.hue, card.saturation * 0.5, 9) : hslToHex(card.hue, Math.min(card.saturation, 30) * 0.5, Math.min(99, Math.max(94, card.lightness)))
  const ink = dark ? hslToHex(card.hue, 15, 93) : hslToHex(card.hue, Math.min(card.saturation, 35), 12)
  const accent = hslToHex(card.hue + card.accentShift, Math.min(85, card.saturation + 15), dark ? 62 : 40)
  const surface = dark ? hslToHex(card.hue, card.saturation * 0.45, 14) : '#ffffff'
  const r = Math.min(card.radius, 14)
  return (
    <svg viewBox="0 0 120 72" width="120" height="72" role="img" aria-hidden="true" focusable="false">
      <rect width="120" height="72" fill={page} />
      <rect x="10" y="10" width={card.headings === 'heading' ? 62 : 48} height="7" rx="1" fill={ink} />
      <rect x="10" y="22" width="80" height="3" rx="1" fill={ink} opacity="0.45" />
      <rect x="10" y="29" width="64" height="3" rx="1" fill={ink} opacity="0.45" />
      <rect x="10" y="40" width={card.buttonCase === 'uppercase' ? 40 : 34} height="14" rx={r} fill={accent} />
      <rect x="84" y="38" width="26" height="24" rx={Math.min(r, 8)} fill={surface} stroke={ink} strokeOpacity="0.15" />
    </svg>
  )
}
