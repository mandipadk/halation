---
name: halation
description: The Halation design system's rules and React components for this project. Use when building, styling, reviewing or writing copy for any UI here (components, pages, CSS, Tailwind classes, interface text), and before adding a color, font size, gradient, badge, status indicator, card, icon or animation.
---

# Halation

This project's look is a set of rules, enforced in code. Build with the components, the eleven text styles and the color roles, and the result stays on brand without guessing. `halation lint` and a hook check source as you edit; `halation check` measures the rendered page.

## Set up

```tsx
import "@halation/react/styles.css"
import { HalationProvider } from "@halation/react"

export function App({ children }) {
  return <HalationProvider name="Your project">{children}</HalationProvider>
}
```

- The name seeds the project's seal, grain, share card and greeting. Optional: `accent` (vermilion, cobalt, jade, amber), `tempo` (calm, crisp, lively), `theme` (system, light, dark).
- With Tailwind v4, import `@halation/core/tailwind.css` instead of the styles: only the system's values exist, so `text-sm` or `bg-purple-500` don't generate. Use `text-body-sm`, `bg-surface`, `text-fg-muted`, `border-line`.
- Before you finish: `npx halation lint` (exits 1 on an error) and, with the app running, `npx halation check http://localhost:3000`.
- After a build: `npx halation gate dist` (or the build's folder) reads the CSS and HTML it emitted and exits 1 on anything off the system, such as a Tailwind arbitrary value.
- A deliberate exception gets a comment saying `halation-ignore R9` (the rule id) on that line or the line above.
- The `halation` MCP server (`npx halation mcp`, registered in `.mcp.json` by `halation init`) has tools to look up the rules, the scale and the components, lint a draft, declare a component metric and check a page.

## Principles

- Ink, not color. One accent, spent only where it means something; the main action is ink (R1, R2).
- Light, not paint. Depth comes from an atmosphere, lit edges and shadows, never decorative gradients (R3, R15).
- Structure, not strings. Facts get their own lines, states get a word and a shape (R9, R10).
- Few sizes, plain case. Eleven text styles, sentence case, no added tracking (R5, R6, R7).
- Lines before boxes. A hairline or space first; a box only for an object, never a box in a box (R13).
- Motion explains a change. Under 300 ms, exits faster than enters, nothing moving while idle (R14).
- Plain words. Sentence case, short labels; errors say what's wrong and how to fix it.

## Rules

### R1: One accent, used as a signal: identity, focus, selection, live state.

- Don't: Accent-filled cards, headings, icons and buttons all over a page.
- Do: Neutral surfaces; `text-accent` or `<Button variant="accent">` only for identity, focus, selection or live state.
- Why: Color that means something is only noticed when it's rare.
- Instead: Neutral surfaces and ink; the accent only where it carries meaning.
- Caught by: Theme, page check.

### R2: The one main action is ink: white on dark, black on light.

- Don't: `<Button variant="accent">Save</Button>` next to two other filled buttons.
- Do: `<Button variant="ink">Save</Button>`, one per view; the rest secondary or ghost.
- Why: Keeps the accent free to mean something, and the main action obvious in both modes.
- Instead: An ink button; accent fills only for identity moments.
- Caught by: Page check.

### R3: No gradients as decoration. Depth comes from light: atmospheres, lit edges, shadows.

- Don't: `className="bg-gradient-to-r from-purple-500 to-pink-500"`, or `background: linear-gradient(...)`.
- Do: `<Stage phenomenon="rays">` behind the page, or `<Surface elevation="raised">`.
- Why: Decorative gradients are the most common sign of generated design.
- Instead: An atmosphere behind the page, or a raised surface.
- Caught by: Theme, lint, build gate.

### R4: Every text and background pair passes WCAG 2 in both modes.

- Don't: Gray text on a tinted panel, checked in light mode only.
- Do: The text roles (`text-fg`, `text-fg-muted`, `text-fg-subtle`) on the surface roles.
- Why: Legibility isn't a style choice.
- Instead: Use the text roles; the forge solves their contrast.
- Caught by: Forge, page check.

### R5: Sentence case everywhere. No uppercase labels.

- Don't: `className="uppercase"`, `text-transform: uppercase`, or typing a label in capitals.
- Do: `<Text size="caption" tone="muted">Recent projects</Text>`
- Why: Capitals shout, and spaced-out capitals are a generated-design cliché.
- Instead: A smaller or lighter text style.
- Caught by: Lint, build gate, page check.

### R6: No letter-spacing beyond what the text styles set.

- Don't: `tracking-widest`, `tracking-[0.2em]`, `letter-spacing: 0.1em`.
- Do: The text style alone; each one sets its own tracking.
- Why: Tracking is tuned per size already; extra spacing is how eyebrows get made.
- Instead: The text style for that size.
- Caught by: Theme, lint, build gate.

### R7: Eleven named text styles; no other sizes.

- Don't: `text-sm`, `text-2xl`, `text-[13px]`, `font-size: 17px`.
- Do: `<Text size="body-sm">`, `className="text-body-sm"` (Tailwind) or `hl-text-body-sm`.
- Why: A small scale is what makes pages feel composed.
- Instead: The nearest style.
- Caught by: Theme, lint, build gate, page check.

### R8: At most one serif phrase in a headline, and only at title sizes and up.

- Don't: Two serif phrases in a headline, or a serif word in body text.
- Do: `<Heading level={1}>Every app, <Serif>twice</Serif></Heading>`
- Why: It's an accent in the voice; twice is a costume.
- Instead: Plain type for everything else.
- Caught by: Page check.

### R9: Facts are never joined with dots or bars.

- Don't: `<p>Copy of Claude · 412 MB</p>` or `{name} | {size}` in text. <!-- halation-ignore R9 -->
- Do: `<Facts items={[["Name", "Copy of Claude"], ["Size", "412 MB"]]} />`
- Why: A joined string has to be parsed; structure can be scanned.
- Instead: The Facts component, or separate lines with their own weight.
- Caught by: Lint, page check.

### R10: No status dots, and no tinted pills with a dot and same-hue text.

- Don't: `<span className="size-2 rounded-full bg-green-500" />` before a word, or a tinted pill with a dot.
- Do: `<State kind="done">Synced</State>`
- Why: It reads as generated, and color alone doesn't say what the state is.
- Instead: A word and a shape; only the shape carries color.
- Caught by: Lint, page check.

### R11: Monospace only inside a surface: keys, code wells, token names on cards.

- Don't: Monospace headings, labels or numbers loose on the page.
- Do: Monospace inside `<Kbd>`, `<code>` or a surface; numbers in `<Value>`.
- Why: Loose monospace on the page reads as a terminal, and as generated.
- Instead: Geist, with tabular figures for numbers.
- Caught by: Page check.

### R12: Numbers that sit in columns or change use tabular figures.

- Don't: Proportional digits in a table column or a live counter.
- Do: `<Value>` or `<Count>`, which set tabular figures.
- Why: They line up and don't jitter as they change.
- Instead: The value style, which sets tabular figures.
- Caught by: Theme, page check.

### R13: Hairlines separate; a box only when something must read as an object. Never a box inside a box.

- Don't: Every section in a bordered, rounded box; a card inside a card.
- Do: `<Divider />` or spacing; `<Surface>` only for a real object.
- Why: Card soup flattens hierarchy.
- Instead: A divider or spacing.
- Caught by: Page check, critic.

### R14: Interface motion stays under 300 ms, exits take 70% of the enter, nothing loops while idle.

- Don't: `duration-500` on a menu, a looping pulse, a shimmering skeleton.
- Do: The moves and duration tokens below; `<Skeleton>` stays still.
- Why: Motion should explain a change, never make anyone wait.
- Instead: The moves and their durations.
- Caught by: Theme, page check.

### R15: One atmosphere per page, and it dims behind content.

- Don't: Two `<Stage>`s on one page, or a phenomenon at full strength behind body text.
- Do: One `<Stage>`, with `data-quiet` on the headline it sits behind.
- Why: An atmosphere is a place, not a decoration.
- Instead: The page's one light, with its quiet zone.
- Caught by: Page check.

### R17: Colors come from tokens, never from literal values in markup.

- Don't: `className="bg-[#7c3aed]"`, `style={{ color: "#333" }}`.
- Do: Color roles: `bg-surface`, `text-fg-muted`, `border-line`, `bg-accent`.
- Why: A literal color is a color the system can't check, theme or keep in contrast.
- Instead: A color role: bg-surface, text-fg-muted, border-line and so on.
- Caught by: Theme, lint, build gate, page check.

### R18: Type comes from the project's lens: its display, text and code faces.

- Don't: `font-family: Inter`, `font-['Roboto']`, a bare system stack.
- Do: `var(--font-sans)`, `var(--font-serif)`, `var(--font-mono)` (`font-sans` in Tailwind).
- Why: Inter, Roboto and system stacks are the default look of generated design.
- Instead: The --font-sans, --font-serif and --font-mono tokens.
- Caught by: Theme, lint, build gate.

### R16: Keys in a combination keep a visible gap.

- Don't: `<kbd>⌘</kbd><kbd>K</kbd>` with no gap, or `⌘K` as one string.
- Do: `<Keys keys={["⌘", "K"]} />`
- Why: Each key should read as its own key.
- Instead: The Keys component.
- Caught by: Lint.

### R19: Tailwind comes through Halation's theme.

- Don't: `@import "tailwindcss"` in your CSS, which brings back Tailwind's whole palette and type scale.
- Do: `@import "@halation/core/tailwind.css"`, which loads Tailwind with only the system's values.
- Why: Tailwind's own entry brings back its whole palette, type scale and radii, so off-system classes quietly work again.
- Instead: @import "@halation/core/tailwind.css", which loads Tailwind with only the system's values.
- Caught by: Lint.

### R20: Pages look the same to the checker as to people.

- Don't: `if (navigator.webdriver)` or a user-agent test that shows a checker something different.
- Do: One page for everyone. If a check fails, fix the page.
- Why: A page that spots the checker and shows it something else hides every problem the check would find.
- Instead: One page for everyone; fix what the check reports.
- Caught by: Lint.

### R21: An exception names the rule it breaks.

- Don't: A bare `halation-ignore` comment, or one that names no rule.
- Do: `/* halation-ignore R9: a real product name uses the dot */`: the rule id, and why.
- Why: A blanket exception silences every rule on its line, including the ones nobody meant to allow.
- Instead: An exception needs the rule id it's for, like halation-ignore R9, and a reason.
- Caught by: Lint.

### R22: No glow on text.

- Don't: `text-shadow: 0 0 24px var(--color-accent)` to make a headline glow.
- Do: Light behind the text: a `<Stage>` phenomenon with the headline marked `data-quiet`.
- Why: Glowing text is a generated-design cliché, and it hurts legibility.
- Instead: Plain text. Light belongs to surfaces and phenomena. The one bloom text may take is the halation phenomenon's, in dark mode, once per page.
- Caught by: Lint, build gate, page check.

### R23: Pages fit a phone: nothing scrolls sideways.

- Don't: A fixed-width row, table or code line that makes a phone scroll sideways.
- Do: Let rows wrap, give tables and code their own scroll container, and check at 375 px.
- Why: Most visitors arrive on a phone, and a page that scrolls sideways there feels broken.
- Instead: Widths that give way: rows that wrap, fluid text styles, a max-width instead of a width.
- Caught by: Page check.

### R24: Spacing sits on the grid: 2 px steps up to 24, then 4 px steps, or a named space.

- Don't: Spacing sits on the grid: 2 px steps up to 24, then 4 px steps, or a named space.
- Do: The spacing scale (p-3, gap-1.5), a named space like --space-section, or a component metric with its reason.
- Why: Consistent steps are what make a layout feel built rather than nudged.
- Instead: The spacing scale (p-3, gap-1.5), a named space like --space-section, or a component metric with its reason.
- Caught by: Build gate, page check.

### R25: Corners come from the radius scale, a full pill, or nest inside their parent's.

- Don't: Corners come from the radius scale, a full pill, or nest inside their parent's.
- Do: The radius scale (rounded-lg), rounded-full, or the parent's radius minus its padding.
- Why: A few radii, used everywhere, are what make shapes feel related.
- Instead: The radius scale (rounded-lg), rounded-full, or the parent's radius minus its padding.
- Caught by: Build gate, page check.

### R26: A component metric states its reason.

- Don't: A component metric states its reason.
- Do: Declare it in the component's stylesheet as --m-name, with a comment on the same line saying why: --m-cap-x: 9px; /* a one-letter cap stays square at 38 px */. Not in a style attribute or script.
- Why: A value off the scale is fine when a component needs it, and the reason is what lets the next person keep it or retire it.
- Instead: Declare it in the component's stylesheet as --m-name, with a comment on the same line saying why: --m-cap-x: 9px; /* a one-letter cap stays square at 38 px */. Not in a style attribute or script.
- Caught by: Lint.

### R27: Halation's lock layer comes before any other layer.

- Don't: Halation's lock layer comes before any other layer.
- Do: Import Halation's styles (or its Tailwind entry) before any stylesheet that declares its own layers.
- Why: The lock holds a few rules in the browser itself, and it only outranks everything when it's declared first.
- Instead: Import Halation's styles (or its Tailwind entry) before any stylesheet that declares its own layers.
- Caught by: Build gate.

## What to use for what

| Need | Use |
| --- | --- |
| Show a state (running, done, failed) | `<State kind="running">Syncing</State>` |
| Metadata about a thing | `<Facts items={[["Size", "412 MB"]]} />` |
| A keyboard shortcut | `<Keys keys={["⌘", "K"]} />` |
| Hero with atmosphere | `<Stage phenomenon="rays">`, with `data-quiet` on the headline |
| The main action | `<Button variant="ink">`, once per view |
| Any other action | `<Button>` or `<Button variant="ghost">` |
| Destructive action | `<Button variant="critical">`, confirmed in a `Dialog` |
| Headline with an accent phrase | `<Heading level={1}>Every app, <Serif>twice</Serif></Heading>` |
| Running text or a label | `<Text size="body-sm" tone="muted">` |
| A number in a column, or with a unit | `<Value unit="MB">412</Value>` |
| A number that changes | `<Count value={n} />` |
| Separate two groups | `<Divider />` or spacing |
| Something that must read as an object | `<Surface elevation="raised">` |
| Rows of items | `<List>` of `<ListRow title detail trailing />` |
| A form control with a label and error | `<Field label error><Input /></Field>` |
| On or off, applied at once | `<Switch label="..." />` |
| One of a few views | `<SegmentedControl>` or `<Tabs>` |
| One of many options | `<Select options={...} />` |
| Extra actions behind a button | `<Menu>` |
| A label on hover | `<Tooltip content="..." keys={...}>` |
| A decision before going on | `<Dialog>` |
| A pull-away panel | `<Sheet>` |
| Confirm something finished | `useToast()` |
| Loading placeholder | `<Skeleton />`, still, no shimmer |
| Entrance on scroll | `<Rise>` |
| A person | `<Avatar name="..." src={...} />` |
| An icon | `<icons.CheckIcon />` and the rest, never emoji |
| The project's mark, credits, share image | `<Seal>`, `<Colophon>`, `<ShareCard>` |
| Search and jump anywhere (⌘K) | `<Lens>` with `useLensShortcut` |
| Let people set a keyboard shortcut | `<ShortcutRecorder>` |
| Pick a time of day | `<Sundial>` |
| Tune a value by feel | `<Dial>` |
| Let people pick an accent | `<AccentForge>` |
| Upload photos or files | `<LightTable>` |

## Components

All from `@halation/react`.

- **HalationProvider**: Wrap the app once. Sets accent, tempo and theme, hosts tooltips and toasts, and puts on the project's signature. `<HalationProvider name="Lumen" accent="vermilion">{children}</HalationProvider>`
- **Text**: Any running text, in one of the eleven styles (size) with an optional tone: muted, subtle, accent or critical. `<Text size="body-sm" tone="muted">Synced a minute ago</Text>`
- **Heading**: Headlines. level sets the element and its default style (1 is display-xl, 3 is title-1); size overrides the style. `<Heading level={3}>Storage</Heading>`
- **Serif**: The one italic serif phrase inside a headline, at title sizes and up (R8). `<Heading level={1}>Every app, <Serif>twice</Serif></Heading>`
- **Value**: A number with tabular figures and a quieter unit. `<Value unit="MB">412</Value>`
- **Button**: Actions. One ink button per view for the main action; secondary (the default) or ghost for the rest; critical for destructive ones. busy/busyLabel and done/doneLabel change the label in place. `<Button variant="ink" busy={saving} busyLabel="Saving" done={saved} doneLabel="Saved">Save changes</Button>`
- **Kbd**: A single key. `<Kbd>Esc</Kbd>`
- **Keys**: A keyboard shortcut; each key on its own cap with a gap (R16). `<Keys keys={["⌘", "K"]} />`
- **State**: A status as a word and a glyph, never a colored dot (R10). Kinds: running, done, selected, info, draft, warning, critical. `<State kind="running">Syncing</State>`
- **Facts**: Metadata about a thing: labels and values on their own lines, instead of facts joined with dots (R9). `<Facts items={[["Size", "412 MB"], ["Updated", "Today"]]} />`
- **Fact**: One label and value inside Facts, when the value is richer than a string. `<Facts><Fact label="Size"><Value unit="MB">412</Value></Fact></Facts>`
- **Surface**: A box, only when something must read as an object (R13). elevation: flat, raised or overlay. Never put one inside another. `<Surface elevation="raised"><Text>Drop files here</Text></Surface>`
- **Divider**: A hairline between groups; the first choice before a box. `<Divider />`
- **List**: A list of rows separated by hairlines. `<List><ListRow title="Claude" detail="412 MB" /></List>`
- **ListRow**: A row: something leading, a title with an optional detail, and something trailing. selected marks it chosen. `<ListRow leading={<Avatar name="Ada Lovelace" />} title="Ada Lovelace" detail="Owner" trailing={<Button variant="ghost" size="sm">Remove</Button>} />`
- **Field**: A labelled control with an optional description and an error that says what's wrong and how to fix it. `<Field label="Project name" description="Shown on the seal." error={error}><Input name="name" /></Field>`
- **Input**: A single-line text input, usually inside Field. `<Input name="email" type="email" />`
- **Textarea**: Multi-line text, inside Field. `<Field label="Notes"><Textarea rows={4} /></Field>`
- **Checkbox**: An independent yes or no that takes effect when the form is saved. `<Checkbox label="Email me when it's done" defaultChecked />`
- **Radio**: One option in a RadioGroup. `<Radio value="weekly" label="Weekly" />`
- **RadioGroup**: One choice out of a few, with each option visible. `<RadioGroup defaultValue="weekly"><Radio value="daily" label="Daily" /><Radio value="weekly" label="Weekly" /></RadioGroup>`
- **Switch**: An on or off setting that takes effect at once. `<Switch label="Sync automatically" defaultChecked />`
- **Slider**: A value picked from a range. `<Slider defaultValue={40} min={0} max={100} />`
- **SegmentedControl**: One of two to five views or modes, side by side. `<SegmentedControl aria-label="View" defaultValue="list" options={[{ value: "list", label: "List" }, { value: "grid", label: "Grid" }]} />`
- **Tabs**: Switching between panels of one page; the indicator glides between tabs. `<Tabs.Root defaultValue="files"><Tabs.List><Tabs.Tab value="files">Files</Tabs.Tab><Tabs.Tab value="activity">Activity</Tabs.Tab></Tabs.List><Tabs.Panel value="files">{files}</Tabs.Panel><Tabs.Panel value="activity">{activity}</Tabs.Panel></Tabs.Root>`
- **Menu**: Actions tucked behind a button. Items take an icon, keys for their shortcut, and tone="critical". `<Menu.Root><Menu.Trigger render={<Button>Options</Button>} /><Menu.Popup><Menu.Item keys={["⌘", "D"]}>Duplicate</Menu.Item><Menu.Separator /><Menu.Item tone="critical">Delete</Menu.Item></Menu.Popup></Menu.Root>`
- **Popover**: More detail or a small form anchored to a control. `<Popover.Root><Popover.Trigger render={<Button>Details</Button>} /><Popover.Popup title="Storage" description="What this project keeps on disk.">{details}</Popover.Popup></Popover.Root>`
- **Tooltip**: A short label for a control on hover or focus, with an optional shortcut. `<Tooltip content="Duplicate" keys={["⌘", "D"]}><Button>Duplicate</Button></Tooltip>`
- **TooltipProvider**: Shares tooltip timing. HalationProvider already includes it; use it only for tooltips rendered outside the provider. `<TooltipProvider>{children}</TooltipProvider>`
- **Select**: One choice out of many, in a list. `<Select aria-label="Accent" defaultValue="vermilion" options={[{ value: "vermilion", label: "Vermilion" }, { value: "cobalt", label: "Cobalt" }]} />`
- **Dialog**: A decision that has to be made before going on. The page behind softens. `<Dialog.Root><Dialog.Trigger render={<Button variant="critical">Delete project</Button>} /><Dialog.Popup title="Delete this project?" description="Its files stay on disk." actions={<><Dialog.Close render={<Button>Cancel</Button>} /><Button variant="critical">Delete</Button></>} /></Dialog.Root>`
- **Sheet**: A panel you can pull away, from the bottom or the right, for filters, details or mobile menus. `<Sheet.Root side="right"><Sheet.Trigger render={<Button>Filters</Button>} /><Sheet.Popup title="Filters" side="right">{filters}</Sheet.Popup></Sheet.Root>`
- **ToastProvider**: Hosts toasts. HalationProvider already includes it. `<ToastProvider>{children}</ToastProvider>`
- **useToast**: Confirms something finished, or reports a failure, without interrupting. `const toast = useToast(); toast({ title: "Saved", type: "success" })`
- **Avatar**: A person, as a photo or their initials. `<Avatar name="Ada Lovelace" src={photo} />`
- **Skeleton**: A still placeholder while content loads. It never shimmers. `<Skeleton width={160} />`
- **Count**: A number that changes; its digits roll to the new value. `<Count value={downloads} />`
- **Rise**: Content that arrives in reading order out of a soft blur, once, when first seen. `<Rise as="section"><Heading>What it does</Heading><Text>{summary}</Text></Rise>`
- **Stage**: A hero with atmosphere: one phenomenon behind content, one per page (R15). Mark the headline data-quiet so it dims behind it. `<Stage phenomenon="caustics" settleAfter={12}><Heading level={1} data-quiet>Light on water</Heading></Stage>`
- **Seal**: The project's mark, generated from its name. Alt, Shift and a click opens the darkroom. `<Seal name="Lumen" chime />`
- **Colophon**: The credits in a footer: what the project is made of. `<Colophon name="Lumen" character={character} />`
- **Grain**: Still film grain seeded by the name, laid over a stage or image. `<Grain name="Lumen" />`
- **ShareCard**: The social share image, drawn from the name, a line and the accent. `<ShareCard name="Lumen" line="Every app, twice" />`
- **useDevelop**: Develops an element like a print, once per visitor. For a landing hero. `const hero = useRef(null); useDevelop(hero)`
- **darkroom**: Opens or closes the darkroom inspector from code. `darkroom.enter()`
- **useDarkroom**: Whether the darkroom is open, for a button that enters and leaves it. `const open = useDarkroom()`
- **Lens**: A command palette that pulls focus: a lit carriage on the chosen row, the rest softening with distance. For any app with more than a handful of places to go. `<Lens open={open} onOpenChange={setOpen} groups={[{ name: "Copies", items: [{ id: "work", title: "Claude Work", onSelect: openWork }] }]} />`
- **useLensShortcut**: Opens Lens on ⌘K (Ctrl+K elsewhere). `useLensShortcut(() => setOpen(true))`
- **ShortcutRecorder**: Records a key combination with keycaps that go down while held. Refuses taken shortcuts and keys with no modifier, in words. Label it with what the shortcut does. `<ShortcutRecorder value={keys} onValueChange={setKeys} label="Switches to Claude Work" onMessage={setNote} />`
- **TAKEN_SHORTCUTS**: The shortcuts macOS keeps for itself, with the reason for each. Spread it into your own list of taken shortcuts. `taken={{ ...TAKEN_SHORTCUTS, "⌘N": "⌘N makes a new copy." }}`
- **Sundial**: A time-of-day picker set by moving the sun, showing the real sky for that minute. For schedules and quiet hours; value is minutes after midnight. `<Sundial value={minutes} onValueChange={setMinutes} label="Quiet hours begin at" />`
- **LitTabs**: Tabs whose selection is a carriage of light; labels gain weight as it passes. Use for a page's main sections. `<LitTabs aria-label="Sections" items={[{ value: "all", label: "Overview", content: <Overview /> }]} />`
- **Dial**: A rotary knob with detents that click, lit ticks and a rolling number. For intensity, volume, zoom: a value tuned by feel. `<Dial value={level} onValueChange={setLevel} label="Intensity" />`
- **AccentForge**: An accent picker that derives every accent role from a hue and shows each pair's contrast in both modes. Purple hues are closed. `<AccentForge hue={hue} onHueChange={setHue} />`
- **LightTable**: A file drop zone that backlights under the dragged file; dropped photos land as prints that develop. For uploads, avatars and imports. `<LightTable onFiles={upload} />`
- **icons**: The system's glyphs: CheckIcon, PlayIcon, WrenchIcon, StopIcon, PencilIcon, InfoIcon, AlertIcon, ChevronIcon, CloseIcon. Use these or a real icon set, never emoji. `<icons.CheckIcon />`

## The eleven text styles

Use `<Text size>`, `<Heading size>`, `hl-text-<name>`, or `text-<name>` in Tailwind. No other sizes.

| Style | Size | For |
| --- | --- | --- |
| display-xl | 52 to 116 px, fluid | The one hero line on a page. |
| display | 36 to 60 px, fluid | Section headlines on marketing pages. |
| title-1 | 28 to 36 px, fluid | Page titles in products; dialog heroes. |
| title-2 | 24 px | Section titles inside a page. |
| title-3 | 20 px | Card and group titles. |
| body-lg | 18 px | Lead paragraphs under a headline. |
| body | 16 px | Reading text. |
| control | 15 px | Labels on tabs, keycaps and segmented controls. |
| body-sm | 14 px | Interface text: controls, lists, tables. |
| caption | 13 px | Metadata, helper text, footnotes. |
| micro | 12 px | Badges, keyboard keys, counters. Never sentences. |

## Phenomena

The atmosphere behind a hero: `<Stage phenomenon="...">`. One per page, dimmed behind the element marked `data-quiet`. Foil presses the heading marked `data-press`. `daylight` follows the visitor's time of day; `settleAfter` (seconds) eases the motion to a stop. Each holds a still frame for reduced motion.

| Name | Group | What it is |
| --- | --- | --- |
| rays | Light | Crepuscular rays from above the frame |
| blinds | Light | Late sun through a window with blinds |
| caustics | Light | Light on a pool floor |
| halation | Light | The glow film gives bright things |
| stir | Air | A shaft of light, and the air in it |
| ink | Air | A fluid you stir |
| ripple | Water | Still water over a tiled floor |
| silk | Matter | A satin drape |
| foil | Matter | Letterpress and foil |
| growth | Life | Reaction-diffusion |

## Motion

- Interface motion stays under 300 ms. Exits take 70% of the enter. Nothing loops while idle; skeletons don't shimmer.
- Ease out is the default. There's no ease-in: things leave the way they arrive, only faster.
- Stagger 50 ms between items, and stagger at most 6.
- Reduced motion turns moves into short fades (200 ms at most).
- Tempo scales every duration: calm 1.25x, crisp 1x, lively 0.85x. Set it on the provider.
- Scripted motion comes from `@halation/core/motion`: `play`, `spring` (carries velocity, retargets mid-flight), `rise`, `setTempo`.

| Duration token | ms | For |
| --- | --- | --- |
| --duration-press | 120 | Press feedback (scale to 0.97). |
| --duration-hover | 150 | Hover color and fill changes. |
| --duration-popover | 180 | Tooltips, menus, popovers; exits of anything. |
| --duration-dialog | 240 | Dialogs, toasts, panels. |
| --duration-sheet | 500 | Sheets and drawers that follow a drag (with ease-drawer). |
| --duration-reveal | 600 | The one-time blur rise on page entrance and scroll. |

| Easing token | For |
| --- | --- |
| --ease-out | Anything entering, leaving or responding. The default. |
| --ease-in-out | Something moving or morphing between two places on screen. |
| --ease-drawer | Sheets and drawers that follow a drag. |
| --ease-spring | Things that snap into place: toggles, drag release. Never menus or text. |

The moves, built into the components:

- Press: A pressed control scales to 0.97.
- Unfold: Menus and popovers grow out of the control that opened them.
- Focus pull: The page behind a dialog softens while the dialog comes into focus.
- Glide: The tab indicator moves between tabs on the in-out curve.
- Settle: A switch thumb springs across.
- Bloom: A button blooms once in the halation color when its work is done.
- Stack: Toasts stack with depth and fan out when pointed at.
- Rise: Content arrives in reading order out of a soft blur, once.

## Tells of generated design

Never ship these:

- Purple or violet gradients, gradient text, glowing blobs behind cards (R3, R1).
- Inter, Roboto or a bare system stack as the typeface (R18).
- Uppercase, letter-spaced eyebrows above headlines (R5, R6).
- Facts joined in one string with a middle dot, bullet or bar (R9).
- Status dots, and tinted pills with a dot and same-hue text (R10).
- Card soup: every section in a bordered, rounded box, boxes inside boxes (R13).
- Emoji as icons. Use `icons` from @halation/react or a real icon set.
- Several filled, colored buttons competing for the main action (R1, R2).
- Monospace sprinkled on labels and numbers for a technical look (R11).
- Shimmering skeletons, pulsing badges, anything looping while idle (R14).
- Arbitrary sizes such as `text-[13px]` between the styles (R7).
