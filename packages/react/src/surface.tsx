import type { ComponentProps, ReactNode } from "react"
import { cx, flag } from "./cx.ts"

/** A box, used only when something must read as an object (rule R13). */
export function Surface({ elevation = "flat", padding = "md", className, ...rest }: { elevation?: "flat" | "raised" | "overlay"; padding?: "md" | "none" } & ComponentProps<"div">) {
  return <div className={cx("hl-surface", className)} data-elevation={elevation === "flat" ? undefined : elevation} data-padding={padding === "none" ? "none" : undefined} {...rest} />
}

export function Divider({ orientation = "horizontal", className, ...rest }: { orientation?: "horizontal" | "vertical" } & ComponentProps<"hr">) {
  return <hr className={cx("hl-divider", className)} data-orientation={orientation === "vertical" ? "vertical" : undefined} {...rest} />
}

export function List({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("hl-list", className)} role="list" {...rest} />
}

/** A row: a leading element, a title with an optional detail, and something at the end. */
export function ListRow({ leading, title, detail, trailing, selected, className, ...rest }: { leading?: ReactNode; title: ReactNode; detail?: ReactNode; trailing?: ReactNode; selected?: boolean } & Omit<ComponentProps<"div">, "title">) {
  return (
    <div className={cx("hl-list-row", className)} role="listitem" data-selected={flag(selected)} {...rest}>
      {leading ?? <span />}
      <div>
        <div>{title}</div>
        {detail ? <div className="hl-list-detail">{detail}</div> : null}
      </div>
      {trailing ?? <span />}
    </div>
  )
}
