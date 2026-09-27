import { useState } from "react"
import { icons } from "@halation/react"

/** The one command, on a glass capsule, with a copy button that says when it worked. */
export function Install({ command = "npm create halation" }: { command?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="install">
      <code>{command}</code>
      <button
        type="button"
        className="install-copy"
        aria-label={copied ? "Copied" : `Copy ${command}`}
        onClick={() => {
          navigator.clipboard?.writeText(command).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          })
        }}
      >
        {copied ? <icons.CheckIcon /> : <CopyGlyph />}
      </button>
    </div>
  )
}

function CopyGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5" y="5" width="8.5" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 3.2A1.8 1.8 0 0 0 9 2.5H4.3A1.8 1.8 0 0 0 2.5 4.3V9c0 .6.3 1.2.8 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
