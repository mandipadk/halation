import { HalationProvider } from "@halation/react"
import { lazy, Suspense, useEffect, type ComponentType } from "react"
import { Appearance, PAGES } from "./parts/Bar.tsx"
import { SiteLens } from "./parts/SiteLens.tsx"
import { usePath } from "./router.tsx"
import { SiteContext, useSiteState } from "./site.tsx"
import { Home } from "./landing/Home.tsx"
import { Nav } from "./landing/Nav.tsx"
import { Footer } from "./landing/Sections.tsx"

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

export function App() {
  const path = usePath()
  const site = useSiteState()
  const route = path.replace(/\/$/, "") || "/"
  const Page = ROUTES[route] ?? NotFound
  const docs = route !== "/" && route in ROUTES
  useEffect(() => {
    const page = PAGES.find((p) => p.href === path)
    document.title = page ? `${page.label} | Halation` : "Halation"
  }, [path])
  return (
    <SiteContext.Provider value={site}>
      <HalationProvider name="Halation" accent={site.accent} theme={site.theme}>
        <Nav path={path} docs={docs} />
        <main id="main" tabIndex={-1} data-docs={docs ? "" : undefined}>
          <Suspense fallback={<div style={{ minHeight: "70svh" }} />}>
            <Page />
          </Suspense>
        </main>
        {docs ? <Appearance /> : null}
        <Footer />
        <SiteLens />
      </HalationProvider>
    </SiteContext.Provider>
  )
}
