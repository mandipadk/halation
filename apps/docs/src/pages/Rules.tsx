import { Heading, Text } from "@halation/react"
import rules from "@halation/core/rules.json"
import { Code } from "../parts/Code.tsx"
import { PageHead } from "../parts/Demo.tsx"

type Rule = { id: string; says: string; why: string; instead: string; caught: string[] }

export function Rules() {
  return (
    <div className="wrap">
      <PageHead kicker="Rules" title={<>Taste, written down as rules.</>}>
        Each rule has a reason, a way to catch it and what to do instead. The same list becomes the agent's skill, the lint rules, the page check and this page, so guidance and enforcement never drift apart.
      </PageHead>
      <section className="section">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rule</th>
                <th>What it says, and why</th>
                <th>Instead</th>
                <th>Caught by</th>
              </tr>
            </thead>
            <tbody>
              {(rules as Rule[]).map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    {r.says}
                    <Text size="caption" tone="muted">
                      {r.why}
                    </Text>
                  </td>
                  <td>
                    <Text size="body-sm" tone="muted">
                      {r.instead}
                    </Text>
                  </td>
                  <td><Text size="caption" tone="muted">{r.caught.join(", ")}</Text></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section" style={{ paddingBottom: 96 }}>
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="section-head">
            <Heading level={2} size="title-1">
              Catch them yourself
            </Heading>
            <Text tone="muted">Lint reads the source; the check reads the page as the browser drew it. Agents get both after every edit through the hook that halation init sets up.</Text>
          </div>
          <Code label="Terminal">{`npx halation lint src\nnpx halation check http://localhost:5173\nnpx halation rules`}</Code>
        </div>
      </section>
    </div>
  )
}
