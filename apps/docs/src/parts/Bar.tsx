import { SegmentedControl } from "@halation/react"
import { Link } from "../router.tsx"
import { useSite, type Accent } from "../site.tsx"

export const PAGES = [
  { href: "/start", label: "Start" },
  { href: "/foundations", label: "Foundations" },
  { href: "/components", label: "Components" },
  { href: "/phenomena", label: "Phenomena" },
  { href: "/motion", label: "Motion" },
  { href: "/signature", label: "Signature" },
  { href: "/rules", label: "Rules" },
]

export const ACCENTS: { value: Accent; label: string; color: string }[] = [
  { value: "vermilion", label: "Vermilion", color: "#ff6b3d" },
  { value: "cobalt", label: "Cobalt", color: "#3f7cf0" },
  { value: "jade", label: "Jade", color: "#2fbf8f" },
  { value: "amber", label: "Amber", color: "#f0b429" },
]

/** The docs' own row, under the site's bar: the sections, and the appearance a reader can try on. */
export function DocsBar({ path }: { path: string }) {
  const { theme, setTheme, accent, setAccent } = useSite()
  return (
    <div className="docs-bar">
      <div className="wrap docs-bar-row">
        <nav className="nav" aria-label="Documentation">
          {PAGES.map((p) => (
            <Link key={p.href} href={p.href} aria-current={path.startsWith(p.href) ? "page" : undefined}>
              {p.label}
            </Link>
          ))}
        </nav>
        <div className="controls">
          <div className="swatches" role="radiogroup" aria-label="Accent">
            {ACCENTS.map((a) => (
              <button key={a.value} type="button" role="radio" aria-checked={accent === a.value} aria-label={a.label} title={a.label} className="swatch" style={{ ["--c" as string]: a.color }} onClick={() => setAccent(a.value)} />
            ))}
          </div>
          <SegmentedControl aria-label="Appearance" value={theme} onValueChange={setTheme} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        </div>
      </div>
    </div>
  )
}
