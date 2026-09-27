import { Heading, Text } from "@halation/react"
import { Code } from "../parts/Code.tsx"
import { PageHead } from "../parts/Demo.tsx"

export function Start() {
  return (
    <div className="wrap">
      <PageHead kicker="Start" title={<>Up and running in a minute.</>}>
        A new project comes set up: the system, a starting page, and an agent kit so Claude Code and other agents know the rules from the first edit.
      </PageHead>

      <section className="section">
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="section-head">
            <Heading level={3}>A new project</Heading>
            <Text tone="muted">A Vite and React app with Halation, a hero on a phenomenon, working examples, and the agent kit already in place.</Text>
          </div>
          <Code label="Terminal">{`npm create halation my-app\ncd my-app\nnpm install\nnpm run dev`}</Code>
        </div>
      </section>

      <section className="section">
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="section-head">
            <Heading level={3}>An existing React app</Heading>
            <Text tone="muted">Install the components and the CLI, import the styles once, and wrap the app. The provider sets the accent, tempo and theme, hosts toasts and tooltips, and puts on the project's signature.</Text>
          </div>
          <div className="stack">
            <Code label="Terminal">{`npm i @halation/react\nnpm i -D @halation/cli`}</Code>
            <Code label="main.tsx">{`import "@halation/react/styles.css"
import { HalationProvider } from "@halation/react"

createRoot(root).render(
  <HalationProvider name="My project" accent="vermilion" tempo="crisp">
    <App />
  </HalationProvider>,
)`}</Code>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="section-head">
            <Heading level={3}>With Tailwind</Heading>
            <Text tone="muted">Import Halation's Tailwind entry instead of Tailwind itself. Only the system's values exist: text-display, bg-surface, text-fg-muted, rounded-xl. Tailwind's own palette, type scale and letter-spacing are removed, so off-system classes simply don't generate.</Text>
          </div>
          <Code label="app.css">{`@import "@halation/core/tailwind.css";`}</Code>
        </div>
      </section>

      <section className="section">
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="section-head">
            <Heading level={3}>The agent kit</Heading>
            <Text tone="muted">One command sets up a project for Claude Code: the Halation skill, a hook that lints every file an agent edits and hands problems back in the same turn, and a short AGENTS.md other tools read too.</Text>
          </div>
          <div className="stack">
            <Code label="Terminal">{`npx halation init`}</Code>
            <Code label="Check a running page">{`npx halation lint src\nnpx halation check http://localhost:5173`}</Code>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="section-head">
            <Heading level={3}>Without a framework</Heading>
            <Text tone="muted">Everything visual works from plain CSS and JavaScript: the tokens and component styles, and every phenomenon.</Text>
          </div>
          <Code label="HTML and JavaScript">{`<link rel="stylesheet" href="@halation/core/styles.css" />

import { mountPhenomenon } from "@halation/core/phenomena"
mountPhenomenon(document.querySelector(".hero-light"), "caustics", { daylight: true })`}</Code>
        </div>
      </section>
    </div>
  )
}
