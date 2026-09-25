import { mountPhenomenon } from "@halation/core/phenomena"
import { useEffect, useRef, type ComponentProps } from "react"
import { cx } from "./cx.ts"

export type PhenomenonName = "rays" | "blinds" | "caustics" | "halation" | "stir" | "ink" | "ripple" | "silk" | "foil" | "growth"

export type StageProps = {
  /** Which phenomenon lives behind the content. One per page (rule R15). */
  phenomenon: PhenomenonName
  /** Follow the visitor's time of day, or light it for a given moment. */
  daylight?: boolean | Date
  intensity?: number
  speed?: number
  /** Seconds before the motion eases to a stop; 0 keeps it moving. */
  settleAfter?: number
  mode?: "auto" | "light" | "dark"
  seed?: number
  /** A phenomenon's own options, such as where rays come from ({ position: 70 }) or a mark for foil to press. */
  options?: Record<string, unknown>
} & ComponentProps<"section">

/**
 * A stage: a phenomenon behind content. Mark the headline (or the block it
 * sits in) with data-quiet so the phenomenon dims behind it; for foil, mark
 * the heading to press with data-press.
 */
export function Stage({ phenomenon, daylight = false, intensity = 1, speed = 1, settleAfter = 0, mode = "auto", seed = 7, options, className, children, ...rest }: StageProps) {
  const host = useRef<HTMLDivElement>(null)
  const controller = useRef<ReturnType<typeof mountPhenomenon> | null>(null)
  useEffect(() => {
    if (!host.current) return
    const c = mountPhenomenon(host.current, phenomenon, { ...options, daylight, intensity, speed, settleAfter, mode, seed })
    controller.current = c
    return () => {
      c.destroy()
      controller.current = null
    }
  }, [phenomenon])
  const moment = daylight instanceof Date ? daylight.getTime() : daylight
  useEffect(() => {
    controller.current?.update({ ...options, daylight, intensity, speed, settleAfter, mode, seed })
  }, [moment, intensity, speed, settleAfter, mode, seed, options])
  return (
    <section className={cx("hl-stage", className)} data-phenomenon={phenomenon} {...rest}>
      <div className="hl-phenomenon" ref={host} aria-hidden />
      {children}
    </section>
  )
}
