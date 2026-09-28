import { formatClock, paintSundial, sky } from "@halation/core/instruments"
import { useEffect, useMemo, useRef, type PointerEvent } from "react"
import { cx } from "./cx.ts"

/**
 * Sundial: a time picker set by moving the sun. The face shows the real sky for
 * the chosen minute, from Halation's daylight model: it warms at golden hour,
 * the sun sets behind the horizon, and at night the handle becomes a moon.
 * Set to solar time, as a real sundial is, so the horizon lies level.
 */
export function Sundial({
  value,
  onValueChange,
  label,
  step = 15,
  sunrise,
  sunset,
  date,
  latitude = 42,
  className,
}: {
  /** Minutes after midnight. */
  value: number
  onValueChange?: (minutes: number) => void
  label: string
  step?: number
  /** Minutes after midnight; the daylight model's for the date when left out. */
  sunrise?: number
  sunset?: number
  date?: Date
  latitude?: number
  className?: string
}) {
  const day = useMemo(() => sky({ date: date ?? new Date(), latitude, sunrise, sunset }), [date?.toDateString(), latitude, sunrise, sunset])
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const knob = useRef<HTMLSpanElement>(null)
  const shown = useRef(value)
  const frame = useRef(0)
  const change = useRef(onValueChange)
  change.current = onValueChange

  const paint = (m: number) => {
    const c = canvas.current, k = knob.current
    if (!c || !k) return
    const at = paintSundial(c, m, day)
    const face = c.getBoundingClientRect(), box = root.current!.getBoundingClientRect()
    k.style.left = `${face.left - box.left + at.x * face.width}px`
    k.style.top = `${face.top - box.top + at.y * face.height}px`
  }

  // Keeps the canvas at the face's pixel size, and repaints.
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const fit = () => {
      const w = c.getBoundingClientRect().width
      c.width = c.height = Math.round(w * Math.min(3, devicePixelRatio || 1))
      paint(shown.current)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(c)
    fit()
    return () => observer.disconnect()
  }, [day])

  // The sun glides to each new time on a spring, the short way round.
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.current = value
      paint(value)
      return
    }
    let v = 0
    const step = () => {
      let d = value - shown.current
      if (d > 720) d -= 1440
      if (d < -720) d += 1440
      v = (v + d * 0.16) * 0.62
      shown.current = (shown.current + v + 1440) % 1440
      if (Math.abs(d) < 0.05 && Math.abs(v) < 0.05) shown.current = value
      else frame.current = requestAnimationFrame(step)
      paint(shown.current)
    }
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [value, day])

  const set = (m: number) => {
    const next = ((Math.round(m / step) * step) % 1440 + 1440) % 1440
    if (next !== value) change.current?.(next)
  }
  const fromPointer = (e: PointerEvent) => {
    const r = root.current!.getBoundingClientRect()
    const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2
    let a = Math.atan2(-x, y)
    if (a < 0) a += Math.PI * 2
    set(day.minuteAt(a))
  }

  // The bezel: engraved hours, and four labels where those hours truly fall.
  const at = (m: number, r: number) => [200 - r * Math.sin(day.angle(m)), 200 + r * Math.cos(day.angle(m))]
  const [time, ampm] = formatClock(value)
  return (
    <div
      ref={root}
      className={cx("hl-sundial", className)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        knob.current?.focus({ preventScroll: true })
        fromPointer(e)
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(e)}
    >
      <div className="hl-sundial-face">
        <canvas ref={canvas} />
      </div>
      <svg viewBox="0 0 400 400" aria-hidden="true">
        {Array.from({ length: 24 }, (_, h) => {
          const major = h % 6 === 0
          const [x1, y1] = at(h * 60, 188), [x2, y2] = at(h * 60, major ? 180 : 183)
          return <line key={h} className="hl-sundial-tick" data-major={major ? "" : undefined} x1={x1} y1={y1} x2={x2} y2={y2} />
        })}
        {([[0, "Midnight"], [360, "6 am"], [720, "Noon"], [1080, "6 pm"]] as const).map(([m, t]) => {
          const [x, y] = at(m, 213)
          return (
            <text key={t} className="hl-sundial-label" x={x} y={y}>
              {t}
            </text>
          )
        })}
      </svg>
      <span
        ref={knob}
        className="hl-sundial-knob"
        tabIndex={0}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={1440 - step}
        aria-valuenow={value}
        aria-valuetext={`${time} ${ampm}, ${day.describe(value).phase.toLowerCase()}`}
        onKeyDown={(e) => {
          const d = ({ ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 60, PageDown: -60 } as Record<string, number>)[e.key]
          if (d === undefined) return
          e.preventDefault()
          set(value + d)
        }}
      />
    </div>
  )
}
