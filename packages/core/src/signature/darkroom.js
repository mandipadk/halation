// The darkroom: a hidden inspector on every Halation page. Hold Alt and
// Shift and click the seal (or call enterDarkroom()) and the page goes under
// a red safelight: the baseline grid, each element's text style and color
// role, and the rules the page keeps, measured live by the checker.

import { check } from "../check/check.js"

const LABELLED = "[data-token], .hl-button, .hl-surface, .hl-state, h1, h2, h3"
const MAX_LABELS = 400
let active = null

/** Opens the darkroom. Returns its state; calling it again while open returns the same. */
export function enterDarkroom(root = document.body) {
  if (active) return active
  // The grid and labels live in the document, so each label stays on its element as the page scrolls.
  const overlay = document.createElement("div")
  overlay.className = "hl-darkroom-overlay"
  overlay.setAttribute("aria-hidden", "true")
  const panel = document.createElement("div")
  panel.className = "hl-darkroom-panel"
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-label", "Darkroom")
  document.body.append(overlay, panel)
  document.documentElement.classList.add("hl-darkroom")

  const report = check(root)
  const kept = report.rules.filter((r) => r.pass).length
  const summary = document.createElement("b")
  summary.textContent = `${kept} of ${report.rules.length} rules kept`
  const broken = report.rules.filter((r) => !r.pass).map((r) => {
    const line = document.createElement("span")
    line.textContent = `${r.id} ${r.says}`
    return line
  })
  const leave = document.createElement("button")
  leave.type = "button"
  leave.className = "hl-darkroom-leave"
  leave.textContent = "Leave the darkroom"
  leave.addEventListener("click", () => leaveDarkroom())
  const hint = document.createElement("small")
  hint.textContent = "Or press Escape."
  panel.append(summary, ...broken, leave, hint)

  let frame = 0
  const place = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const doc = document.documentElement
      overlay.style.width = `${doc.scrollWidth}px`
      overlay.style.height = `${doc.scrollHeight}px`
      const labels = []
      for (const el of root.querySelectorAll(LABELLED)) {
        if (labels.length >= MAX_LABELS) break
        if (el.closest(".hl-darkroom-panel")) continue
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) continue
        const label = document.createElement("span")
        label.className = "hl-darkroom-label"
        label.textContent = el.dataset.token ?? describe(el)
        label.style.left = `${Math.max(4, r.left + scrollX)}px`
        label.style.top = `${Math.max(4, r.top + scrollY - 16)}px`
        labels.push(label)
      }
      overlay.replaceChildren(...labels)
    })
  }
  place()
  const resize = new ResizeObserver(place)
  resize.observe(document.body)
  const onKey = (e) => e.key === "Escape" && leaveDarkroom()
  addEventListener("keydown", onKey)
  leave.focus({ preventScroll: true })
  active = { overlay, panel, report, cleanup: () => (cancelAnimationFrame(frame), resize.disconnect(), removeEventListener("keydown", onKey)) }
  document.dispatchEvent(new CustomEvent("halation:darkroom", { detail: { open: true } }))
  return active
}

/** Closes the darkroom, if it's open. */
export function leaveDarkroom() {
  if (!active) return
  active.cleanup()
  active.overlay.remove()
  active.panel.remove()
  document.documentElement.classList.remove("hl-darkroom")
  active = null
  document.dispatchEvent(new CustomEvent("halation:darkroom", { detail: { open: false } }))
}

/** Whether the darkroom is open. Listen for `halation:darkroom` on document to follow changes. */
export const inDarkroom = () => active !== null

function describe(el) {
  const cs = getComputedStyle(el)
  const variant = el.dataset.variant ? ` ${el.dataset.variant}` : ""
  if (el.classList.contains("hl-button")) return `button${variant}`
  if (el.classList.contains("hl-state")) return `state ${el.dataset.kind ?? ""}`.trim()
  return `${el.tagName.toLowerCase()} ${Math.round(parseFloat(cs.fontSize))}px`
}

/** Alt + Shift + click on the seal opens the darkroom, and closes it again. */
export function armDarkroom(seal) {
  seal.addEventListener("click", (e) => {
    if (!(e.altKey && e.shiftKey)) return
    e.preventDefault()
    active ? leaveDarkroom() : enterDarkroom()
  })
}
