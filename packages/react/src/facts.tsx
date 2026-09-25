import type { ComponentProps, ReactNode } from "react"
import { cx } from "./cx.ts"

/**
 * Facts as labels and values on their own lines. The replacement for
 * joining facts with dots (rule R9).
 */
export function Facts({ items, className, children, ...rest }: { items?: [ReactNode, ReactNode][] } & ComponentProps<"dl">) {
  return (
    <dl className={cx("hl-facts", className)} {...rest}>
      {items?.map(([label, value], i) => (
        <Fact key={i} label={label}>
          {value}
        </Fact>
      ))}
      {children}
    </dl>
  )
}

export function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}
