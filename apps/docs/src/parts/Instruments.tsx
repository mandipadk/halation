import { formatClock, sky } from "@halation/core/instruments"
import { AccentForge, Button, Dial, Lens, LightTable, LitTabs, ShortcutRecorder, Sundial, type LensGroup, type Print, type RecorderMessage } from "@halation/react"
import { useMemo, useState } from "react"
import { Demo } from "./Demo.tsx"

const app = (
  <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="2.5" y="2.5" width="13" height="13" rx="3.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6 12.5 8.2 5.5M10 12.5l2-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)
const plus = (
  <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export function LensDemo() {
  const [open, setOpen] = useState(false)
  const [said, setSaid] = useState("")
  const groups: LensGroup[] = [
    { name: "Copies", items: ["Claude Work", "Code Side Project", "Chrome Testing", "Claude Personal"].map((t) => ({ id: t.toLowerCase().replace(/\s/g, "-"), title: t, detail: t.startsWith("Chrome") ? "Launcher" : "Copy of an app", icon: app })) },
    { name: "Actions", items: [{ id: "new", title: "New copy", detail: "Of any app", icon: plus, keys: ["⌘", "N"] }, { id: "dup", title: "Duplicate Claude Work", detail: "With its accounts", icon: plus, keys: ["⌘", "D"] }] },
  ]
  return (
    <Demo
      title="Lens"
      about="A command palette that pulls focus. The row you’re on sits in a lit carriage; the rest soften the further they are from it, and the page behind blurs while it’s open. Press ⌘K anywhere on this site for the real one."
      code={`const [open, setOpen] = useState(false)
useLensShortcut(() => setOpen(true))

<Lens open={open} onOpenChange={setOpen} groups={[
  { name: "Copies", items: [{ id: "work", title: "Claude Work", onSelect: openWork }] },
]} />`}
    >
      <div className="stack" style={{ justifyItems: "center" }}>
        <Button onClick={() => setOpen(true)}>Open Lens</Button>
        <p className="hl-text-body-sm hl-tone-muted" aria-live="polite">{said || "Choose something to see what happens."}</p>
      </div>
      <Lens open={open} onOpenChange={setOpen} groups={groups} placeholder="Search copies and actions" onSelect={(i) => setSaid(`Opened ${i.title}.`)} />
    </Demo>
  )
}

export function ShortcutDemo() {
  const [keys, setKeys] = useState(["⌃", "⌥", "1"])
  const [note, setNote] = useState<RecorderMessage>({ text: "Press the shortcut to record a new one.", tone: "info" })
  return (
    <Demo
      title="Shortcut recorder"
      about="Keycaps with weight: they drop in, go down while you hold them and light from beneath. A taken shortcut is refused with the reason, in words."
      code={`<ShortcutRecorder value={keys} onValueChange={setKeys} label="Switches to Claude Work" onMessage={setNote} />`}
    >
      <div className="recorder-demo">
        <div className="recorder-row">
          <div>
            <p className="hl-text-body" style={{ fontWeight: 550 }}>Switch to Claude Work</p>
            <p className="hl-text-body-sm hl-tone-muted">Brings the copy forward from anywhere</p>
          </div>
          <ShortcutRecorder value={keys} onValueChange={setKeys} label="Switches to Claude Work" onMessage={setNote} />
        </div>
        <p className="recorder-note" data-tone={note.tone} aria-hidden="true">{note.text}</p>
      </div>
    </Demo>
  )
}

export function SundialDemo() {
  const [minutes, setMinutes] = useState(21 * 60 + 30)
  const day = useMemo(() => sky({ sunrise: 408, sunset: 1142 }), [])
  const [time, ampm] = formatClock(minutes)
  const now = day.describe(minutes)
  const [rt, ra] = formatClock(day.sunrise), [st, sa] = formatClock(day.sunset)
  return (
    <Demo
      title="Sundial"
      about="A time picker set by moving the sun. The face shows the real sky for that minute from Halation’s daylight model: it warms at golden hour, the sun sets behind the horizon, and at night the handle becomes a moon."
      code={`<Sundial value={minutes} onValueChange={setMinutes} label="Quiet hours begin at" />`}
    >
      <div className="sundial-demo">
        <Sundial value={minutes} onValueChange={setMinutes} label="Quiet hours begin at" sunrise={408} sunset={1142} />
        <div className="sundial-read">
          <p className="hl-text-body-sm hl-tone-muted">Quiet hours begin at</p>
          <p className="sundial-time">
            {time}
            <small>{ampm}</small>
          </p>
          <p className="hl-text-body">
            <b>{now.phase}.</b> {now.line}
          </p>
          <dl className="sundial-facts">
            <dt>Sunrise</dt>
            <dd>{`${rt} ${ra}`}</dd>
            <dt>Sunset</dt>
            <dd>{`${st} ${sa}`}</dd>
          </dl>
        </div>
      </div>
    </Demo>
  )
}

export function LitTabsDemo() {
  const item = (value: string, label: string, head: string, body: string) => ({
    value,
    label,
    content: (
      <div className="lit-panel">
        <p className="hl-text-title-3">{head}</p>
        <p className="hl-text-body-sm hl-tone-muted">{body}</p>
      </div>
    ),
  })
  return (
    <Demo
      title="Lit tabs"
      about="The selection is a carriage of light, and the labels catch it: each gains weight as the light passes beneath it. Jump from the first to the last and watch the ones between."
      code={`<LitTabs aria-label="Sections" items={[{ value: "all", label: "Overview", content: <Overview /> }, …]} />`}
    >
      <div className="lit-wrap">
        <LitTabs
          aria-label="Sections"
          items={[
            item("overview", "Overview", "Everything at a glance", "Four copies, two running, one waiting on an update."),
            item("copies", "Copies", "Every copy you’ve made", "Each keeps its own accounts, settings and history."),
            item("launchers", "Launchers", "Shortcuts to your apps", "Open a copy from the menu bar or the Dock."),
            item("activity", "Activity", "What happened, and when", "Updates, repairs and restores from the last thirty days."),
            item("settings", "Settings", "How Parallex behaves", "Login items, quiet hours, and where copies are kept."),
          ]}
        />
      </div>
    </Demo>
  )
}

export function DialDemo() {
  const [level, setLevel] = useState(60)
  return (
    <Demo
      title="Dial"
      about="A knob you can feel. It clicks into place at each step, the ticks light up to where it’s turned, and the number rolls. Here it dims a real light."
      code={`<Dial value={level} onValueChange={setLevel} label="Intensity" />`}
    >
      <div className="dial-demo">
        <Dial value={level} onValueChange={setLevel} label="Intensity" />
        <div className="lamp-col">
          <div className="lamp" style={{ ["--level" as string]: (0.08 + (level / 100) * 0.85).toFixed(3) }}>
            <span className="lamp-beam" />
            <span className="lamp-fixture" />
          </div>
          <p className="hl-text-body-sm" style={{ fontWeight: 550 }}>Stage light</p>
          <p className="hl-text-body-sm hl-tone-muted">{level === 0 ? "Off" : `At ${level} percent`}</p>
        </div>
      </div>
    </Demo>
  )
}

export function ForgeDemo() {
  const [hue, setHue] = useState(37)
  return (
    <Demo
      title="Accent forge"
      about="An accent picker that picks every role at once. Turn the ring: the button, links, selection and focus ring are derived from the hue, each text color solved for contrast and measured in both modes. Purple is closed off."
      code={`<AccentForge hue={hue} onHueChange={setHue} />

// Or derive the roles yourself:
import { deriveAccent } from "@halation/core/color"`}
    >
      <AccentForge hue={hue} onHueChange={setHue} />
    </Demo>
  )
}

/** A first print for the table, drawn once: a harbor at golden hour. */
function samplePrint(): Print[] {
  if (typeof document === "undefined") return []
  const c = document.createElement("canvas")
  c.width = 480
  c.height = 360
  const g = c.getContext("2d")
  if (!g) return []
  const sky = g.createLinearGradient(0, 0, 0, 360)
  sky.addColorStop(0, "#2d3a4f")
  sky.addColorStop(0.55, "#d88d5e")
  sky.addColorStop(0.75, "#f2c28a")
  g.fillStyle = sky
  g.fillRect(0, 0, 480, 360)
  g.fillStyle = "#fff4dc"
  g.beginPath()
  g.arc(300, 238, 26, 0, Math.PI * 2)
  g.fill()
  const hill = (y: number, amp: number, color: string, f: number) => {
    g.fillStyle = color
    g.beginPath()
    g.moveTo(0, 360)
    for (let x = 0; x <= 480; x += 8) g.lineTo(x, y + Math.sin(x * f) * amp + Math.sin(x * f * 2.7) * amp * 0.4)
    g.lineTo(480, 360)
    g.fill()
  }
  hill(258, 14, "#6b4a45", 0.011)
  hill(282, 18, "#3d2d33", 0.008)
  hill(312, 12, "#1d171c", 0.014)
  return [{ src: c.toDataURL("image/jpeg", 0.9), name: "Harbor, 7:04 pm.jpg", caption: "Sample print" }]
}

export function LightTableDemo() {
  const initial = useMemo(samplePrint, [])
  return (
    <Demo
      title="Light table"
      about="A drop zone that behaves like a light table. It backlights where your file hovers, and dropped photos land as prints that develop, each on a grain of its own. Nothing is uploaded here."
      code={`<LightTable onFiles={upload} />`}
      center={false}
    >
      <LightTable initial={initial} />
    </Demo>
  )
}

export function Instruments() {
  return (
    <>
      <LensDemo />
      <ShortcutDemo />
      <SundialDemo />
      <LitTabsDemo />
      <DialDemo />
      <ForgeDemo />
      <LightTableDemo />
    </>
  )
}

