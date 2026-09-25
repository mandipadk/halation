import type { ReactNode } from "react"
import { Code } from "./Code.tsx"

/** A live example: the thing itself, then how to write it. */
export function Demo({ title, about, code, children, center = true }: { title: string; about?: ReactNode; code?: string; children: ReactNode; center?: boolean }) {
  return (
    <article className="demo" id={title.toLowerCase().replace(/\s+/g, "-")}>
      <header className="demo-head">
        <h3 className="hl-text-title-3">{title}</h3>
        {about ? <p className="hl-text-body-sm hl-tone-muted">{about}</p> : null}
      </header>
      <div className="demo-stage" data-center={center ? "" : undefined}>
        {children}
      </div>
      {code ? <Code label="React">{code}</Code> : null}
    </article>
  )
}

export function PageHead({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <p className="kicker">{kicker}</p>
      <h1 className="hl-text-display">{title}</h1>
      {children ? <p className="hl-text-body-lg hl-tone-muted lead">{children}</p> : null}
    </header>
  )
}
