import { Heading, Serif, Surface, Text } from "@halation/react"
import swatches from "@halation/core/swatches.json"
import { PageHead } from "../parts/Demo.tsx"

const GROUPS: [string, string[]][] = [
  ["Surfaces", ["canvas", "surface", "raised", "fill", "fill-hover", "fill-active"]],
  ["Text", ["fg", "fg-muted", "fg-subtle"]],
  ["Ink and lines", ["ink", "ink-hover", "on-ink", "line", "line-strong", "scrim"]],
  ["Accent", ["accent", "accent-hover", "on-accent", "accent-soft", "accent-soft-hover", "accent-fg", "ring"]],
  ["States", ["positive", "positive-soft", "positive-fg", "warning", "warning-soft", "warning-fg", "critical", "critical-soft", "critical-fg"]],
  ["Light", ["light-core", "light-edge", "halation"]],
]

const TYPE: [string, string, string][] = [
  ["display-xl", "Every app. ", "Twice."],
  ["display", "Built to keep things ", "apart."],
  ["title-1", "Instance settings", ""],
  ["title-2", "Launch and appearance", ""],
  ["title-3", "Separate library", ""],
  ["body-lg", "Run separate copies of any Mac app, each with its own accounts.", ""],
  ["body", "A copy with its own identity, so macOS treats it as a different app.", ""],
  ["body-sm", "Opens at login and quits after 30 minutes unused", ""],
  ["caption", "Last opened 2 minutes ago", ""],
  ["micro", "New", ""],
]

const MOTION: [string, string, string][] = [
  ["Press", "120 ms", "Scale to 97% while held"],
  ["Hover", "150 ms", "Color only, only with a pointer"],
  ["Popover", "180 ms", "Menus and tooltips unfold from their control"],
  ["Dialog", "240 ms", "The page softens as the dialog focuses"],
  ["Sheet", "500 ms", "Follows the finger, leaves with its speed"],
  ["Reveal", "600 ms", "The blur rise, once, in reading order"],
]

type Role = { name: string; usage: string }
const roles = (swatches as { id: string; roles: Role[] }[])[0].roles

export function Foundations() {
  return (
    <div className="wrap">
      <PageHead kicker="Foundations" title={<>One accent in, <Serif>everything</Serif> out.</>}>
        Every color is computed from one accent and proven for contrast in both modes before it ships. Change the accent and the appearance at the top: everything here follows.
      </PageHead>

      <section className="section">
        <div className="section-head">
          <Heading level={2} size="title-1">
            Color roles
          </Heading>
          <Text tone="muted">Components use roles, never raw colors. The primary action is ink; the accent is a signal for identity, focus, selection and live state.</Text>
        </div>
        <div className="stack" style={{ gap: 32 }}>
          {GROUPS.map(([title, names]) => (
            <div key={title} className="stack">
              <Text size="body-sm" style={{ fontWeight: 600 }}>
                {title}
              </Text>
              <div className="roles">
                {names.map((name) => (
                  <div className="role" key={name}>
                    <span className="role-chip" style={{ background: `var(--color-${name})` }} />
                    <code>{name}</code>
                    <Text size="caption" tone="muted">
                      {roles.find((r) => r.name === name)?.usage}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <Heading level={2} size="title-1">
            Ten text styles
          </Heading>
          <Text tone="muted">Geist for everything, Instrument Serif for one italic phrase at display sizes, Geist Mono for code on its own surface. Tracking tightens as type grows.</Text>
        </div>
        {TYPE.map(([name, text, serif]) => (
          <div className="type-row" key={name}>
            <p className={`hl-text-${name}`}>
              {text}
              {serif ? <Serif>{serif}</Serif> : null}
            </p>
            <Text size="caption" tone="muted">
              {name}
            </Text>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section-head">
          <Heading level={2} size="title-1">
            Shape and depth
          </Heading>
          <Text tone="muted">Corners nest: an inner corner is the outer one minus the padding. Depth is a lit top edge, a contact shadow and an ambient one.</Text>
        </div>
        <div className="grid-2">
          <Surface>
            <Text size="body-sm" style={{ fontWeight: 600 }}>
              Flat
            </Text>
            <Text size="caption" tone="muted">
              A hairline, for content on the page.
            </Text>
          </Surface>
          <Surface elevation="raised">
            <Text size="body-sm" style={{ fontWeight: 600 }}>
              Raised
            </Text>
            <Text size="caption" tone="muted">
              Cards that sit above the page.
            </Text>
          </Surface>
          <Surface elevation="overlay">
            <Text size="body-sm" style={{ fontWeight: 600 }}>
              Overlay
            </Text>
            <Text size="caption" tone="muted">
              Menus, popovers and dialogs.
            </Text>
          </Surface>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <Heading level={2} size="title-1">
            Motion by job
          </Heading>
          <Text tone="muted">No interface transition runs past 300 ms, exits take 70% of the enter, and nothing loops while idle. The tempo (calm, crisp, lively) scales them all.</Text>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Duration</th>
                <th>What moves</th>
              </tr>
            </thead>
            <tbody>
              {MOTION.map(([job, d, what]) => (
                <tr key={job}>
                  <td>{job}</td>
                  <td>{d}</td>
                  <td>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
