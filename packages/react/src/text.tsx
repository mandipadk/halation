import type { ComponentProps, ElementType, ReactNode } from "react"
import { cx } from "./cx.ts"

export type TextStyle = "display-xl" | "display" | "title-1" | "title-2" | "title-3" | "body-lg" | "body" | "control" | "body-sm" | "caption" | "micro"
export type Tone = "default" | "muted" | "subtle" | "accent" | "critical"

type TextProps<T extends ElementType> = { as?: T; size?: TextStyle; tone?: Tone; className?: string; children?: ReactNode } & Omit<ComponentProps<T>, "as" | "size">

/** Running text in one of the eleven styles. */
export function Text<T extends ElementType = "p">({ as, size = "body", tone = "default", className, ...rest }: TextProps<T>) {
  const Tag = (as ?? "p") as ElementType
  return <Tag className={cx(`hl-text-${size}`, tone !== "default" && `hl-tone-${tone}`, className)} {...rest} />
}

const LEVEL_SIZE: Record<number, TextStyle> = { 1: "display-xl", 2: "display", 3: "title-1", 4: "title-2", 5: "title-3", 6: "title-3" }

/** A heading. At most one <Serif> phrase inside it (rule R8). */
export function Heading({ level = 2, size, className, ...rest }: { level?: 1 | 2 | 3 | 4 | 5 | 6; size?: TextStyle } & ComponentProps<"h2">) {
  const Tag = `h${level}` as ElementType
  return <Tag className={cx(`hl-text-${size ?? LEVEL_SIZE[level]}`, className)} {...rest} />
}

/** The one italic serif phrase in a headline. */
export function Serif({ className, ...rest }: ComponentProps<"span">) {
  return <span className={cx("hl-serif", className)} {...rest} />
}

/** A number that lines up with others, with its unit set quieter. */
export function Value({ unit, className, children, ...rest }: { unit?: ReactNode } & ComponentProps<"span">) {
  return (
    <span className={cx("hl-value", className)} {...rest}>
      {children}
      {unit ? <small>{unit}</small> : null}
    </span>
  )
}
