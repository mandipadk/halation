import { useRef, useState, type KeyboardEvent } from "react"
import { cx } from "./cx.ts"

const ORDER = ["⌃", "⌥", "⇧", "⌘"]
const MODIFIER: Record<string, string> = { Control: "⌃", Alt: "⌥", Shift: "⇧", Meta: "⌘" }
const NAMED: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Enter: "↵", Backspace: "⌫", Delete: "⌦", Tab: "⇥", " ": "Space" }

/** Shortcuts macOS keeps for itself, with why, in words. Pass your own to add to them. */
export const TAKEN_SHORTCUTS: Record<string, string> = {
  "⌘Q": "⌘Q quits the app you’re in. Pick another.",
  "⌘W": "⌘W closes windows everywhere. Pick another.",
  "⌘Space": "Spotlight uses ⌘Space.",
  "⌃↑": "Mission Control uses ⌃↑.",
  "⌘H": "⌘H hides the app you’re in.",
  "⌘⇥": "The app switcher uses ⌘Tab.",
}

const keyName = (e: KeyboardEvent) => {
  if (NAMED[e.key]) return NAMED[e.key]
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5)
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3)
  return e.key.length === 1 ? e.key.toUpperCase() : e.key
}

export type RecorderMessage = { text: string; tone: "info" | "problem" | "done" }

/**
 * A shortcut recorder with keycaps that have weight: they drop in once, go down
 * while held and light from beneath. A shortcut that's taken, or has no
 * modifier, is refused with the reason in words.
 */
export function ShortcutRecorder({
  value,
  onValueChange,
  label,
  taken = TAKEN_SHORTCUTS,
  onMessage,
  className,
}: {
  value: string[]
  onValueChange?: (keys: string[]) => void
  /** What the shortcut does, for people using a screen reader. */
  label: string
  taken?: Record<string, string>
  /** Guidance while recording, a refusal, or the saved shortcut, for you to show near the control. */
  onMessage?: (message: RecorderMessage) => void
  className?: string
}) {
  const [recording, setRecording] = useState(false)
  const [held, setHeld] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<{ mods: string[]; key: string } | null>(null)
  const [shake, setShake] = useState(false)
  const [live, setLive] = useState("")
  const heldRef = useRef(held)
  heldRef.current = held

  const tell = (text: string, tone: RecorderMessage["tone"] = "info") => {
    setLive(text)
    onMessage?.({ text, tone })
  }
  const stop = () => {
    setRecording(false)
    setHeld(new Set())
    setPending(null)
  }
  const refuse = (text: string) => {
    tell(text, "problem")
    setShake(true)
    setTimeout(() => setShake(false), 280)
    setPending(null)
    setHeld(new Set())
  }

  const shown = recording ? (pending ? [...pending.mods, pending.key] : ORDER.filter((m) => held.has(m))) : value

  return (
    <button
      type="button"
      className={cx("hl-recorder", className)}
      data-recording={recording ? "" : undefined}
      data-shake={shake ? "" : undefined}
      aria-label={`${label}: ${value.join(" ")}. ${recording ? "Recording." : "Press to record a new shortcut."}`}
      onClick={() => {
        if (recording) return
        setRecording(true)
        tell("Recording. Hold the modifiers, then press a key.")
      }}
      onBlur={() => {
        if (!recording) return
        stop()
        tell("Stopped recording. The shortcut is unchanged.")
      }}
      onKeyDown={(e) => {
        if (!recording) return
        e.preventDefault()
        if (e.key === "Escape") {
          stop()
          tell("Cancelled. The shortcut is unchanged.")
          return
        }
        const next = new Set(heldRef.current)
        if (MODIFIER[e.key]) {
          next.add(MODIFIER[e.key])
          setHeld(next)
          setPending(null)
          return
        }
        const key = keyName(e)
        const mods = ORDER.filter((m) => next.has(m))
        next.add(key)
        setHeld(next)
        setPending({ mods, key })
        if (!mods.length) return
        const reason = taken[mods.join("") + key]
        if (reason) setTimeout(() => refuse(reason), 140)
      }}
      onKeyUp={(e) => {
        if (!recording) return
        e.preventDefault()
        const next = new Set(heldRef.current)
        next.delete(MODIFIER[e.key] ?? keyName(e))
        setHeld(next)
        if (pending && !next.has(pending.key)) {
          if (!pending.mods.length) return refuse("A shortcut needs at least one of ⌘ ⌥ ⌃ ⇧ with the key.")
          const keys = [...pending.mods, pending.key]
          stop()
          onValueChange?.(keys)
          tell(`Saved. ${keys.join("")} now ${label.charAt(0).toLowerCase()}${label.slice(1)}.`, "done")
        }
      }}
    >
      {shown.length ? (
        shown.map((k) => (
          <span key={k} className="hl-cap" data-held={recording && held.has(k) ? "" : undefined} aria-hidden="true">
            {k}
          </span>
        ))
      ) : (
        <span className="hl-recorder-hint">Press a shortcut</span>
      )}
      <span className="hl-visually-hidden" aria-live="polite">
        {live}
      </span>
    </button>
  )
}
