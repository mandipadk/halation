// `halation skill`: a SKILL.md for Claude Code, generated from the rulebook
// and the component catalog, so the guidance an agent reads is the same
// list the linter enforces.

import { readFileSync } from "node:fs"
import { loadRules, corePath } from "./rules.js"

const kit = (name) => JSON.parse(readFileSync(new URL(`../kit/${name}`, import.meta.url), "utf8"))

/** A concrete "don't" and "do" for each rule, keyed by id. Rules without one fall back to their text. */
export const EXAMPLES = {
  R1: { dont: "Accent-filled cards, headings, icons and buttons all over a page.", do: "Neutral surfaces; `text-accent` or `<Button variant=\"accent\">` only for identity, focus, selection or live state." },
  R2: { dont: "`<Button variant=\"accent\">Save</Button>` next to two other filled buttons.", do: "`<Button variant=\"ink\">Save</Button>`, one per view; the rest secondary or ghost." },
  R3: { dont: "`className=\"bg-gradient-to-r from-purple-500 to-pink-500\"`, or `background: linear-gradient(...)`.", do: "`<Stage phenomenon=\"rays\">` behind the page, or `<Surface elevation=\"raised\">`." },
  R4: { dont: "Gray text on a tinted panel, checked in light mode only.", do: "The text roles (`text-fg`, `text-fg-muted`, `text-fg-subtle`) on the surface roles." },
  R5: { dont: "`className=\"uppercase\"`, `text-transform: uppercase`, or typing a label in capitals.", do: "`<Text size=\"caption\" tone=\"muted\">Recent projects</Text>`" },
  R6: { dont: "`tracking-widest`, `tracking-[0.2em]`, `letter-spacing: 0.1em`.", do: "The text style alone; each one sets its own tracking." },
  R7: { dont: "`text-sm`, `text-2xl`, `text-[13px]`, `font-size: 17px`.", do: "`<Text size=\"body-sm\">`, `className=\"text-body-sm\"` (Tailwind) or `hl-text-body-sm`." },
  R8: { dont: "Two serif phrases in a headline, or a serif word in body text.", do: "`<Heading level={1}>Every app, <Serif>twice</Serif></Heading>`" },
  R9: { dont: "`<p>Copy of Claude · 412 MB</p>` or `{name} | {size}` in text. <!-- halation-ignore R9 -->", do: "`<Facts items={[[\"Name\", \"Copy of Claude\"], [\"Size\", \"412 MB\"]]} />`" },
  R10: { dont: "`<span className=\"size-2 rounded-full bg-green-500\" />` before a word, or a tinted pill with a dot.", do: "`<State kind=\"done\">Synced</State>`" },
  R11: { dont: "Monospace headings, labels or numbers loose on the page.", do: "Monospace inside `<Kbd>`, `<code>` or a surface; numbers in `<Value>`." },
  R12: { dont: "Proportional digits in a table column or a live counter.", do: "`<Value>` or `<Count>`, which set tabular figures." },
  R13: { dont: "Every section in a bordered, rounded box; a card inside a card.", do: "`<Divider />` or spacing; `<Surface>` only for a real object." },
  R14: { dont: "`duration-500` on a menu, a looping pulse, a shimmering skeleton.", do: "The moves and duration tokens below; `<Skeleton>` stays still." },
  R15: { dont: "Two `<Stage>`s on one page, or a phenomenon at full strength behind body text.", do: "One `<Stage>`, with `data-quiet` on the headline it sits behind." },
  R16: { dont: "`<kbd>⌘</kbd><kbd>K</kbd>` with no gap, or `⌘K` as one string.", do: "`<Keys keys={[\"⌘\", \"K\"]} />`" },
  R17: { dont: "`className=\"bg-[#7c3aed]\"`, `style={{ color: \"#333\" }}`.", do: "Color roles: `bg-surface`, `text-fg-muted`, `border-line`, `bg-accent`." },
  R18: { dont: "`font-family: Inter`, `font-['Roboto']`, a bare system stack.", do: "`var(--font-sans)`, `var(--font-serif)`, `var(--font-mono)` (`font-sans` in Tailwind)." },
  R19: { dont: "`@import \"tailwindcss\"` in your CSS, which brings back Tailwind's whole palette and type scale.", do: "`@import \"@halation/core/tailwind.css\"`, which loads Tailwind with only the system's values." },
  R20: { dont: "`if (navigator.webdriver)` or a user-agent test that shows a checker something different.", do: "One page for everyone. If a check fails, fix the page." },
  R21: { dont: "A bare `halation-ignore` comment, or one that names no rule.", do: "`/* halation-ignore R9: a real product name uses the dot */`: the rule id, and why." },
  R22: { dont: "`text-shadow: 0 0 24px var(--color-accent)` to make a headline glow.", do: "Light behind the text: a `<Stage>` phenomenon with the headline marked `data-quiet`." },
  R23: { dont: "A fixed-width row, table or code line that makes a phone scroll sideways.", do: "Let rows wrap, give tables and code their own scroll container, and check at 375 px." },
}

export const PRINCIPLES = [
  "Ink, not color. One accent, spent only where it means something; the main action is ink (R1, R2).",
  "Light, not paint. Depth comes from an atmosphere, lit edges and shadows, never decorative gradients (R3, R15).",
  "Structure, not strings. Facts get their own lines, states get a word and a shape (R9, R10).",
  "Few sizes, plain case. Eleven text styles, sentence case, no added tracking (R5, R6, R7).",
  "Lines before boxes. A hairline or space first; a box only for an object, never a box in a box (R13).",
  "Motion explains a change. Under 300 ms, exits faster than enters, nothing moving while idle (R14).",
  "Plain words. Sentence case, short labels; errors say what's wrong and how to fix it.",
]

export const TELLS = [
  "Purple or violet gradients, gradient text, glowing blobs behind cards (R3, R1).",
  "Inter, Roboto or a bare system stack as the typeface (R18).",
  "Uppercase, letter-spaced eyebrows above headlines (R5, R6).",
  "Facts joined in one string with a middle dot, bullet or bar (R9).",
  "Status dots, and tinted pills with a dot and same-hue text (R10).",
  "Card soup: every section in a bordered, rounded box, boxes inside boxes (R13).",
  "Emoji as icons. Use `icons` from @halation/react or a real icon set.",
  "Several filled, colored buttons competing for the main action (R1, R2).",
  "Monospace sprinkled on labels and numbers for a technical look (R11).",
  "Shimmering skeletons, pulsing badges, anything looping while idle (R14).",
  "Arbitrary sizes such as `text-[13px]` between the styles (R7).",
]

async function phenomena() {
  try {
    const { catalog } = await import("@halation/core/phenomena")
    if (Array.isArray(catalog) && catalog.length) return catalog
  } catch {}
  // Fall back to reading the catalog's source when it can't be imported in Node.
  const source = readFileSync(corePath("phenomena"), "utf8")
  return [...source.matchAll(/\{ name: "([^"]+)", group: "([^"]+)", gloss: "([^"]+)"/g)].map(([, name, group, gloss]) => ({ name, group, gloss }))
}

const cell = (s) => String(s).replace(/\|/g, "\\|")

/** The SKILL.md text. */
export async function renderSkill({ rules = loadRules() } = {}) {
  const { components, needs } = kit("components.json")
  const { textStyles, durations, eases, moves } = kit("foundations.json")
  const catalog = await phenomena()
  const caught = (r) => r.caught.map((c, i) => (i ? c.toLowerCase() : c)).join(", ")
  const out = []
  out.push(
    "---",
    "name: halation",
    "description: The Halation design system's rules and React components for this project. Use when building, styling, reviewing or writing copy for any UI here (components, pages, CSS, Tailwind classes, interface text), and before adding a color, font size, gradient, badge, status indicator, card, icon or animation.",
    "---",
    "",
    "# Halation",
    "",
    "This project's look is a set of rules, enforced in code. Build with the components, the eleven text styles and the color roles, and the result stays on brand without guessing. `halation lint` and a hook check source as you edit; `halation check` measures the rendered page.",
    "",
    "## Set up",
    "",
    "```tsx",
    'import "@halation/react/styles.css"',
    'import { HalationProvider } from "@halation/react"',
    "",
    "export function App({ children }) {",
    '  return <HalationProvider name="Your project">{children}</HalationProvider>',
    "}",
    "```",
    "",
    "- The name seeds the project's seal, grain, share card and greeting. Optional: `accent` (vermilion, cobalt, jade, amber), `tempo` (calm, crisp, lively), `theme` (system, light, dark).",
    "- With Tailwind v4, import `@halation/core/tailwind.css` instead of the styles: only the system's values exist, so `text-sm` or `bg-purple-500` don't generate. Use `text-body-sm`, `bg-surface`, `text-fg-muted`, `border-line`.",
    "- Before you finish: `npx halation lint` (exits 1 on an error) and, with the app running, `npx halation check http://localhost:3000`.",
    "- After a build: `npx halation gate dist` (or the build's folder) reads the CSS and HTML it emitted and exits 1 on anything off the system, such as a Tailwind arbitrary value.",
    "- A deliberate exception gets a comment saying `halation-ignore R9` (the rule id) on that line or the line above.",
    "- The `halation` MCP server (`npx halation mcp`, registered in `.mcp.json` by `halation init`) has tools to look up the rules, the scale and the components, lint a draft, declare a component metric and check a page.",
    "",
    "## Principles",
    "",
    ...PRINCIPLES.map((p) => `- ${p}`),
    "",
    "## Rules",
    "",
  )
  for (const r of rules) {
    const ex = EXAMPLES[r.id]
    out.push(`### ${r.id}: ${r.says}`, "")
    out.push(`- Don't: ${ex?.dont ?? r.says}`)
    out.push(`- Do: ${ex?.do ?? r.instead}`)
    out.push(`- Why: ${r.why}`)
    out.push(`- Instead: ${r.instead}`)
    out.push(`- Caught by: ${caught(r)}.`, "")
  }
  out.push("## What to use for what", "", "| Need | Use |", "| --- | --- |")
  for (const n of needs) out.push(`| ${cell(n.need)} | ${cell(n.use)} |`)
  out.push("", "## Components", "", "All from `@halation/react`.", "")
  for (const c of components) out.push(`- **${c.name}**: ${c.use} \`${c.example}\``)
  out.push("", "## The eleven text styles", "", "Use `<Text size>`, `<Heading size>`, `hl-text-<name>`, or `text-<name>` in Tailwind. No other sizes.", "", "| Style | Size | For |", "| --- | --- | --- |")
  for (const t of textStyles) out.push(`| ${t.name} | ${t.size} | ${t.usage} |`)
  out.push(
    "",
    "## Phenomena",
    "",
    "The atmosphere behind a hero: `<Stage phenomenon=\"...\">`. One per page, dimmed behind the element marked `data-quiet`. Foil presses the heading marked `data-press`. `daylight` follows the visitor's time of day; `settleAfter` (seconds) eases the motion to a stop. Each holds a still frame for reduced motion.",
    "",
    "| Name | Group | What it is |",
    "| --- | --- | --- |",
  )
  for (const p of catalog) out.push(`| ${p.name} | ${p.group} | ${p.gloss} |`)
  out.push(
    "",
    "## Motion",
    "",
    "- Interface motion stays under 300 ms. Exits take 70% of the enter. Nothing loops while idle; skeletons don't shimmer.",
    "- Ease out is the default. There's no ease-in: things leave the way they arrive, only faster.",
    "- Stagger 50 ms between items, and stagger at most 6.",
    "- Reduced motion turns moves into short fades (200 ms at most).",
    "- Tempo scales every duration: calm 1.25x, crisp 1x, lively 0.85x. Set it on the provider.",
    "- Scripted motion comes from `@halation/core/motion`: `play`, `spring` (carries velocity, retargets mid-flight), `rise`, `setTempo`.",
    "",
    "| Duration token | ms | For |",
    "| --- | --- | --- |",
  )
  for (const d of durations) out.push(`| --duration-${d.name} | ${d.ms} | ${d.usage} |`)
  out.push("", "| Easing token | For |", "| --- | --- |")
  for (const e of eases) out.push(`| --ease-${e.name} | ${e.usage} |`)
  out.push("", "The moves, built into the components:", "")
  for (const m of moves) out.push(`- ${m.name[0].toUpperCase()}${m.name.slice(1)}: ${m.what}`)
  out.push("", "## Tells of generated design", "", "Never ship these:", "")
  for (const t of TELLS) out.push(`- ${t}`)
  out.push("")
  return out.join("\n")
}
