import { useEffect, useState } from "react"
import { Install } from "./Install.tsx"
import { Link } from "../router.tsx"

/** The close: the one command, with the agent kit beside it. */
export function Start() {
  return (
    <section className="start">
      <div className="wrap-x start-body">
        <h2 className="start-title">Start a project.</h2>
        <div className="start-commands">
          <div>
            <p>A new project, with the agent kit set up</p>
            <Install />
          </div>
          <div>
            <p>Teach an existing one to Claude Code</p>
            <Install command="npx @halation/cli init" />
          </div>
        </div>
        <div className="start-links">
          <Link href="/start" className="text-link">
            Read the guide
          </Link>
          <a href="https://github.com/mandipadk/halation" className="text-link">
            Source on GitHub
          </a>
        </div>
      </div>
    </section>
  )
}

type Proof = { id: string; pass: boolean; checkedAt: string; measured: string[]; pages: unknown[] }

/** The site's own proof, written by the deploy: its seal, linking to the proof itself. */
function ProofSeal() {
  const [proof, setProof] = useState<Proof | null>(null)
  useEffect(() => {
    fetch("/proof.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setProof(p && typeof p.id === "string" ? p : null))
      .catch(() => {})
  }, [])
  if (!proof) return null
  const what = `${proof.measured.length} rules held on ${proof.pages.length} pages`
  return (
    <a className="home-foot-proof" href="/proof.json" title={`Proof ${proof.id.slice(0, 8)}: ${what}`}>
      <img src="/proof.svg" width={200} height={44} alt={`${proof.pass ? "Proven" : "Checked"} by Halation: ${what}`} />
    </a>
  )
}

export function Footer() {
  return (
    <footer className="home-foot">
      <div className="wrap-x home-foot-row">
        <p className="home-foot-name">Halation</p>
        <nav className="home-foot-nav" aria-label="Documentation">
          <Link href="/start">Start</Link>
          <Link href="/foundations">Foundations</Link>
          <Link href="/components">Components</Link>
          <Link href="/phenomena">Phenomena</Link>
          <Link href="/motion">Motion</Link>
          <Link href="/signature">Signature</Link>
          <Link href="/rules">Rules</Link>
        </nav>
        <p className="home-foot-note">Open source under the MIT license.</p>
        <ProofSeal />
      </div>
    </footer>
  )
}
