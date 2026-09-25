import { SegmentedControl } from "@halation/react"
import { sealSvg } from "@halation/core/signature"
import { Link } from "../router.tsx"

export const PAGES = [
  { href: "/start", label: "Start" },
  { href: "/foundations", label: "Foundations" },
  { href: "/components", label: "Components" },
  { href: "/phenomena", label: "Phenomena" },
  { href: "/motion", label: "Motion" },
  { href: "/signature", label: "Signature" },
  { href: "/rules", label: "Rules" },
]

export type Accent = "vermilion" | "cobalt" | "jade" | "amber"
export const ACCENTS: { value: Accent; label: string; color: string }[] = [
  { value: "vermilion", label: "Vermilion", color: "#ff6b3d" },
  { value: "cobalt", label: "Cobalt", color: "#3f7cf0" },
  { value: "jade", label: "Jade", color: "#2fbf8f" },
  { value: "amber", label: "Amber", color: "#f0b429" },
]

export function Bar({ path, accent, setAccent, theme, setTheme }: { path: string; accent: Accent; setAccent: (a: Accent) => void; theme: "system" | "light" | "dark"; setTheme: (t: "system" | "light" | "dark") => void }) {
  return (
    <header className="bar">
      <div className="wrap bar-row">
        <Link href="/" className="brand" aria-label="Halation, home">
          <span className="hl-seal" aria-hidden dangerouslySetInnerHTML={{ __html: sealSvg("Halation", 24) }} />
          <span>Halation</span>
        </Link>
        <nav className="nav" aria-label="Sections">
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
    </header>
  )
}
