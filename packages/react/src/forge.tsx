import { CLOSED_HUES, deriveAccent, openHue } from "@halation/core/color"
import { useEffect, useRef, useState, type PointerEvent } from "react"
import { cx } from "./cx.ts"

const ring = (h: number) => deriveAccent(h).accent

/**
 * Forge: an accent picker that picks every role at once. Turn the ring and the
 * button, links, selection and focus ring are derived from the hue, each text
 * color solved for contrast and measured in both modes. Purple is closed off.
 */
export function AccentForge({
  hue,
  onHueChange,
  preview = true,
  className,
}: {
  hue: number
  onHueChange?: (hue: number) => void
  /** Show the derived roles in light and dark, with their contrast. */
  preview?: boolean
  className?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [refused, setRefused] = useState(false)
  const r = deriveAccent(hue)

  useEffect(() => {
    const g = canvas.current?.getContext("2d")
    if (!g) return
    for (let d = 0; d < 360; d += 0.5) {
      const closed = d > CLOSED_HUES[0] && d < CLOSED_HUES[1]
      g.beginPath()
      g.arc(300, 300, 250, ((d - 90.3) * Math.PI) / 180, ((d - 89.2) * Math.PI) / 180)
      g.strokeStyle = closed ? "rgb(52 49 55)" : ring(d)
      g.lineWidth = 44
      g.stroke()
    }
  }, [])

  const set = (h: number, toward = 0) => {
    const raw = ((h % 360) + 360) % 360
    const next = openHue(raw, toward)
    setRefused(next !== raw)
    if (next !== hue) onHueChange?.(next)
  }
  const fromPointer = (e: PointerEvent) => {
    const b = root.current!.getBoundingClientRect()
    set((Math.atan2(e.clientY - b.top - b.height / 2, e.clientX - b.left - b.width / 2) * 180) / Math.PI + 90)
  }
  const a = ((hue - 90) * Math.PI) / 180
  const check = (v: number) => `${v.toFixed(1)} to 1, ${v >= 4.5 ? "passes" : "fails"}`
  return (
    <div className={cx("hl-forge", className)}>
      <div
        ref={root}
        className="hl-forge-ring"
        tabIndex={0}
        role="slider"
        aria-label="Accent hue"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hue)}
        aria-valuetext={`${r.name}, hue ${Math.round(hue)}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          fromPointer(e)
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(e)}
        onKeyDown={(e) => {
          const d = ({ ArrowRight: 2, ArrowUp: 2, ArrowLeft: -2, ArrowDown: -2, PageUp: 15, PageDown: -15 } as Record<string, number>)[e.key]
          if (d === undefined) return
          e.preventDefault()
          set(hue + d, Math.sign(d))
        }}
      >
        <canvas ref={canvas} width={600} height={600} aria-hidden="true" />
        <span className="hl-forge-handle" style={{ left: `${50 + 41.67 * Math.cos(a)}%`, top: `${50 + 41.67 * Math.sin(a)}%`, background: r.accent }} />
        <div className="hl-forge-center" aria-hidden="true">
          <b>{r.name}</b>
          <span>Hue {Math.round(hue)}</span>
        </div>
      </div>
      {preview ? (
        <div className="hl-forge-out">
          <p className="hl-forge-say" data-tone={refused ? "problem" : undefined} aria-live="polite">
            {refused ? "Halation keeps accents out of purple, so the ring stops at its edge." : "Every pair below is measured as you turn the ring."}
          </p>
          <div className="hl-forge-modes">
            {(["light", "dark"] as const).map((m) => (
              <div key={m} className="hl-forge-mode" style={{ background: r[m].canvas, color: r[m].text }}>
                <p className="hl-forge-name">{m === "light" ? "Light" : "Dark"}</p>
                <span className="hl-forge-button" style={{ background: r.accent, color: r.onAccent }}>
                  Show in Finder
                </span>
                <span className="hl-forge-link" style={{ color: r[m].fg }}>
                  Open the compatibility list
                </span>
                <p className="hl-forge-row" style={{ background: r[m].soft, boxShadow: `inset 2px 0 0 ${r.accent}` }}>
                  Claude Work, selected
                </p>
                <div className="hl-forge-checks">
                  <p>
                    <span>Link on the page</span>
                    <b>{check(r[m].checks.link)}</b>
                  </p>
                  <p>
                    <span>Text on the button</span>
                    <b>{check(r[m].checks.onAccent)}</b>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
