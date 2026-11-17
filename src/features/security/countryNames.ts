/** Country names for the picker (Task 19d): every two letter region code the runtime knows, with its English name. */
export function countryOptions(): { code: string; name: string }[] {
  const out: { code: string; name: string }[] = []
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' })
    for (let a = 65; a <= 90; a += 1) {
      for (let b = 65; b <= 90; b += 1) {
        const code = String.fromCharCode(a, b)
        const name = names.of(code)
        if (name && name !== code && name !== 'Unknown Region') out.push({ code, name })
      }
    }
  } catch {
    // Older runtimes: the picker falls back to the typed codes box.
  }
  out.sort((x, y) => x.name.localeCompare(y.name))
  out.push({ code: 'XX', name: 'Unknown country' })
  return out
}
