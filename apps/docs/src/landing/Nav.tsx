import { sealSvg } from "@halation/core/signature"
import { useEffect, useRef } from "react"
import { Link } from "../router.tsx"
import { PAGES } from "../parts/Bar.tsx"

const HOME_LINKS = [
  { href: "/start", label: "Docs" },
  { href: "/components", label: "Components" },
  { href: "/phenomena", label: "Phenomena" },
]

/**
 * The site's one bar: a floating capsule of glass. On the home page it offers
 * the way in; in the docs the same capsule lists the docs, marking where you are.
 */
export function Nav({ path, docs }: { path: string; docs: boolean }) {
  const links = docs ? PAGES : HOME_LINKS
  const row = useRef<HTMLDivElement>(null)
  // On a narrow screen the docs scroll inside the capsule; keep the current one in view.
  useEffect(() => {
    const el = row.current
    const current = el?.querySelector<HTMLElement>('[aria-current="page"]')
    if (el && current) el.scrollLeft = current.offsetLeft - (el.clientWidth - current.offsetWidth) / 2
  }, [path])
  return (
    <header className="capsule-bar">
      <nav className="capsule" aria-label="Halation">
        <Link href="/" className="capsule-brand" aria-label="Halation, home">
          <span className="hl-seal" aria-hidden dangerouslySetInnerHTML={{ __html: sealSvg("Halation", 22) }} />
          <span>Halation</span>
        </Link>
        <div className="capsule-links" ref={row}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={docs && path.startsWith(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
          <a href="https://github.com/mandipadk/halation">GitHub</a>
        </div>
        {docs ? null : (
          <Link href="/start" className="capsule-cta">
            Get started
          </Link>
        )}
      </nav>
    </header>
  )
}
