import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cx } from "./cx.ts"
import { Keys } from "./keys.tsx"

export type LensItem = { id: string; title: string; detail?: string; icon?: ReactNode; keys?: string[]; onSelect?: () => void }
export type LensGroup = { name: string; items: LensItem[] }

/** Letters of the query in order; the matched ones are set heavier, not colored. */
function match(title: string, query: string): ReactNode[] | null {
  if (!query) return [title]
  const out: ReactNode[] = []
  let i = 0
  for (const [n, c] of [...title].entries()) {
    if (i < query.length && c.toLowerCase() === query[i]) {
      out.push(<b key={n}>{c}</b>)
      i++
    } else out.push(c)
  }
  return i === query.length ? out : null
}

/**
 * Lens: a command palette that pulls focus. The row you're on sits in a lit
 * carriage that springs from row to row; the rest fall gently out of focus the
 * further they are from it, and the page behind softens while it's open.
 */
export function Lens({
  open,
  onOpenChange,
  groups,
  placeholder = "Search",
  onSelect,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: LensGroup[]
  placeholder?: string
  /** Called with the chosen item, after its own onSelect. */
  onSelect?: (item: LensItem) => void
  className?: string
}) {
  const [query, setQuery] = useState("")
  const [sel, setSel] = useState(0)
  const [fired, setFired] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const carriage = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      setSel(0)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const shown = groups
    .map((g) => ({ name: g.name, hits: g.items.map((item) => ({ item, title: match(item.title, q) })).filter((h) => h.title !== null) }))
    .filter((g) => g.hits.length)
  const flat = shown.flatMap((g) => g.hits.map((h) => h.item))
  const current = Math.min(sel, Math.max(0, flat.length - 1))

  // The carriage follows the selection, and the list keeps it in view.
  useLayoutEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)
    const c = carriage.current
    if (!c) return
    c.style.opacity = row ? "1" : "0"
    if (!row || !list.current) return
    c.style.transform = `translateY(${row.offsetTop}px)`
    c.style.height = `${row.offsetHeight}px`
    const l = list.current
    const top = row.offsetTop - 8, bottom = row.offsetTop + row.offsetHeight + 8
    if (top < l.scrollTop) l.scrollTo?.({ top, behavior: "smooth" })
    else if (bottom > l.scrollTop + l.clientHeight) l.scrollTo?.({ top: bottom - l.clientHeight, behavior: "smooth" })
  })

  const fire = (index: number) => {
    const item = flat[index]
    if (!item) return
    setFired(true)
    setTimeout(() => {
      setFired(false)
      item.onSelect?.()
      onSelect?.(item)
      onOpenChange(false)
    }, 150)
  }

  let index = -1
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BaseDialog.Portal>
        <BaseDialog.Popup className={cx("hl-lens", className)} initialFocus={input} aria-label="Lens">
          <div className="hl-lens-field">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="m12.2 12.2 3.3 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={input}
              value={query}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded="true"
              aria-controls="hl-lens-list"
              aria-activedescendant={flat[current] ? `hl-lens-${flat[current].id}` : undefined}
              onChange={(e) => {
                setQuery(e.target.value)
                setSel(0)
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setSel(Math.min(flat.length - 1, current + 1))
                } else if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setSel(Math.max(0, current - 1))
                } else if (e.key === "Enter") {
                  e.preventDefault()
                  fire(current)
                }
              }}
            />
            <Keys keys={["esc"]} />
          </div>
          <div className="hl-lens-list" role="listbox" id="hl-lens-list" aria-label="Results" ref={list}>
            {flat.length === 0 ? <p className="hl-lens-empty">Nothing matches “{query}”.</p> : null}
            {shown.map((g) => (
              <div key={g.name} role="group" aria-label={g.name}>
                <p className="hl-lens-group" aria-hidden="true">
                  {g.name}
                </p>
                {g.hits.map(({ item, title }) => {
                  index++
                  const i = index
                  const d = Math.abs(i - current)
                  return (
                    <div
                      key={item.id}
                      id={`hl-lens-${item.id}`}
                      role="option"
                      aria-selected={i === current}
                      data-index={i}
                      className="hl-lens-row"
                      style={{ filter: d > 1 ? `blur(${Math.min(1.6, (d - 1) * 0.5).toFixed(2)}px)` : undefined, opacity: 1 - Math.min(0.55, d * 0.11) }}
                      onPointerMove={() => i !== current && setSel(i)}
                      onClick={() => fire(i)}
                    >
                      {item.icon ?? <span />}
                      <span className="hl-lens-title">{title}</span>
                      <span className="hl-lens-detail">{item.detail}</span>
                      {item.keys ? <Keys keys={item.keys} /> : <span />}
                    </div>
                  )
                })}
              </div>
            ))}
            <div className="hl-lens-carriage" ref={carriage} data-fired={fired ? "" : undefined} aria-hidden="true" />
          </div>
          <div className="hl-lens-foot" aria-hidden="true">
            <span>
              <Keys keys={["↑", "↓"]} /> Move
            </span>
            <span>
              <Keys keys={["↵"]} /> Open
            </span>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

/** Opens Lens on ⌘K (Ctrl+K elsewhere). */
export function useLensShortcut(open: () => void, key = "k") {
  const run = useRef(open)
  run.current = open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) {
        e.preventDefault()
        run.current()
      }
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  }, [key])
}
