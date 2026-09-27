import { mountPhenomenon } from "@halation/core/phenomena"
import { useEffect, useRef } from "react"
import { Install } from "./Install.tsx"
import { Link } from "../router.tsx"
import { useSite } from "../site.tsx"

const LINE = "Your taste,"

/**
 * The opening: rays from above the frame, and a headline that catches them.
 * The light's source follows the pointer (and drifts on its own when there's
 * none); each letter swells in width and weight by how much light reaches it,
 * strongest in the column under the source.
 */
export function Hero() {
  const { mode } = useSite()
  const stage = useRef<HTMLDivElement>(null)
  const light = useRef<HTMLDivElement>(null)
  const line = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const host = light.current
    const root = stage.current
    const letters = [...(line.current?.querySelectorAll<HTMLSpanElement>("[data-l]") ?? [])]
    if (!host || !root) return
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches
    const rays = mountPhenomenon(host, "rays", { position: 62, intensity: 1.15, mode })
    let target = 62
    let position = 62
    let pointer = false
    let frame = 0
    const t0 = performance.now()
    const glow = letters.map(() => 0)

    const onMove = (e: PointerEvent) => {
      const box = root.getBoundingClientRect()
      pointer = true
      target = 18 + 70 * ((e.clientX - box.left) / box.width)
    }
    const onLeave = () => (pointer = false)
    root.addEventListener("pointermove", onMove)
    root.addEventListener("pointerleave", onLeave)

    const tick = (now: number) => {
      const t = (now - t0) / 1000
      if (!pointer) target = 58 + 22 * Math.sin(t * 0.11)
      position += (target - position) * (still ? 1 : 0.035)
      rays.update({ position })
      const box = root.getBoundingClientRect()
      const sx = box.left + (position / 100) * box.width
      const spread = Math.max(220, box.width * 0.2)
      // On a narrow screen the line has no room to grow, so the light mostly shows as weight.
      const widen = box.width < 700 ? 6 : 30
      letters.forEach((el, i) => {
        const r = el.getBoundingClientRect()
        // The beam falls straight down from its source: letters under it take the most light.
        const off = (r.left + r.width / 2 - sx) / spread
        const lit = Math.exp(-off * off)
        glow[i] += (lit - glow[i]) * (still ? 1 : 0.08)
        const g = glow[i]
        el.style.fontVariationSettings = `"wdth" ${(96 + g * widen).toFixed(1)}, "wght" ${(520 + g * 330).toFixed(0)}`
      })
      if (!still) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      root.removeEventListener("pointermove", onMove)
      root.removeEventListener("pointerleave", onLeave)
      rays.destroy()
    }
  }, [mode])

  return (
    <section className="hero-x" ref={stage}>
      <div className="hero-light" ref={light} aria-hidden />
      <div className="hero-body wrap-x">
        <Link href="/start" className="news">
          <span>Halation 0.1 is on npm</span>
          <span aria-hidden>Start a project →</span>
        </Link>
        <h1 className="hero-title" aria-label="Your taste, everywhere.">
          <span className="hero-line" ref={line} aria-hidden>
            {[...LINE].map((c, i) => (
              <span key={i} data-l="" style={{ ["--i" as string]: i }}>
                {c === " " ? " " : c}
              </span>
            ))}
          </span>
          <span className="hero-serif" aria-hidden>
            everywhere.
          </span>
        </h1>
        <div className="hero-foot">
          <p className="hero-lead">
            The design system that keeps every project on brand, and every AI agent working in it. Colors proven for contrast, components that behave, light with character, and rules that check themselves.
          </p>
          <div className="hero-actions">
            <Install />
            <Link href="/components" className="hero-link">
              See it in the hand
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
