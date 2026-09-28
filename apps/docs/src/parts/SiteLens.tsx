import { Lens, useLensShortcut, type LensGroup } from "@halation/react"
import { useState } from "react"
import { navigate } from "../router.tsx"
import { useSite } from "../site.tsx"
import { ACCENTS, PAGES } from "./Bar.tsx"

/** ⌘K anywhere on the site: jump to a page, or change how the site looks. */
export function SiteLens() {
  const [open, setOpen] = useState(false)
  const { setTheme, setAccent } = useSite()
  useLensShortcut(() => setOpen(true))
  const groups: LensGroup[] = [
    { name: "Pages", items: [{ id: "home", title: "Home", detail: "Halation", onSelect: () => navigate("/") }, ...PAGES.map((p) => ({ id: p.href.slice(1), title: p.label, detail: "Docs", onSelect: () => navigate(p.href) }))] },
    {
      name: "Appearance",
      items: [
        { id: "light", title: "Light mode", onSelect: () => setTheme("light") },
        { id: "dark", title: "Dark mode", onSelect: () => setTheme("dark") },
        { id: "system", title: "Match the system", onSelect: () => setTheme("system") },
      ],
    },
    { name: "Accent", items: ACCENTS.map((a) => ({ id: a.value, title: `${a.label} accent`, onSelect: () => setAccent(a.value) })) },
  ]
  return <Lens open={open} onOpenChange={setOpen} groups={groups} placeholder="Go to a page, or change the look" />
}
