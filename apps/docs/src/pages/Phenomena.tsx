import { Facts, Heading, SegmentedControl, Serif, Slider, Stage, Switch, Text, type PhenomenonName } from "@halation/react"
import { lightAt } from "@halation/core/phenomena"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { PageHead } from "../parts/Demo.tsx"

type Entry = { name: PhenomenonName; title: string; about: string; touch?: string; headline: ReactNode; sub: string }

const ENTRIES: Entry[] = [
  { name: "rays", title: "Rays", about: "Soft beams from a gap above the frame, slowly turning.", headline: <>Every app. <Serif>Twice.</Serif></>, sub: "Run separate copies of any Mac app, each with its own accounts." },
  { name: "blinds", title: "Blinds", about: "A low sun through blinds, thrown across the wall. The shadows soften as they fall, and a cloud passes now and then.", headline: <>Your desk, <Serif>by the window.</Serif></>, sub: "Plan the week in the good light." },
  { name: "caustics", title: "Caustics", about: "Waves focus the sun into bright threads, worked out from the waves themselves.", headline: <>Clear to the <Serif>bottom.</Serif></>, sub: "See every layer of your data, down to the row." },
  { name: "halation", title: "Halation", about: "The brightest parts of the page glow in the accent's hue. The system is named after it.", headline: <>Shot on <Serif>film.</Serif></>, sub: "Edit photos with the grain and the glow left in." },
  { name: "stir", title: "Stir", about: "Haze and dust in a beam. Move through it and the air swirls, then settles.", touch: "Move through the beam", headline: <>The small things, <Serif>noticed.</Serif></>, sub: "Every change, caught before it ships." },
  { name: "ink", title: "Ink", about: "A real fluid: push it with the pointer, click to drop more.", touch: "Move to stir, click to drop ink", headline: <>Ideas, <Serif>in motion.</Serif></>, sub: "A canvas that moves when you do." },
  { name: "ripple", title: "Ripple", about: "Real waves over a hairline floor. Trail through it; click to drop a stone.", touch: "Trail through the water", headline: <>Still <Serif>water.</Serif></>, sub: "Twenty minutes of quiet, whenever you need it." },
  { name: "silk", title: "Silk", about: "Cloth lit the way fiber is lit: ribbons of shine slide over the folds.", touch: "Move to tilt the light", headline: <>Cut from <Serif>light.</Serif></>, sub: "Garments made to order in a small studio." },
  { name: "foil", title: "Foil", about: "The heading pressed into card and stamped in the accent's foil. The pointer is a lamp over the paper.", touch: "Move the lamp across the paper", headline: <>Pressed into <Serif>paper.</Serif></>, sub: "Stationery printed on a 1962 Heidelberg." },
  { name: "growth", title: "Growth", about: "Grows from a few seeds and anything you draw, fills its space, then rests.", touch: "Draw to seed new growth", headline: <>Let it <Serif>grow.</Serif></>, sub: "Lab notebooks for teams who study living things." },
]

/** Mounts a stage only once it comes near the viewport. */
function Near({ children, height, id }: { children: ReactNode; height: string; id: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "600px 0px" })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} id={id} className="near" style={{ minHeight: near ? undefined : height }}>{near ? children : null}</div>
}

export function Phenomena() {
  const now = new Date()
  const [daylight, setDaylight] = useState(true)
  const [minutes, setMinutes] = useState(now.getHours() * 60 + now.getMinutes())
  const [speed, setSpeed] = useState<"still" | "slow" | "live">("live")
  const moment = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(minutes / 60), minutes % 60)
  const state = lightAt(minutes / 60, 268)
  return (
    <>
      <div className="wrap">
        <PageHead kicker="Phenomena" title={<>Things the world does.</>}>
          Ten real processes, simulated rather than faked, each answering your pointer and the time of day. One per page, behind content, dimmed where the words are.
        </PageHead>
        <div className="glass" style={{ display: "grid", gap: 14, marginBottom: 48 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <Switch label="Follow the time of day" checked={daylight} onCheckedChange={setDaylight} />
            <SegmentedControl aria-label="Motion" value={speed} onValueChange={setSpeed} options={[{ value: "still", label: "Still" }, { value: "slow", label: "Slow" }, { value: "live", label: "Live" }]} />
          </div>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <Slider aria-label="Time of day" min={0} max={1439} value={minutes} onValueChange={(v) => setMinutes(Array.isArray(v) ? v[0] : v)} disabled={!daylight} />
            <Facts items={[[moment.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), state.phase[0].toUpperCase() + state.phase.slice(1)]]} style={{ minWidth: 170 }} />
          </div>
        </div>
      </div>
      {ENTRIES.map((e) => (
        <Near key={e.name} id={e.name} height="640px">
          <Stage phenomenon={e.name} daylight={daylight ? moment : false} speed={{ still: 0, slow: 0.45, live: 1 }[speed]} className="stage-card">
            <div className="stage-sample" data-quiet="">
              <Heading level={2} size="display-xl" data-press={e.name === "foil" ? "" : undefined}>
                {e.headline}
              </Heading>
              <Text size="body-lg">{e.sub}</Text>
            </div>
            <div className="wrap stage-info">
              <div className="glass" style={{ maxWidth: 560, display: "grid", gap: 8 }}>
                <Heading level={3} size="title-2">
                  {e.title}
                </Heading>
                <Text size="body-sm" tone="muted">
                  {e.about}
                </Text>
                {e.touch ? <Facts items={[["Touch", e.touch]]} /> : null}
              </div>
            </div>
          </Stage>
        </Near>
      ))}
    </>
  )
}
