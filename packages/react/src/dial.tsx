import { useRef, type PointerEvent } from "react"
import { cx } from "./cx.ts"

let audio: AudioContext | null = null
/** A detent's click: a short, filtered tick, quiet enough to feel more than hear. */
function tick() {
  try {
    audio ??= new AudioContext()
    const len = Math.floor(audio.sampleRate * 0.012)
    const buffer = audio.createBuffer(1, len, audio.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4
    const source = audio.createBufferSource(), band = audio.createBiquadFilter(), gain = audio.createGain()
    band.type = "bandpass"
    band.frequency.value = 3200
    band.Q.value = 1.4
    gain.gain.value = 0.18
    source.buffer = buffer
    source.connect(band)
    band.connect(gain)
    gain.connect(audio.destination)
    source.start()
  } catch {}
}

/**
 * Dial: a knob you can feel. It clicks into place at each step, the ticks light
 * up to where it's turned, and the number rolls. Drag around it, scroll on it,
 * or use the arrow keys.
 */
export function Dial({
  value,
  onValueChange,
  label,
  min = 0,
  max = 100,
  step = 5,
  unit = "percent",
  sound = true,
  className,
}: {
  value: number
  onValueChange?: (value: number) => void
  label: string
  min?: number
  max?: number
  step?: number
  /** Read after the number: "60 percent". */
  unit?: string
  /** A quiet click at each detent. */
  sound?: boolean
  className?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const SWEEP = 270
  const fraction = (v: number) => (v - min) / (max - min)
  const turn = -SWEEP / 2 + fraction(value) * SWEEP
  const set = (v: number) => {
    const next = Math.max(min, Math.min(max, min + Math.round((v - min) / step) * step))
    if (next === value) return
    if (sound) tick()
    onValueChange?.(next)
  }
  const fromPointer = (e: PointerEvent) => {
    const r = root.current!.getBoundingClientRect()
    let a = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90
    if (a > 180) a -= 360
    if (Math.abs(a) > SWEEP / 2 + 20) return
    set(min + ((Math.max(-SWEEP / 2, Math.min(SWEEP / 2, a)) + SWEEP / 2) / SWEEP) * (max - min))
  }
  const ticks = []
  for (let v = min; v <= max + 1e-9; v += step) {
    const a = ((-SWEEP / 2 + fraction(v) * SWEEP - 90) * Math.PI) / 180
    const major = Math.round(fraction(v) * 4) === fraction(v) * 4
    const r1 = 118, r2 = major ? 104 : 109
    ticks.push(<line key={v} data-lit={v <= value ? "" : undefined} data-major={major ? "" : undefined} x1={130 + r1 * Math.cos(a)} y1={130 + r1 * Math.sin(a)} x2={130 + r2 * Math.cos(a)} y2={130 + r2 * Math.sin(a)} />)
  }
  const digits = String(Math.round(value)).padStart(3, " ").split("")
  return (
    <div
      ref={root}
      className={cx("hl-dial", className)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.querySelector<HTMLElement>(".hl-dial-knob")?.focus({ preventScroll: true })
        fromPointer(e)
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(e)}
      onWheel={(e) => set(value + (e.deltaY < 0 ? step : -step))}
    >
      <svg className="hl-dial-ticks" viewBox="0 0 260 260" aria-hidden="true">
        {ticks}
      </svg>
      <div
        className="hl-dial-knob"
        tabIndex={0}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} ${unit}`}
        onKeyDown={(e) => {
          const d = ({ ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 5, PageDown: -step * 5 } as Record<string, number>)[e.key]
          if (e.key === "Home") set(min)
          else if (e.key === "End") set(max)
          else if (d !== undefined) set(value + d)
          else return
          e.preventDefault()
        }}
      >
        <div className="hl-dial-face" style={{ ["--turn" as string]: `${turn}deg` }} />
        <div className="hl-dial-read" aria-hidden="true">
          <div className="hl-odo">
            {digits.map((d, i) => (
              <span key={i} data-blank={d === " " ? "" : undefined} style={{ transform: `translateY(${d === " " ? 0 : -Number(d)}em)` }}>
                {Array.from({ length: 10 }, (_, n) => (
                  <i key={n}>{n}</i>
                ))}
              </span>
            ))}
          </div>
          <small>{label}</small>
        </div>
      </div>
    </div>
  )
}
