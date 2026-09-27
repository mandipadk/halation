import { Button, Facts, State } from "@halation/react"
import { useEffect, useState, type ReactNode } from "react"
import { reducedMotion, useSeen } from "./scroll.ts"

const DOT = "·"

type Rule = { says: string; was: ReactNode; now: ReactNode; wasNote: string; nowNote: string; fixAfter?: number }

// Each rule, and a small piece of interface an agent gets wrong, then right.
const RULES: Rule[] = [
  {
    says: "Say it in sentence case.",
    wasNote: "An agent’s label, in spaced-out capitals",
    nowNote: "The same label, as Halation sets it",
    was: <span className="spec-caps">Project status</span>,
    now: <span className="spec-title">Project status</span>,
  },
  {
    says: "A state is a word, not a dot.",
    wasNote: "A green dot, which says nothing on its own",
    nowNote: "A state in words, with a shape",
    was: (
      <span className="spec-pill">
        <i aria-hidden /> Active
      </span>
    ),
    now: <State kind="running">Syncing</State>,
  },
  {
    says: "Facts get their own lines.",
    wasNote: "Three facts in one string",
    nowNote: "Each fact on its own line",
    was: <span className="spec-meta">412 MB {DOT} 3 members {DOT} 2h ago</span>,
    now: (
      <Facts
        items={[
          ["Size", "412 MB"],
          ["Members", "3"],
        ]}
      />
    ),
  },
  {
    says: "Light, not paint.",
    wasNote: "A gradient button",
    nowNote: "The main action, in ink",
    was: <span className="spec-gradient">Open project</span>,
    now: (
      <Button variant="ink" tabIndex={-1}>
        Open project
      </Button>
    ),
  },
  {
    says: "Motion that doesn’t make you wait.",
    fixAfter: 2000,
    wasNote: "A switch that takes 1.5 seconds to move",
    nowNote: "The same switch, in 0.22 seconds",
    was: (
      <span className="spec-toggle" data-slow="">
        <i aria-hidden />
      </span>
    ),
    now: (
      <span className="spec-toggle">
        <i aria-hidden />
      </span>
    ),
  },
]

const DWELL = 3400
const FIX_AFTER = 1200

/**
 * The rules, one at a time and large. Under each, the piece an agent makes by
 * default corrects itself. Plays through once when it comes into view.
 */
export function Rules() {
  const [ref, seen] = useSeen<HTMLElement>(0.45)
  const [index, setIndex] = useState(0)
  const [fixed, setFixed] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!seen) return
    if (reducedMotion()) return setFixed(true)
    setPlaying(true)
  }, [seen])

  // The piece shows as an agent writes it, then corrects itself. Only a new rule restarts that.
  useEffect(() => {
    if (!seen) return
    setFixed(false)
    const fix = setTimeout(() => setFixed(true), reducedMotion() ? 0 : (RULES[index].fixAfter ?? FIX_AFTER))
    return () => clearTimeout(fix)
  }, [index, seen])

  // While playing, move on after each rule's turn; after the last, rest.
  useEffect(() => {
    if (!playing) return
    const next = setTimeout(() => {
      if (index < RULES.length - 1) setIndex(index + 1)
      else setPlaying(false)
    }, DWELL + (RULES[index].fixAfter ?? FIX_AFTER) - FIX_AFTER)
    return () => clearTimeout(next)
  }, [index, playing])

  const rule = RULES[index]
  return (
    <section className="rules" ref={ref}>
      <div className="wrap-x rules-body">
        <p className="rules-kicker">Eighteen rules, kept by the theme, by lint and by a check of the rendered page.</p>
        <h2 className="rules-says" key={index} aria-live="polite">
          {rule.says.split(" ").map((w, i) => (
            <span key={i} style={{ ["--w" as string]: i }}>
              {w}{" "}
            </span>
          ))}
        </h2>
        <div className="rules-spec" data-counterexample="" data-fixed={fixed ? "" : undefined} key={`s${index}`}>
          <div className="spec-was" aria-hidden={fixed}>
            {rule.was}
          </div>
          <div className="spec-now" aria-hidden={!fixed}>
            {rule.now}
          </div>
        </div>
        <p className="rules-note" key={`n${index}-${fixed}`}>{fixed ? rule.nowNote : rule.wasNote}</p>
        <div className="rules-steps" role="tablist" aria-label="Rules">
          {RULES.map((r, i) => (
            <button
              key={r.says}
              type="button"
              role="tab"
              aria-label={r.says}
              aria-selected={i === index}
              data-done={i < index ? "" : undefined}
              data-running={i === index && playing ? "" : undefined}
              style={{ ["--dwell" as string]: `${DWELL + (r.fixAfter ?? FIX_AFTER) - FIX_AFTER}ms` }}
              onClick={() => {
                setPlaying(false)
                setIndex(i)
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
