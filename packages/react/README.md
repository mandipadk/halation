# @halation/react

Halation's components, stages and signature for React 19, built on Base UI.

```tsx
import "@halation/react/styles.css"
import { HalationProvider, Stage, Heading, Serif, Button, State, Facts, Value, Keys } from "@halation/react"

<HalationProvider name="My project" accent="vermilion" tempo="crisp">
  <Stage phenomenon="rays" daylight>
    <div data-quiet>
      <Heading level={1}>Every app. <Serif>Twice.</Serif></Heading>
      <Button variant="ink" shape="pill" size="lg">Download</Button>
    </div>
  </Stage>
  <State kind="running">Running</State>
  <Facts items={[["Size", <Value unit="MB">412</Value>], ["Switch", <Keys keys={["⌃", "⌥", "1"]} />]]} />
</HalationProvider>
```

Components: Text, Heading, Serif, Value, Button, Kbd, Keys, State, Facts, Surface, Divider, List, ListRow, Field, Input, Textarea, Checkbox, Radio, RadioGroup, Switch, Slider, SegmentedControl, Tabs, Menu, Popover, Tooltip, Select, Dialog, Sheet, useToast, Avatar, Skeleton, Count, Rise, Stage, Seal, Colophon, Grain, ShareCard.

Instruments and lit controls:

- `Lens`: a command palette that pulls focus, with `useLensShortcut` for ⌘K.
- `ShortcutRecorder`: keycaps that go down while held; taken shortcuts are refused in words.
- `Sundial`: a time-of-day picker that shows the real sky for the chosen minute.
- `LitTabs`: tabs whose labels gain weight as the carriage of light passes beneath them.
- `Dial`: a rotary knob with detents, lit ticks and rolling numerals.
- `AccentForge`: an accent picker that derives every role and measures its contrast in both modes.
- `LightTable`: a file drop zone that backlights under the file; photos land as prints that develop.

MIT
