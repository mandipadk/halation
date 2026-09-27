import { mountPhenomenon } from "@halation/core/phenomena"
import { useEffect, useRef, useState } from "react"
import { reducedMotion, useSeen } from "./scroll.ts"
import { useSite } from "../site.tsx"

const SHOWN = [
  { name: "caustics", title: "Caustics" },
  { name: "silk", title: "Silk" },
  { name: "ink", title: "Ink" },
  { name: "blinds", title: "Blinds" },
  { name: "growth", title: "Growth" },
  { name: "stir", title: "Stir" },
] as const

const DWELL = 5200

/**
 * Light: one wide stage that opens as it scrolls in. It plays through the
 * phenomena once, each name filling as its turn runs, then rests; any name
 * can be picked again.
 */
export function Light() {
  const { mode } = useSite()
  const [ref, seen] = useSeen<HTMLElement>(0.4)
  const host = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!seen) return
    if (reducedMotion()) return
    setPlaying(true)
  }, [seen])

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (active < SHOWN.length - 1) setActive(active + 1)
      else setPlaying(false)
    }, DWELL)
    return () => clearTimeout(t)
  }, [active, playing])

  useEffect(() => {
    const el = host.current
    if (!el || !seen) return
    el.dataset.swap = ""
    let light: ReturnType<typeof mountPhenomenon> | null = null
    const t = setTimeout(() => {
      light = mountPhenomenon(el, SHOWN[active].name, { mode, daylight: true })
      delete el.dataset.swap
    }, 200)
    return () => {
      clearTimeout(t)
      light?.destroy()
    }
  }, [active, seen, mode])

  return (
    <section className="light" ref={ref}>
      <div className="light-frame">
        <div className="light-stage" ref={host} aria-hidden />
        <div className="light-over wrap-x">
          <h2 className="light-title" data-quiet="">
            Light that behaves like light.
          </h2>
          <div className="light-picks" role="tablist" aria-label="Phenomena">
            {SHOWN.map((s, i) => (
              <button
                key={s.name}
                type="button"
                role="tab"
                aria-selected={i === active}
                data-running={i === active && playing ? "" : undefined}
                style={{ ["--dwell" as string]: `${DWELL}ms` }}
                onClick={() => {
                  setPlaying(false)
                  setActive(i)
                }}
              >
                <span>{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
