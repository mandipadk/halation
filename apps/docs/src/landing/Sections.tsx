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
      </div>
    </footer>
  )
}
