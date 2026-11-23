/**
 * Task 21c: settings for the Slides element (pure, no React).
 * Slides can hold a video, an animated text layer and per-device height; the element can loop, show arrows,
 * dots and thumbnails, and loads only the slide in view and its neighbours.
 */

export const MAX_SLIDES = 10
export const TEXT_ANIMATIONS = ['none', 'fade-up', 'slide-left', 'zoom'] as const
export type TextAnimation = (typeof TEXT_ANIMATIONS)[number]

const clamp = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && v !== '' && v !== null ? Math.min(max, Math.max(min, n)) : fallback
}
const flag = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

export type SlidesSettings = {
  loop: boolean
  arrows: boolean
  dots: boolean
  /** Arrows and dots on phones; they follow the desktop choice until set. */
  arrowsMobile: boolean
  dotsMobile: boolean
  thumbnails: boolean
  height: number
  heightMobile: number
  interval: number
}

/** Reads the element props. Old slides saved before 21c keep their look: loop, arrows and dots on, no thumbnails. */
export const slidesSettings = (p: Record<string, unknown>): SlidesSettings => {
  const height = clamp(p.height, 420, 200, 1000)
  return {
    loop: flag(p.loop, true),
    arrows: flag(p.arrows, true),
    dots: flag(p.dots, true),
    arrowsMobile: flag(p.arrowsMobile, flag(p.arrows, true)),
    dotsMobile: flag(p.dotsMobile, flag(p.dots, true)),
    thumbnails: flag(p.thumbnails, false),
    height,
    heightMobile: clamp(p.heightMobile, Math.min(height, 360), 160, 800),
    interval: clamp(p.interval, 6, 2, 30),
  }
}

export const textAnimationOf = (v: unknown): TextAnimation => (TEXT_ANIMATIONS as readonly string[]).includes(v as string) ? (v as TextAnimation) : 'fade-up'

/** Only http(s) and site-relative video files (.mp4, .webm) are used as slide videos. */
export const videoSrc = (v: unknown): string => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s || /[\s"'<>]/.test(s)) return ''
  if (!/^(https?:\/\/|\/)/i.test(s) || s.startsWith('//')) return ''
  return /\.(mp4|webm)(\?.*)?$/i.test(s) ? s : ''
}

/** Next index, stopping at the ends when loop is off. */
export const stepIndex = (i: number, count: number, step: number, loop: boolean): number => {
  if (count <= 0) return 0
  if (loop) return (((i + step) % count) + count) % count
  return Math.min(count - 1, Math.max(0, i + step))
}

/** True when the slide should load its picture or video now: the slide in view and the ones next to it. */
export const shouldLoad = (slide: number, active: number, count: number): boolean => {
  if (count <= 3) return true
  const d = Math.abs(slide - active)
  return d <= 1 || d >= count - 1
}

export const LAYER_TYPES = ['text', 'image', 'button'] as const
export type LayerType = (typeof LAYER_TYPES)[number]
export const MAX_LAYERS = 8

/** One free-position layer on a slide. `x`, `y` and `width` are percentages of the slide; `delay` is in seconds. */
export type SlideLayer = {
  type: LayerType
  text: string
  url: string
  image: unknown
  x: number
  y: number
  width: number
  delay: number
  animation: TextAnimation
  /** Spark effect id (see features/effects/catalog), or ''. */
  spark: string
}

/** Reads a slide's layers: at most 8, positions kept inside the slide, delay 0 to 10 seconds. */
export const layersOf = (v: unknown): SlideLayer[] =>
  (Array.isArray(v) ? v : []).slice(0, MAX_LAYERS).map((raw) => {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const type = (LAYER_TYPES as readonly string[]).includes(o.layerType as string) ? (o.layerType as LayerType) : 'text'
    return {
      type,
      text: typeof o.text === 'string' ? o.text : '',
      url: typeof o.url === 'string' ? o.url : '',
      image: o.image ?? o.imageUrl,
      x: clamp(o.x, 10, 0, 100),
      y: clamp(o.y, 10, 0, 100),
      width: clamp(o.width, 40, 5, 100),
      delay: clamp(o.delay, 0, 0, 10),
      animation: textAnimationOf(o.animation),
      spark: typeof o.sparkEffect === 'string' ? o.sparkEffect.replace(/[^\w-]/g, '').slice(0, 60) : '',
    }
  })

/**
 * Which way a finished drag moves the slider: -1 previous, 1 next, 0 stay. A long drag counts, and so does a short
 * quick flick (momentum): at least 24 px at 0.4 px per millisecond or faster. Dragging left moves to the next slide.
 */
export const swipeDirection = (dx: number, ms: number): -1 | 0 | 1 => {
  const distance = Math.abs(dx)
  const fast = distance >= 24 && distance / Math.max(1, ms) >= 0.4
  if (distance < 80 && !fast) return 0
  return dx < 0 ? 1 : -1
}
