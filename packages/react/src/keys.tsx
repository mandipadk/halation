import type { ComponentProps } from "react"
import { cx } from "./cx.ts"

export function Kbd({ className, ...rest }: ComponentProps<"kbd">) {
  return <kbd className={cx("hl-kbd", className)} {...rest} />
}

/** A key combination, each key on its own cap with a gap between (rule R16). */
export function Keys({ keys, className, ...rest }: { keys: string[] } & ComponentProps<"span">) {
  return (
    <span className={cx("hl-keys", className)} {...rest}>
      <span className="hl-visually-hidden">{keys.join(" ")}</span>
      {keys.map((k, i) => (
        <Kbd key={i} aria-hidden>
          {k}
        </Kbd>
      ))}
    </span>
  )
}
