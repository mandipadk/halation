import { greet, mountLitEdge } from "@halation/core/signature"
import { useEffect, type ReactNode } from "react"
import { ToastProvider } from "./toast.tsx"
import { TooltipProvider } from "./overlays.tsx"
import type { Character } from "./signature.tsx"

export type HalationProviderProps = {
  /** The project's name: its seal, grain, share card and greeting come from it. */
  name: string
  character?: Character
  accent?: "vermilion" | "cobalt" | "jade" | "amber"
  tempo?: "calm" | "crisp" | "lively"
  theme?: "system" | "light" | "dark"
  /**
   * Signature pieces. The lit edge, console greeting and darkroom are on by
   * default for every project; the opening and chime are choices.
   */
  signature?: { litEdge?: boolean; greeting?: boolean; daylight?: boolean }
  children: ReactNode
}

const DEFAULT_CHARACTER: Character = { light: "Rays", lens: "Editorial", tempo: "Crisp", form: "Soft", stock: "Ink", accent: "Vermilion" }

/**
 * Wraps an app in Halation: sets the accent, tempo and theme on the page,
 * hosts tooltips and toasts, marks the root the focus pull softens, and
 * puts on the project's signature.
 */
export function HalationProvider({ name, character = DEFAULT_CHARACTER, accent, tempo = "crisp", theme = "system", signature = {}, children }: HalationProviderProps) {
  const { litEdge = true, greeting = true, daylight = true } = signature
  useEffect(() => {
    const root = document.documentElement
    if (accent) root.dataset.accent = accent
    else delete root.dataset.accent
    if (tempo === "crisp") delete root.dataset.tempo
    else root.dataset.tempo = tempo
    if (theme === "system") delete root.dataset.theme
    else root.dataset.theme = theme
  }, [accent, tempo, theme])
  useEffect(() => {
    if (!litEdge) return
    const edge = mountLitEdge({ daylight })
    return () => edge.destroy()
  }, [litEdge, daylight])
  useEffect(() => {
    if (greeting) greet(name, character)
  }, [name, greeting, JSON.stringify(character)])
  return (
    <TooltipProvider>
      <ToastProvider>
        <div data-hl-root="">{children}</div>
      </ToastProvider>
    </TooltipProvider>
  )
}
