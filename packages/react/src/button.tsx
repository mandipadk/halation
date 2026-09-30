import { forwardRef, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { cx, flag } from "./cx.ts"

export type ButtonVariant = "ink" | "secondary" | "ghost" | "accent" | "critical"

export type ButtonProps = Omit<ComponentProps<"button">, "children"> & {
  /** Ink is the one main action in a view (rule R2). */
  variant?: ButtonVariant
  size?: "sm" | "md" | "lg"
  shape?: "default" | "pill"
  /** An icon-only button; give it an aria-label. */
  icon?: boolean
  /** Working: the label changes to `busyLabel` in place. */
  busy?: boolean
  busyLabel?: ReactNode
  /** Finished: the button blooms once and shows `doneLabel` with a check. */
  done?: boolean
  doneLabel?: ReactNode
  children?: ReactNode
}

/**
 * A button. Its label changes in place (blurring up and out, rising in)
 * and it blooms in the halation color when `done` turns true: the motion
 * system's "bloom" move.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", shape = "default", icon, busy, busyLabel, done, doneLabel, className, children, type = "button", ...rest },
  ref,
) {
  const [glow, setGlow] = useState(false)
  const was = useRef(done)
  useEffect(() => {
    if (done && !was.current) {
      setGlow(true)
      const t = setTimeout(() => setGlow(false), 320)
      was.current = done
      return () => clearTimeout(t)
    }
    was.current = done
  }, [done])
  const swaps = busyLabel !== undefined || doneLabel !== undefined
  const current = busy && busyLabel !== undefined ? "busy" : done && doneLabel !== undefined ? "done" : "rest"
  const order = { rest: 0, busy: 1, done: 2 } as const
  return (
    <button
      ref={ref}
      type={type}
      className={cx("hl-button", className)}
      data-variant={variant}
      data-size={size === "md" ? undefined : size}
      data-shape={shape === "pill" ? "pill" : undefined}
      data-icon={flag(icon)}
      data-busy={flag(busy)}
      data-done={flag(glow)}
      data-finished={flag(done)}
      aria-busy={busy || undefined}
      {...rest}
    >
      {swaps ? (
        <span className="hl-button-label" aria-live="polite">
          {/* Labels already passed leave upward; those still to come wait below. */}
          <span data-hidden={flag(order[current] !== 0)}>{children}</span>
          {busyLabel !== undefined && (
            <span data-hidden={flag(order[current] !== 1)} data-below={flag(order[current] < 1)} aria-hidden={current !== "busy"}>
              {busyLabel}
            </span>
          )}
          {doneLabel !== undefined && (
            <span data-hidden={flag(order[current] !== 2)} data-below={flag(order[current] < 2)} aria-hidden={current !== "done"} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg className="hl-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m3.5 8.4 2.9 2.9 6.1-6.6" />
              </svg>
              {doneLabel}
            </span>
          )}
        </span>
      ) : typeof children === "string" ? (
        <span className="hl-button-text">{children}</span>
      ) : (
        children
      )}
    </button>
  )
})
