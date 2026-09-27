import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "system" | "light" | "dark"
export type Accent = "vermilion" | "cobalt" | "jade" | "amber"

type Site = { theme: Theme; setTheme: (t: Theme) => void; accent: Accent; setAccent: (a: Accent) => void; mode: "light" | "dark" }

export const SiteContext = createContext<Site>({ theme: "dark", setTheme: () => {}, accent: "vermilion", setAccent: () => {}, mode: "dark" })

/** The site's appearance: one theme and one accent, shared by every page and every control that changes them. */
export const useSite = () => useContext(SiteContext)

const read = <T extends string>(key: string, fallback: T): T => {
  try {
    return (localStorage.getItem(key) as T) ?? fallback
  } catch {
    return fallback
  }
}

export function useSiteState(): Site {
  const [theme, setTheme] = useState<Theme>(() => read("hl-docs-theme", "dark"))
  const [accent, setAccent] = useState<Accent>(() => read("hl-docs-accent", "vermilion"))
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches)
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)")
    const change = () => setSystemDark(query.matches)
    query.addEventListener("change", change)
    return () => query.removeEventListener("change", change)
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem("hl-docs-theme", theme)
      localStorage.setItem("hl-docs-accent", accent)
    } catch {}
  }, [theme, accent])
  const mode = theme === "system" ? (systemDark ? "dark" : "light") : theme
  return { theme, setTheme, accent, setAccent, mode }
}
