import type { ComponentProps, ReactNode } from "react"
import { cx } from "./cx.ts"
import { CheckIcon, InfoIcon, PencilIcon, PlayIcon, StopIcon, WrenchIcon } from "./icons.tsx"

export type StateKind = "running" | "done" | "selected" | "info" | "draft" | "warning" | "critical"

const GLYPH: Record<StateKind, ReactNode> = {
  running: <PlayIcon />,
  done: <CheckIcon />,
  selected: <CheckIcon />,
  info: <InfoIcon />,
  draft: <PencilIcon />,
  warning: <WrenchIcon />,
  critical: <StopIcon />,
}

/**
 * A state: a word and a glyph on the key material. Only the glyph is
 * colored (rule R10: no status dots, no tinted dot chips).
 */
export function State({ kind = "info", icon, className, children, ...rest }: { kind?: StateKind; icon?: ReactNode } & ComponentProps<"span">) {
  return (
    <span className={cx("hl-state", className)} data-kind={kind} {...rest}>
      {icon ?? GLYPH[kind]}
      {children}
    </span>
  )
}
