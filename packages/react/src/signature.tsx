import { armDarkroom, colophon, develop, drawShareCard, enterDarkroom, inDarkroom, leaveDarkroom, paintGrain, playChime, score, sealSvg } from "@halation/core/signature"
import { useEffect, useRef, useSyncExternalStore, type ComponentProps, type RefObject } from "react"
import { cx } from "./cx.ts"

export type Character = { light: string; lens: string; tempo: string; form: string; stock: string; accent: string; type?: string }

/**
 * A project's seal, generated from its name. Alt and Shift and a click opens
 * the darkroom; with `chime`, a click plays the seal's own score.
 */
export function Seal({ name, size = 28, chime, tempo = "crisp", onClick, className, ...rest }: { name: string; size?: number; chime?: boolean; tempo?: "calm" | "crisp" | "lively" } & Omit<ComponentProps<"button">, "name" | "children" | "dangerouslySetInnerHTML">) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (ref.current) armDarkroom(ref.current)
  }, [])
  return (
    <button
      ref={ref}
      type="button"
      className={cx("hl-seal", className)}
      aria-label={`${name}, seal`}
      onClick={(e) => {
        if (!(e.altKey && e.shiftKey) && chime) playChime(score(name, tempo))
        onClick?.(e)
      }}
      {...rest}
      dangerouslySetInnerHTML={{ __html: sealSvg(name, size) }}
    />
  )
}

/** The credits every project carries: what it's made of, generated. */
export function Colophon({ name, character, rules = 18, className }: { name: string; character: Character; rules?: number; className?: string }) {
  return (
    <div className={cx("hl-colophon", className)}>
      {colophon(name, character, { rules }).map(([role, who]: [string, string]) => (
        <div key={role}>
          <div className="hl-colophon-role">{role}</div>
          <div className="hl-colophon-who">{who}</div>
        </div>
      ))}
      <span className="hl-seal" dangerouslySetInnerHTML={{ __html: sealSvg(name, 48) }} />
    </div>
  )
}

/** Film grain seeded by the project's name, as a still texture. */
export function Grain({ name, opacity = 0.11, className }: { name: string; opacity?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) paintGrain(ref.current, name)
  }, [name])
  return <canvas ref={ref} width={220} height={220} className={cx("hl-grain", className)} style={{ opacity, width: "100%", height: "100%", imageRendering: "auto" }} aria-hidden />
}

/** Develops an element like a print, once per visitor. */
export function useDevelop(ref: RefObject<HTMLElement | null>, { enabled = true, always = false } = {}) {
  useEffect(() => {
    if (enabled && ref.current) develop(ref.current, { always })
  }, [enabled])
}

/** The share card, drawn from the name, a line and the accent. */
export function ShareCard({ name, line, accent, className }: { name: string; line?: string; accent?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawShareCard(ref.current, { name, line, accent })
  }, [name, line, accent])
  return <canvas ref={ref} className={className} style={{ width: "100%", height: "auto", display: "block" }} aria-label={`Share card for ${name}`} />
}

export const darkroom = { enter: enterDarkroom, leave: leaveDarkroom, isOpen: inDarkroom }

const followDarkroom = (change: () => void) => {
  document.addEventListener("halation:darkroom", change)
  return () => document.removeEventListener("halation:darkroom", change)
}

/** Whether the darkroom is open, kept current as it opens and closes. */
export function useDarkroom() {
  return useSyncExternalStore(followDarkroom, inDarkroom, () => false)
}
