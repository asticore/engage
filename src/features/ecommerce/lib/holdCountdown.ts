/** Formats the time left on a stock hold (Task 23e). Pure. */
export function holdCountdown(msLeft: number): { ended: boolean; label: string } {
  if (!Number.isFinite(msLeft) || msLeft <= 0) return { ended: true, label: '0:00' }
  const total = Math.ceil(msLeft / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return { ended: false, label: h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}` }
}
