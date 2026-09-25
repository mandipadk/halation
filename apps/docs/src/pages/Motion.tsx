import { Button, Count, Dialog, Menu, Rise, SegmentedControl, Serif, Switch, Text } from "@halation/react"
import { setTempo } from "@halation/core/motion"
import { useEffect, useState } from "react"
import { Demo, PageHead } from "../parts/Demo.tsx"

const LAWS: [string, string][] = [
  ["Motion starts where you acted", "A menu grows out of its button. Nothing arrives from nowhere."],
  ["Things travel; they don't pop", "An object that moves keeps its identity from one place to the next."],
  ["Hands get springs, the system gets curves", "What you drag keeps your speed. What the interface does on its own follows the curve."],
  ["Focus, not flash", "Attention shifts the way a lens does: what matters sharpens, the rest softens."],
  ["Heavy things move slower", "A tooltip takes 180 ms, a dialog 240, a sheet 500."],
  ["Everything can change its mind", "Any motion reverses from wherever it is, and input never waits for it."],
  ["Stillness is the default", "Nothing moves unless something happened. No idle loops."],
  ["Less motion keeps the meaning", "For people who ask for less, travel becomes a fade and order stays."],
]

export function Motion() {
  const [tempo, setTempoState] = useState<"calm" | "crisp" | "lively">("crisp")
  const [n, setN] = useState(0)
  const [value, setValue] = useState(4820)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    if (tempo === "crisp") delete root.dataset.tempo
    else root.dataset.tempo = tempo
    setTempo(tempo)
    return () => {
      delete root.dataset.tempo
      setTempo("crisp")
    }
  }, [tempo])
  return (
    <div className="wrap">
      <PageHead kicker="Motion" title={<>Things move because something <Serif>happened.</Serif></>}>
        Physics, so things have weight and keep their speed, and the camera, so attention moves the way focus does. Change the tempo and try each move again.
      </PageHead>
      <div className="row" style={{ marginBottom: 40 }}>
        <SegmentedControl aria-label="Tempo" value={tempo} onValueChange={setTempoState} options={[{ value: "calm", label: "Calm" }, { value: "crisp", label: "Crisp" }, { value: "lively", label: "Lively" }]} />
      </div>
      <section className="section">
        <div className="grid-3">
          {LAWS.map(([t, d]) => (
            <div className="point" key={t}>
              <h3 style={{ fontSize: "var(--text-body)" }}>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="demos" style={{ paddingBottom: 96 }}>
        <Demo title="Rise" about="Content arrives in reading order out of a soft blur, 50 ms apart, six at most.">
          <Rise key={n} className="stack" style={{ justifyItems: "center", textAlign: "center" }}>
            <Text size="caption" tone="accent">New in 1.0</Text>
            <p className="hl-text-title-1">
              Separate by <Serif>default.</Serif>
            </p>
            <Text tone="muted">Each copy keeps its own accounts, data and Dock icon.</Text>
          </Rise>
          <Button size="sm" onClick={() => setN(n + 1)}>
            Replay
          </Button>
        </Demo>
        <Demo title="Unfold and focus pull" about="The menu grows from its trigger; the dialog pulls focus while the page behind softens.">
          <div className="row">
            <Menu.Root>
              <Menu.Trigger render={<Button>Sort by</Button>} />
              <Menu.Popup>
                <Menu.Item keys={["⌥", "N"]}>Name</Menu.Item>
                <Menu.Item keys={["⌥", "D"]}>Date modified</Menu.Item>
                <Menu.Item keys={["⌥", "S"]}>Size</Menu.Item>
              </Menu.Popup>
            </Menu.Root>
            <Dialog.Root>
              <Dialog.Trigger render={<Button>Open a dialog</Button>} />
              <Dialog.Popup title="Focus, not flash" description="The page behind softened as this came into focus. It sharpens as this leaves." actions={<Dialog.Close render={<Button variant="ink">Close</Button>} />} />
            </Dialog.Root>
          </div>
        </Demo>
        <Demo title="Settle and bloom" about="The switch's thumb springs with the tempo's bounce. A finished action glows once.">
          <div className="row">
            <Switch label="Wi-Fi" defaultChecked />
            <Button
              variant="ink"
              done={saved}
              doneLabel="Saved"
              onClick={() => {
                setSaved(true)
                setTimeout(() => setSaved(false), 1800)
              }}
            >
              Save changes
            </Button>
          </div>
        </Demo>
        <Demo title="Count" about="Digits roll to their new value, right to left.">
          <Count value={value} className="hl-text-display" />
          <Button size="sm" onClick={() => setValue(value + Math.round(50 + Math.random() * 700))}>
            More
          </Button>
        </Demo>
      </div>
    </div>
  )
}
