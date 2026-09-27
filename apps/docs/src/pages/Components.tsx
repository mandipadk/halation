import {
  Avatar,
  Button,
  Checkbox,
  Count,
  Dialog,
  Facts,
  Field,
  Input,
  Keys,
  List,
  ListRow,
  Menu,
  Popover,
  Radio,
  RadioGroup,
  SegmentedControl,
  Select,
  Serif,
  Sheet,
  Skeleton,
  Slider,
  State,
  Switch,
  Tabs,
  Text,
  Textarea,
  Tooltip,
  Value,
  useToast,
} from "@halation/react"
import { useState } from "react"
import { Demo, PageHead } from "../parts/Demo.tsx"

export function Components() {
  return (
    <div className="wrap">
      <PageHead kicker="Components" title={<>Every one, live.</>}>
        Built on Base UI, styled by Halation. Press, open, type and tab through them: every state, both modes, the keyboard.
      </PageHead>
      <div className="demos" style={{ paddingBottom: 96 }}>
        <Buttons />
        <States />
        <FactsDemo />
        <Fields />
        <Choices />
        <Controls />
        <MenuDemo />
        <Overlays />
        <Toasts />
        <Numbers />
        <Rows />
      </div>
    </div>
  )
}

function Buttons() {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  return (
    <Demo
      title="Button"
      about="Ink is the one main action in a view. The accent fill is for identity moments. When something finishes, the button blooms once and its label changes in place."
      code={`<Button variant="ink" busy={saving} busyLabel="Saving" done={saved} doneLabel="Saved">\n  Save changes\n</Button>\n<Button>Duplicate</Button>\n<Button variant="ghost">Cancel</Button>`}
    >
      <div className="row">
        <Button size="lg" shape="pill">
          Download for Mac
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
              setTimeout(() => setDone(false), 1800)
            }, 700)
          }}
        >
          Save changes
        </Button>
        <Button>Duplicate</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="accent">Show</Button>
        <Button variant="critical">Move to Trash</Button>
        <Button size="sm">Small</Button>
      </div>
    </Demo>
  )
}

function States() {
  return (
    <Demo title="State" about="A word and a glyph on the key material. Only the glyph carries color, never a dot." code={`<State kind="running">Running</State>\n<State kind="warning">Needs repair</State>`}>
      <div className="row">
        <State kind="selected">Selected</State>
        <State kind="running">Running</State>
        <State kind="done">Paid</State>
        <State kind="draft">Draft</State>
        <State kind="info">Beta</State>
        <State kind="warning">Needs repair</State>
        <State kind="critical">Quit at launch</State>
      </div>
    </Demo>
  )
}

function FactsDemo() {
  return (
    <Demo
      title="Facts, values and keys"
      about="Facts sit on their own lines instead of being joined with dots. Numbers line up with their unit set quieter. A key combination keeps a gap between keys."
      code={`<Facts items={[\n  ["Size", <Value unit="MB">412</Value>],\n  ["Switch to it", <Keys keys={["⌃", "⌥", "1"]} />],\n]} />`}
    >
      <Facts
        items={[
          ["Copy of", "Claude"],
          ["Size", <Value unit="MB">412</Value>],
          ["Last opened", "2 minutes ago"],
          ["Switch to it", <Keys keys={["⌃", "⌥", "1"]} />],
        ]}
      />
    </Demo>
  )
}

function Fields() {
  const [site, setSite] = useState("teams.microsoft")
  const invalid = !/\.[a-z]{2,}$/.test(site)
  return (
    <Demo title="Field, input and textarea" about="Labels above, help below. Errors say what's wrong and how to fix it." center={false} code={`<Field label="Website" error="Add the ending, like teams.microsoft.com.">\n  <Input value={site} onChange={...} />\n</Field>`}>
      <div className="grid-2">
        <Field label="Name" description="Shown in the Dock and the menu bar.">
          <Input defaultValue="Claude Work" />
        </Field>
        <Field label="Website" error={invalid ? "Add the ending, like teams.microsoft.com." : undefined}>
          <Input value={site} onChange={(e) => setSite(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea placeholder="Anything you want to remember about this copy" />
        </Field>
      </div>
    </Demo>
  )
}

function Choices() {
  const [on, setOn] = useState(true)
  return (
    <Demo title="Checkbox, radio and switch" about="The switch's thumb springs across; its bounce follows the project's tempo." center={false} code={`<Switch label="Open at login" checked={on} onCheckedChange={setOn} />\n<Checkbox label="Keep its own keychain" defaultChecked />`}>
      <div className="grid-2">
        <div className="stack">
          <Switch label="Open at login" checked={on} onCheckedChange={setOn} />
          <Switch label="Quit when unused" />
          <Checkbox label="Keep its own keychain" defaultChecked />
          <Checkbox label="Share the clipboard" />
        </div>
        <RadioGroup defaultValue="copy" aria-label="Kind of instance">
          <Radio value="copy" label="A copy with its own identity" />
          <Radio value="launcher" label="A lightweight launcher" />
          <Radio value="web" label="A website as an app" />
        </RadioGroup>
      </div>
    </Demo>
  )
}

function Controls() {
  const [size, setSize] = useState<"small" | "medium" | "large">("medium")
  return (
    <Demo title="Segmented control, select, slider and tabs" about="Tabs glide their indicator between tabs with the in-out curve, because it moves between two places." center={false} code={`<SegmentedControl value={size} onValueChange={setSize} options={[...]} />\n<Select options={[...]} placeholder="Sort by" />`}>
      <div className="stack" style={{ gap: 22 }}>
        <div className="row">
          <SegmentedControl aria-label="Text size" value={size} onValueChange={setSize} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }]} />
          <Select aria-label="Sort by" placeholder="Sort by" options={[{ value: "name", label: "Name" }, { value: "date", label: "Date modified" }, { value: "size", label: "Size" }]} />
        </div>
        <div style={{ maxWidth: 320 }}>
          <Slider defaultValue={40} aria-label="Strength" />
        </div>
        <Tabs.Root defaultValue="general">
          <Tabs.List>
            <Tabs.Tab value="general">General</Tabs.Tab>
            <Tabs.Tab value="links">Links</Tabs.Tab>
            <Tabs.Tab value="privacy">Privacy</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="general">
            <Text size="body-sm" tone="muted">
              Launch, appearance and updates.
            </Text>
          </Tabs.Panel>
          <Tabs.Panel value="links">
            <Text size="body-sm" tone="muted">
              Which copy opens which links.
            </Text>
          </Tabs.Panel>
          <Tabs.Panel value="privacy">
            <Text size="body-sm" tone="muted">
              What leaves this Mac, which is nothing unless you share it.
            </Text>
          </Tabs.Panel>
        </Tabs.Root>
      </div>
    </Demo>
  )
}

function MenuDemo() {
  return (
    <Demo title="Menu" about="Grows out of the button that opened it, and flips above it near the bottom of the screen." code={`<Menu.Root>\n  <Menu.Trigger render={<Button>More</Button>} />\n  <Menu.Popup>\n    <Menu.Item keys={["⌘", "D"]}>Duplicate</Menu.Item>\n    <Menu.Separator />\n    <Menu.Item tone="critical">Move to Trash</Menu.Item>\n  </Menu.Popup>\n</Menu.Root>`}>
      <Menu.Root>
        <Menu.Trigger render={<Button>More</Button>} />
        <Menu.Popup>
          <Menu.Item keys={["⌘", "D"]}>Duplicate</Menu.Item>
          <Menu.Item keys={["⌘", "E"]}>Export</Menu.Item>
          <Menu.Item>Report how it works</Menu.Item>
          <Menu.Separator />
          <Menu.Item tone="critical" keys={["⌘", "⌫"]}>
            Move to Trash
          </Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    </Demo>
  )
}

function Overlays() {
  return (
    <Demo title="Dialog, sheet, popover and tooltip" about="Opening the dialog softens the page behind it, the way a lens pulls focus. The sheet follows your finger; a flick is enough to send it away." code={`<Dialog.Root>\n  <Dialog.Trigger render={<Button>Delete 3…</Button>} />\n  <Dialog.Popup title="Delete 3 invoices?" description="They move to Recently Deleted for 30 days."\n    actions={<><Dialog.Close render={<Button variant="ghost">Cancel</Button>} /><Dialog.Close render={<Button variant="critical">Delete</Button>} /></>} />\n</Dialog.Root>`}>
      <div className="row">
        <Dialog.Root>
          <Dialog.Trigger render={<Button>Delete 3…</Button>} />
          <Dialog.Popup
            title="Delete 3 invoices?"
            description="They move to Recently Deleted and stay there for 30 days."
            actions={
              <>
                <Dialog.Close render={<Button variant="ghost">Cancel</Button>} />
                <Dialog.Close render={<Button variant="critical">Delete</Button>} />
              </>
            }
          />
        </Dialog.Root>
        <Sheet.Root>
          <Sheet.Trigger render={<Button>Show details</Button>} />
          <Sheet.Popup title="31 photos" description="Taken in March on two cameras. Pull this down, or flick it, to close.">
            <Facts style={{ marginTop: 16 }} items={[["Size", <Value unit="GB">1.2</Value>], ["Cameras", "Two"], ["Place", "Lisbon"]]} />
          </Sheet.Popup>
        </Sheet.Root>
        <Popover.Root>
          <Popover.Trigger render={<Button>What's a copy?</Button>} />
          <Popover.Popup title="A copy" description="Its own identity to macOS: its own accounts, keychain items and notifications." />
        </Popover.Root>
        <Tooltip content="Duplicate" keys={["⌘", "D"]}>
          <Button>Hover me</Button>
        </Tooltip>
      </div>
    </Demo>
  )
}

function Toasts() {
  const toast = useToast()
  const messages = [
    ["Copy created", "Claude Work is ready to open."],
    ["Update installed", "Parallex 1.0 is running."],
    ["Link routed", "The sign-in went to Claude Work."],
  ]
  const [n, setN] = useState(0)
  return (
    <Demo title="Toast" about="Toasts stack with depth and fan out when you point at them or tab into them." code={`const toast = useToast()\ntoast({ title: "Copy created", description: "Claude Work is ready to open.", type: "success" })`}>
      <Button
        onClick={() => {
          const [title, description] = messages[n % messages.length]
          toast({ title, description, type: "success" })
          setN(n + 1)
        }}
      >
        Send a notification
      </Button>
    </Demo>
  )
}

function Numbers() {
  const [value, setValue] = useState(12480)
  return (
    <Demo title="Count" about="A number you're watching rolls to its new value, digit by digit from the right." code={`<Count value={opened} />`}>
      <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
        <Text size="body-sm" tone="muted">
          Copies opened this month
        </Text>
        <Count value={value} className="hl-text-display" />
        <div className="row">
          <Button size="sm" onClick={() => setValue(Math.max(0, value - Math.round(80 + Math.random() * 900)))}>
            Fewer
          </Button>
          <Button size="sm" onClick={() => setValue(value + Math.round(80 + Math.random() * 900))}>
            More
          </Button>
        </div>
      </div>
    </Demo>
  )
}

function Rows() {
  return (
    <Demo title="List, avatar and skeleton" about="Rows are separated by hairlines, not boxes. Skeletons stay still: nothing moves while idle." center={false} code={`<List>\n  <ListRow leading={<Avatar name="Mandip Adhikari" />} title="Mandip Adhikari" detail="Owner" trailing={<State kind="done">Verified</State>} />\n</List>`}>
      <List>
        <ListRow leading={<Avatar name="Mandip Adhikari" />} title="Mandip Adhikari" detail="Owner" trailing={<State kind="done">Verified</State>} />
        <ListRow leading={<Avatar name="Ada Lovelace" />} title="Ada Lovelace" detail="Editor" trailing={<State kind="draft">Invited</State>} />
        <ListRow leading={<Skeleton width={32} height={32} style={{ borderRadius: "50%" }} />} title={<Skeleton width={140} />} detail={<Skeleton width={90} height={10} />} />
      </List>
    </Demo>
  )
}
