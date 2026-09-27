import { batch, develop, paintGrain, playChime, score, sealSvg } from "@halation/core/signature"
import { ShareCard } from "@halation/react"
import { useEffect, useRef, useState } from "react"
import { reducedMotion, useSeen } from "./scroll.ts"

const FIRST = "Meridian"
const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]

const noteName = (frequency: number) => {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
}

/**
 * The signature, as a print. Name a project and its share card develops like
 * a photograph, with the project's own grain; the seal is also its chime, and
 * each slit lights as its note sounds. The print tilts under the pointer and
 * catches the light.
 */
export function Signed() {
  const [ref, seen] = useSeen<HTMLElement>(0.4)
  const [name, setName] = useState("")
  const [settled, setSettled] = useState(FIRST)
  const [lit, setLit] = useState(-1)
  const touched = useRef(false)
  const print = useRef<HTMLDivElement>(null)
  const grain = useRef<HTMLCanvasElement>(null)

  // The name types itself once when the section arrives, unless someone gets there first.
  useEffect(() => {
    if (!seen) return
    if (reducedMotion()) return setName(FIRST)
    let i = 0
    const t = setInterval(() => {
      if (touched.current) return clearInterval(t)
      setName(FIRST.slice(0, ++i))
      if (i >= FIRST.length) clearInterval(t)
    }, 85)
    return () => clearInterval(t)
  }, [seen])

  const clean = name.trim() || FIRST
  useEffect(() => {
    const t = setTimeout(() => setSettled(clean), 420)
    return () => clearTimeout(t)
  }, [clean])

  // Each new name develops a new print, on its own batch of grain.
  useEffect(() => {
    if (grain.current) paintGrain(grain.current, settled)
    if (seen && print.current) develop(print.current, { always: true, duration: 1700 })
  }, [settled, seen])

  const notes = score(settled, "crisp")
  const play = () => playChime(notes, (i: number) => setLit(i))

  return (
    <section className="signed" ref={ref}>
      <div className="wrap-x signed-head">
        <h2 className="section-title">Every project signs its work.</h2>
        <p className="section-line">Its seal, its chime, its grain and its print, all from its name.</p>
      </div>
      <div
        className="print-stage"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - r.left) / r.width
          const y = (e.clientY - r.top) / r.height
          const s = e.currentTarget.style
          s.setProperty("--rx", `${((0.5 - y) * 7).toFixed(2)}deg`)
          s.setProperty("--ry", `${((x - 0.5) * 9).toFixed(2)}deg`)
          s.setProperty("--sx", `${(x * 100).toFixed(1)}%`)
          s.setProperty("--sy", `${(y * 100).toFixed(1)}%`)
        }}
        onPointerLeave={(e) => {
          for (const p of ["--rx", "--ry", "--sx", "--sy"]) e.currentTarget.style.removeProperty(p)
        }}
      >
        <div className="print" ref={print}>
          <ShareCard name={settled} line="Signed in light." className="print-card" />
          <canvas className="print-grain" ref={grain} width={600} height={315} aria-hidden />
        </div>
      </div>
      <div className="print-strip">
        <label className="print-name">
          <span>Name</span>
          <input
            value={name}
            placeholder={FIRST}
            maxLength={22}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              touched.current = true
              setName(e.target.value)
            }}
          />
        </label>
        <div className="print-score">
          <button type="button" className="print-seal" aria-label={`Play ${settled}'s chime`} onClick={play} dangerouslySetInnerHTML={{ __html: sealSvg(settled, 44, { lit }) }} />
          <ol className="print-notes" aria-label="Its chime">
            {notes.map((n, i) => (
              <li key={i} data-on={lit === i ? "" : undefined} style={{ ["--h" as string]: Math.min(1, (n.frequency - 240) / 300).toFixed(2) }}>
                <i aria-hidden />
                <span>{noteName(n.frequency)}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="print-play" onClick={play}>
            Play
          </button>
        </div>
        <p className="print-batch">
          Batch <span>{batch(settled)}</span>
        </p>
      </div>
    </section>
  )
}
