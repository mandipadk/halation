import { HalationProvider, Seal, Text } from "@halation/react"
import { lazy, Suspense, useEffect, useState, type ComponentType } from "react"
import { Bar, PAGES, type Accent } from "./parts/Bar.tsx"
import { Link, usePath } from "./router.tsx"
import { Home } from "./pages/Home.tsx"

// Every page but the first loads when it's opened.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })))
const Start = page(() => import("./pages/Start.tsx"), "Start")
const Foundations = page(() => import("./pages/Foundations.tsx"), "Foundations")
const Components = page(() => import("./pages/Components.tsx"), "Components")
const Phenomena = page(() => import("./pages/Phenomena.tsx"), "Phenomena")
const Motion = page(() => import("./pages/Motion.tsx"), "Motion")
const Signature = page(() => import("./pages/Signature.tsx"), "Signature")
const Rules = page(() => import("./pages/Rules.tsx"), "Rules")
const NotFound = page(() => import("./pages/NotFound.tsx"), "NotFound")

const ROUTES: Record<string, ComponentType> = {
  "/": Home,
  "/start": Start,
  "/foundations": Foundations,
  "/components": Components,
  "/phenomena": Phenomena,
  "/motion": Motion,
  "/signature": Signature,
  "/rules": Rules,
}

const read = <T,>(key: string, fallback: T): T => {
  try {
    return (localStorage.getItem(key) as T) ?? fallback
  } catch {
    return fallback
  }
}

export function App() {
  const path = usePath()
  const [accent, setAccent] = useState<Accent>(() => read("hl-docs-accent", "vermilion"))
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => read("hl-docs-theme", "system"))
  useEffect(() => {
    try {
      localStorage.setItem("hl-docs-accent", accent)
      localStorage.setItem("hl-docs-theme", theme)
    } catch {}
  }, [accent, theme])
  const Page = ROUTES[path.replace(/\/$/, "") || "/"] ?? NotFound
  useEffect(() => {
    const page = PAGES.find((p) => p.href === path)
    document.title = page ? `${page.label} | Halation` : "Halation"
  }, [path])
  return (
    <HalationProvider name="Halation" accent={accent} theme={theme}>
      <Bar path={path} accent={accent} setAccent={setAccent} theme={theme} setTheme={setTheme} />
      <main>
        <Suspense fallback={<div style={{ minHeight: "70svh" }} />}>
          <Page />
        </Suspense>
      </main>
      <footer className="site-foot">
        <div className="wrap foot-row">
          <div className="foot-brand">
            <Seal name="Halation" size={32} title="Alt and Shift and click to enter the darkroom" />
            <div>
              <Text size="body-sm">Halation</Text>
              <Text size="caption" tone="muted">
                A design system that keeps your taste. Open source under the MIT license.
              </Text>
            </div>
          </div>
          <nav className="foot-nav" aria-label="More">
            {PAGES.map((p) => (
              <Link key={p.href} href={p.href}>
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </HalationProvider>
  )
}
