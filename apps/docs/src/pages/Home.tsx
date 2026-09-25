import { Button, Facts, Heading, Keys, List, ListRow, Serif, Stage, State, Surface, Switch, Text, Value, useToast } from "@halation/react"
import { useState } from "react"
import { Code } from "../parts/Code.tsx"
import { Link } from "../router.tsx"

export function Home() {
  return (
    <>
      <Stage phenomenon="rays" daylight className="hero" intensity={1}>
        <div className="hero-inner" data-quiet="">
          <Text size="body-sm" tone="muted">
            A design system for people who care, and the agents who work for them
          </Text>
          <Heading level={1}>
            Your taste, <Serif>everywhere.</Serif>
          </Heading>
          <Text size="body-lg" className="lead">
            Halation holds your taste as rules: colors computed and proven for contrast, components that behave, light and motion with character, and checks that run inside every agent's loop. Every project starts on-brand and can't drift off it.
          </Text>
          <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
            <Link href="/start" className="hl-button" data-variant="ink" data-size="lg" data-shape="pill">
              Start a project
            </Link>
            <Link href="/components" className="hl-button" data-size="lg" data-shape="pill">
              See the components
            </Link>
          </div>
        </div>
      </Stage>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker">Three layers</p>
            <Heading level={2}>
              Same rules, <Serif>different</Serif> places.
            </Heading>
            <Text size="body-lg" tone="muted" className="lead">
              Projects built from one system usually look alike. Halation splits every project into three layers, and only the first one is fixed.
            </Text>
          </div>
          <div className="grid-3">
            <div className="point">
              <h3>Grammar</h3>
              <p>The rules: contrast, one color used as a signal, sentence case, no dots joining facts, the motion laws. Always enforced, the same everywhere.</p>
            </div>
            <div className="point">
              <h3>Character</h3>
              <p>What a project chooses: its phenomenon, its type voice, its tempo, its shapes, the temperature of its greys and its one accent.</p>
            </div>
            <div className="point">
              <h3>Signature</h3>
              <p>Generated from the project's name: a seal that plays its own chime, a lit edge, a grain of its own, credits that roll.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid-2" style={{ alignItems: "center" }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <p className="kicker">In the hand</p>
            <Heading level={2}>
              It behaves the way it <Serif>looks.</Serif>
            </Heading>
            <Text size="body-lg" tone="muted" className="lead">
              Built on Base UI, so every control is accessible and keyboard-complete. States are words with a glyph, facts sit on their own lines, numbers line up, and a finished action blooms once.
            </Text>
          </div>
          <Glimpse />
        </div>
      </section>

      <section className="section">
        <div className="wrap grid-2" style={{ alignItems: "start" }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <p className="kicker">For agents</p>
            <Heading level={2}>
              Taste an agent can't <Serif>argue</Serif> with.
            </Heading>
            <Text size="body-lg" tone="muted" className="lead">
              A skill that teaches the system, lint that runs after every edit and hands problems back, and a check of the rendered page. Off-system colors and sizes simply don't exist.
            </Text>
          </div>
          <div className="stack">
            <Code label="A new project">{`npm create halation my-app`}</Code>
            <Code label="An existing one">{`npm i @halation/react\nnpm i -D @halation/cli\nnpx halation init`}</Code>
          </div>
        </div>
      </section>
    </>
  )
}

function Glimpse() {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [login, setLogin] = useState(true)
  return (
    <Surface elevation="raised" padding="none">
      <List>
        <ListRow selected title="Claude Work" detail="Copy of Claude" trailing={<State kind="running">Running</State>} />
        <ListRow title="Code Side Project" detail="Copy of Visual Studio Code" trailing={<State kind="warning">Needs repair</State>} />
        <ListRow title="Chrome Testing" detail="Launcher" trailing={<Value unit="MB">173</Value>} />
      </List>
      <div style={{ padding: 16, display: "grid", gap: 14, boxShadow: "inset 0 1px 0 var(--color-line)" }}>
        <Facts items={[["Size", <Value unit="MB">412</Value>], ["Switch to it", <Keys keys={["⌃", "⌥", "1"]} />]]} />
        <Switch label="Open at login" checked={login} onCheckedChange={setLogin} />
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={() => toast({ title: "Copy duplicated", description: "Claude Work 2 is ready to open.", type: "success" })}>
            Duplicate
          </Button>
          <Button
            variant="ink"
            busy={saving}
            busyLabel="Saving"
            done={saved}
            doneLabel="Saved"
            onClick={() => {
              setSaving(true)
              setTimeout(() => {
                setSaving(false)
                setSaved(true)
                setTimeout(() => setSaved(false), 1800)
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
