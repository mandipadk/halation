import { useState } from "react"

/** A code block on its own surface, with a copy button. */
export function Code({ children, label }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="code-block" data-surface="">
      <div className="code-head">
        <span>{label ?? "Code"}</span>
        <button
          type="button"
          className="code-copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(children)
              setCopied(true)
              setTimeout(() => setCopied(false), 1400)
            } catch {}
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{children.trim()}</code>
      </pre>
    </div>
  )
}
