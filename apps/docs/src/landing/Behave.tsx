import { Button, Facts, Keys, List, ListRow, SegmentedControl, Slider, State, Surface, Switch, useToast } from "@halation/react"
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { reducedMotion } from "./scroll.ts"
import { useSite } from "../site.tsx"

/**
 * Components: real, working pieces laid out at different depths. They drift
 * with the pointer and the scroll by how far away they sit; all of them work.
 */
export function Behave() {
  const field = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = field.current
    if (!el || reducedMotion()) return
    let frame = 0
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      tx = (e.clientX - r.left) / r.width - 0.5
      ty = (e.clientY - r.top) / r.height - 0.5
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const tick = () => {
      x += (tx - x) * 0.12
      y += (ty - y) * 0.12
      el.style.setProperty("--mx", x.toFixed(4))
      el.style.setProperty("--my", y.toFixed(4))
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.001 ? requestAnimationFrame(tick) : 0
    }
    el.addEventListener("pointermove", move)
    return () => {
      el.removeEventListener("pointermove", move)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section className="behave">
      <div className="wrap-x behave-head">
        <h2 className="section-title">Components that behave.</h2>
        <p className="section-line">Built on Base UI. Every one of these works; try them.</p>
      </div>
      <div className="behave-field" ref={field}>
        <Piece x={2} y={16} depth={0.9} width={340}>
          <Surface elevation="raised" padding="none">
            <List>
              <ListRow selected title="Claude Work" detail="Copy of Claude" trailing={<State kind="running">Running</State>} />
              <ListRow title="Code Side Project" detail="Copy of VS Code" trailing={<State kind="warning">Needs repair</State>} />
              <ListRow title="Chrome Testing" detail="Launcher" trailing={<State kind="draft">Stopped</State>} />
            </List>
          </Surface>
        </Piece>
        <Piece x={38} y={2} depth={0.4} width={240}>
          <Surface elevation="raised">
            <Switch label="Open at login" defaultChecked />
          </Surface>
        </Piece>
        <Piece x={71} y={12} depth={1.2} width={290}>
          <Surface elevation="raised">
            <Facts
              items={[
                ["Size", "412 MB"],
                ["Switch to it", <Keys keys={["⌃", "⌥", "1"]} />],
              ]}
            />
          </Surface>
        </Piece>
        <Piece x={35} y={36} depth={1.5} width={330}>
          <SaveCard />
        </Piece>
        <Piece x={8} y={70} depth={0.6} width={280}>
          <Surface elevation="raised">
            <Appearance />
          </Surface>
        </Piece>
        <Piece x={68} y={62} depth={0.8} width={290}>
          <Surface elevation="raised">
            <div className="behave-slider">
              <span>Glow</span>
              <Slider defaultValue={62} aria-label="Glow" />
            </div>
          </Surface>
        </Piece>
      </div>
    </section>
  )
}

function Piece({ x, y, depth, width, children }: { x: number; y: number; depth: number; width: number; children: ReactNode }) {
  return (
    <div className="piece" style={{ left: `${x}%`, top: `${y}%`, width, ["--d" as string]: depth } as CSSProperties}>
      {children}
    </div>
  )
}

function SaveCard() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  return (
    <Surface elevation="overlay">
      <div className="behave-save">
        <p>Save your changes to Claude Work?</p>
        <div className="behave-actions">
          <Button variant="ghost" onClick={() => toast({ title: "Changes kept as a draft", type: "info" })}>
            Later
          </Button>
          <Button
            variant="ink"
            busy={busy}
            busyLabel="Saving"
            done={done}
            doneLabel="Saved"
            onClick={() => {
              setBusy(true)
              setTimeout(() => {
                setBusy(false)
                setDone(true)
                setTimeout(() => setDone(false), 1600)
              }, 700)
            }}
          >
            Save changes
          </Button>
        </div>
      </div>
    </Surface>
  )
}

/** The page's real appearance switch: it changes this whole site, not a demo. */
function Appearance() {
  const { theme, setTheme } = useSite()
  return (
    <SegmentedControl
      aria-label="Appearance of this site"
      value={theme}
      onValueChange={setTheme}
      options={[
        { value: "system", label: "System" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
    />
  )
}
