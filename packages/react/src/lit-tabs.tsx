import { Tabs as BaseTabs } from "@base-ui/react/tabs"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cx } from "./cx.ts"

export type LitTab = { value: string; label: ReactNode; content?: ReactNode }

/**
 * Lit tabs: the selection is a carriage of light, and the labels catch it.
 * Each one gains weight as the carriage passes beneath it; every label keeps
 * the width it has at full weight, so nothing shifts along the way.
 */
export function LitTabs({
  items,
  value,
  defaultValue,
  onValueChange,
  "aria-label": label,
  className,
}: {
  items: LitTab[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  "aria-label"?: string
  className?: string
}) {
  const [inner, setInner] = useState(defaultValue ?? items[0]?.value)
  const current = value ?? inner
  const list = useRef<HTMLDivElement>(null)
  const carriage = useRef<HTMLSpanElement>(null)
  const pos = useRef({ x: 0, w: 0, vx: 0, vw: 0, frame: 0 })

  const tabs = () => [...(list.current?.querySelectorAll<HTMLElement>(".hl-lit-tab") ?? [])]
  const paint = () => {
    const p = pos.current, c = carriage.current
    if (!c) return
    c.style.transform = `translateX(${p.x.toFixed(2)}px)`
    c.style.width = `${p.w.toFixed(2)}px`
    for (const t of tabs()) {
      const lit = t.offsetWidth ? Math.max(0, Math.min(t.offsetLeft + t.offsetWidth, p.x + p.w) - Math.max(t.offsetLeft, p.x)) / t.offsetWidth : 0
      t.style.fontWeight = String(Math.round(420 + lit * 220))
      t.style.color = `color-mix(in oklab, var(--color-fg) ${Math.round(lit * 100)}%, var(--color-fg-muted))`
    }
  }
  const target = () => tabs()[Math.max(0, items.findIndex((i) => i.value === current))]

  // Every label keeps its full-weight width.
  useLayoutEffect(() => {
    const fit = () => {
      for (const t of tabs()) {
        t.style.width = ""
        t.style.fontWeight = "640"
        t.style.width = `${Math.ceil(t.getBoundingClientRect().width)}px`
      }
      const t = target()
      if (t) Object.assign(pos.current, { x: t.offsetLeft, w: t.offsetWidth })
      paint()
    }
    fit()
    document.fonts?.ready.then(fit)
    addEventListener("resize", fit)
    return () => removeEventListener("resize", fit)
  }, [items.length])

  // A small spring, stepped per frame, so the light can be read at every point along the way.
  useEffect(() => {
    const t = target(), p = pos.current
    if (!t) return
    // On a narrow screen the row scrolls; keep the chosen tab in the middle of it.
    const l = list.current
    if (l && l.scrollWidth > l.clientWidth) l.scrollTo?.({ left: t.offsetLeft - (l.clientWidth - t.offsetWidth) / 2, behavior: "smooth" })
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      Object.assign(p, { x: t.offsetLeft, w: t.offsetWidth })
      paint()
      return
    }
    const step = () => {
      p.vx = (p.vx + (t.offsetLeft - p.x) * 0.075) * 0.72
      p.vw = (p.vw + (t.offsetWidth - p.w) * 0.075) * 0.72
      p.x += p.vx
      p.w += p.vw
      if (Math.abs(t.offsetLeft - p.x) + Math.abs(t.offsetWidth - p.w) + Math.abs(p.vx) + Math.abs(p.vw) > 0.05) p.frame = requestAnimationFrame(step)
      else Object.assign(p, { x: t.offsetLeft, w: t.offsetWidth, frame: 0 })
      paint()
    }
    cancelAnimationFrame(p.frame)
    p.frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(p.frame)
  }, [current])

  return (
    <BaseTabs.Root
      className="hl-lit-root"
      value={current}
      onValueChange={(v) => {
        setInner(v as string)
        onValueChange?.(v as string)
      }}
    >
      <BaseTabs.List ref={list} className={cx("hl-lit", className)} aria-label={label} activateOnFocus>
        <span className="hl-lit-carriage" ref={carriage} aria-hidden="true" />
        {items.map((i) => (
          <BaseTabs.Tab key={i.value} value={i.value} className="hl-lit-tab">
            {i.label}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
      {items.map((i) =>
        i.content === undefined ? null : (
          <BaseTabs.Panel key={i.value} value={i.value} className="hl-lit-panel">
            {i.content}
          </BaseTabs.Panel>
        ),
      )}
    </BaseTabs.Root>
  )
}
