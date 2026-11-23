/**
 * The small progressive script for charts: hover tooltips. Tables use Shine table styles and Spark `spark-table`. The markup is complete without it. It only reads the data-* attributes the
 * server rendered and writes with textContent, never innerHTML, so it cannot introduce markup.
 */

const ENHANCED = 'dvEnhanced'

function enhanceChart(body: HTMLElement): void {
  const svg = body.querySelector('svg')
  if (!svg) return
  const tip = document.createElement('div')
  tip.className = 'dv-tooltip'
  tip.hidden = true
  tip.setAttribute('role', 'tooltip')
  body.appendChild(tip)
  // The native tooltips would double up with this one.
  for (const title of Array.from(svg.querySelectorAll('.dv-mark > title'))) title.remove()

  const show = (target: Element): void => {
    const text = target.getAttribute('data-tip')
    if (!text) return
    tip.textContent = text
    tip.hidden = false
    const box = target.getBoundingClientRect()
    const host = body.getBoundingClientRect()
    tip.style.left = `${Math.round(box.left - host.left + box.width / 2)}px`
    tip.style.top = `${Math.round(box.top - host.top)}px`
  }
  svg.addEventListener('pointerover', (event) => {
    const target = (event.target as Element | null)?.closest?.('[data-tip]')
    if (target) show(target)
  })
  svg.addEventListener('pointerout', () => {
    tip.hidden = true
  })
}

/** Upgrades every table and chart under `root` that has not been upgraded yet. Safe to call repeatedly. */
export function enhanceDataViews(root: ParentNode = document): void {
  for (const body of Array.from(root.querySelectorAll<HTMLElement>('.dv-chart-body'))) {
    if (body.dataset[ENHANCED]) continue
    body.dataset[ENHANCED] = '1'
    enhanceChart(body)
  }
}
