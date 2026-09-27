import { sealSvg } from "@halation/core/signature"
import { Link } from "../router.tsx"

/** The marketing page's bar: one floating capsule of glass. */
export function Nav() {
  return (
    <header className="capsule-bar">
      <nav className="capsule" aria-label="Halation">
        <Link href="/" className="capsule-brand" aria-label="Halation, home">
          <span className="hl-seal" aria-hidden dangerouslySetInnerHTML={{ __html: sealSvg("Halation", 22) }} />
          <span>Halation</span>
        </Link>
        <div className="capsule-links">
          <Link href="/start">Docs</Link>
          <Link href="/components">Components</Link>
          <Link href="/phenomena">Phenomena</Link>
          <a href="https://github.com/mandipadk/halation">GitHub</a>
        </div>
        <Link href="/start" className="capsule-cta">
          Get started
        </Link>
      </nav>
    </header>
  )
}
