import { Button, Facts, Stage, State, type PhenomenonName, type StateKind } from "@halation/react"
import { useEffect, useState, type ReactNode } from "react"
import { reducedMotion, useSeen } from "./scroll.ts"

type Lens = "editorial" | "poster" | "classic" | "quiet"
type World = { name: string; domain: string; light: PhenomenonName; lens: Lens; accent: "vermilion" | "cobalt" | "jade" | "amber"; tempo: "calm" | "crisp" | "lively"; form: "soft" | "sharp" | "round"; head: ReactNode; sub: string; row: string; state: [StateKind, string]; fact: [string, string]; action: string }

const WORLDS: World[] = [
  { name: "Parallex", domain: "parallex.app", light: "rays", lens: "editorial", accent: "vermilion", tempo: "crisp", form: "soft", head: <>Every app. <em>Twice.</em></>, sub: "Run separate copies of any Mac app.", row: "Claude Work", state: ["running", "Running"], fact: ["Size", "412 MB"], action: "Download for Mac" },
  { name: "Tally", domain: "tally.money", light: "blinds", lens: "poster", accent: "jade", tempo: "lively", form: "sharp", head: <>Money, counted.</>, sub: "Shared budgets for households.", row: "Groceries", state: ["done", "On track"], fact: ["Left", "$412"], action: "Start a budget" },
  { name: "Margins", domain: "margins.pub", light: "caustics", lens: "classic", accent: "cobalt", tempo: "calm", form: "soft", head: <>Notes in the margins</>, sub: "Read closely, keep what stays.", row: "The Waves", state: ["info", "Reading"], fact: ["Highlights", "38"], action: "Open the library" },
  { name: "Shoebox", domain: "shoebox.photos", light: "stir", lens: "quiet", accent: "amber", tempo: "calm", form: "round", head: <>Every photo, kept.</>, sub: "A quiet home for the family archive.", row: "Summer 1998", state: ["running", "Scanning"], fact: ["Photos", "1,204"], action: "Start an album" },
]

const DWELL = 3000

/**
 * Character: four projects on the same rules, fanned like prints on a table.
 * Each comes forward once in turn; after that, any can be picked.
 */
export function Worlds() {
  const [ref, seen] = useSeen<HTMLElement>(0.35)
  const [front, setFront] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (seen && !reducedMotion()) setPlaying(true)
  }, [seen])

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (front < WORLDS.length - 1) setFront(front + 1)
      else setPlaying(false)
    }, DWELL)
    return () => clearTimeout(t)
  }, [front, playing])

  return (
    <section className="worlds" ref={ref}>
      <div className="wrap-x worlds-head">
        <h2 className="section-title">Every project looks like itself.</h2>
        <p className="section-line">Same rules underneath. Its own light, type, tempo and color on top.</p>
      </div>
      <div className="worlds-table">
        {WORLDS.map((w, i) => {
          const rank = (i - front + WORLDS.length) % WORLDS.length
          return (
            <div
              key={w.name}
              className="world"
              data-rank={rank}
              data-accent={w.accent}
              data-tempo={w.tempo}
              data-lens={w.lens}
              data-form={w.form}
              onClick={() => {
                setPlaying(false)
                setFront(i)
              }}
              aria-hidden={rank !== 0}
            >
              <div className="world-bar">
                <span>{w.domain}</span>
              </div>
              <Stage phenomenon={w.light} mode="dark" daylight className="world-stage">
                <div className="world-site">
                  <div className="world-hero" data-quiet="">
                    <h3 className="world-title">{w.head}</h3>
                    <p className="world-sub">{w.sub}</p>
                    <Button variant="ink" size="sm" shape={w.form === "round" ? "pill" : undefined} tabIndex={-1}>
                      {w.action}
                    </Button>
                  </div>
                  <div className="world-card">
                    <div className="world-row">
                      <span>{w.row}</span>
                      <State kind={w.state[0]}>{w.state[1]}</State>
                    </div>
                    <Facts items={[w.fact]} />
                  </div>
                </div>
              </Stage>
            </div>
          )
        })}
      </div>
      <div className="worlds-names" role="tablist" aria-label="Sample projects">
        {WORLDS.map((w, i) => (
          <button
            key={w.name}
            type="button"
            role="tab"
            aria-selected={i === front}
            onClick={() => {
              setPlaying(false)
              setFront(i)
            }}
          >
            {w.name}
          </button>
        ))}
      </div>
    </section>
  )
}
