import { Avatar, Button, Checkbox, Count, Facts, Field, Input, Keys, List, ListRow, Radio, RadioGroup, SegmentedControl, Skeleton, Slider, State, Surface, Switch, Tabs, Text, Textarea, Value, icons } from "@halation/react"
import type { ReactNode } from "react"
import { PageHead } from "../parts/Demo.tsx"

// Every component in each of its states, laid out plainly. The page check and
// the proof run over this page too, so a disabled, invalid or overlong state
// is measured like the ones people scroll to.

const LONG = "Opens at login, quits after thirty minutes unused, and keeps its own accounts, settings and history apart from every other copy"

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="specimen">
      <Text size="caption" tone="muted">
        {name}
      </Text>
      <div className="specimen-states">{children}</div>
    </div>
  )
}

export function Specimens() {
  return (
    <div className="wrap">
      <PageHead kicker="Specimens" title={<>Every component, in every state.</>}>
        Each state is here so the checks measure it: resting, disabled, invalid, selected, loading and overlong. Nothing on this page is arranged to look good.
      </PageHead>
      <section className="section specimens">
        <Row name="Button">
          {(["ink", "secondary", "ghost", "accent", "critical"] as const).map((v) => (
            <Button key={v} variant={v}>
              {v === "ink" ? "Save changes" : v === "critical" ? "Delete copy" : "Duplicate"}
            </Button>
          ))}
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
          <Button variant="ghost" aria-label="Settings">
            <icons.WrenchIcon />
          </Button>
          <Button>{LONG}</Button>
        </Row>
        <Row name="State">
          {(["running", "done", "selected", "info", "draft", "warning", "critical"] as const).map((k) => (
            <State key={k} kind={k}>
              {k[0].toUpperCase() + k.slice(1)}
            </State>
          ))}
        </Row>
        <Row name="Field and input">
          <Field label="Name" description="Shown in the Dock and the menu bar.">
            <Input defaultValue="Claude Work" />
          </Field>
          <Field label="Name" error="A copy with this name already exists.">
            <Input defaultValue="Claude" />
          </Field>
          <Field label="Name">
            <Input placeholder="Claude Work" disabled />
          </Field>
          <Field label="Notes">
            <Textarea defaultValue={LONG} />
          </Field>
        </Row>
        <Row name="Choices">
          <Checkbox label="Open at login" defaultChecked />
          <Checkbox label="Quit when idle" />
          <Checkbox label="Share the keychain" disabled />
          <Switch label="Separate library" defaultChecked />
          <Switch label="Sync settings" disabled />
          <RadioGroup defaultValue="copy" aria-label="Library">
            <Radio value="copy" label="Its own library" />
            <Radio value="share" label="The original's library" />
          </RadioGroup>
        </Row>
        <Row name="Controls">
          <SegmentedControl aria-label="Sort by" defaultValue="name" options={[{ value: "name", label: "Name" }, { value: "date", label: "Date" }, { value: "size", label: "Size" }]} />
          <div style={{ width: 240 }}>
            <Slider defaultValue={40} aria-label="Volume" />
          </div>
          <Tabs.Root defaultValue="overview">
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="activity">Activity</Tabs.Tab>
              <Tabs.Tab value="settings">Settings</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        </Row>
        <Row name="Lists and facts">
          <List style={{ width: "min(100%, 420px)" }}>
            <ListRow title="Claude Work" detail="Running" trailing={<Keys keys={["⌘", "1"]} />} />
            <ListRow title="Claude Personal" detail="Opened two hours ago" selected />
            <ListRow title={LONG} detail={LONG} />
          </List>
          <Facts items={[["Size", <Value key="s">412 <small>MB</small></Value>], ["Opened", "Two hours ago"], ["Library", LONG]]} />
        </Row>
        <Row name="Surfaces">
          <Surface style={{ width: 200 }}>Flat</Surface>
          <Surface elevation="raised" style={{ width: 200 }}>
            Raised
          </Surface>
          <Surface elevation="overlay" style={{ width: 200 }}>
            Overlay
          </Surface>
        </Row>
        <Row name="Loading and people">
          <Skeleton width={180} />
          <Skeleton width={120} height={32} />
          <Avatar name="Mandip Adhikari" />
          <Avatar name="Ada" />
          <Count value={1284} />
        </Row>
      </section>
    </div>
  )
}
