// The lit edge: one pixel of a project's light along the top of the window,
// brightest where its light comes from. The hallmark every Halation page
// carries. With daylight on, it travels with the sun.

import { daylight } from "../phenomena/daylight.js"

/** Adds the lit edge to the page. Options: across (0 to 1), daylight (boolean). */
export function mountLitEdge({ across = 0.5, daylight: follow = true } = {}) {
  const glow = document.createElement("div")
  const line = document.createElement("div")
  glow.className = "hl-lit-edge-glow"
  line.className = "hl-lit-edge"
  for (const el of [glow, line]) {
    el.setAttribute("aria-hidden", "true")
    document.body.appendChild(el)
  }
  const place = () => {
    const x = follow ? daylight(new Date()).across : across
    document.documentElement.style.setProperty("--hl-edge-x", `${Math.round(8 + x * 84)}%`)
  }
  place()
  const clock = follow ? setInterval(place, 60_000) : 0
  return {
    destroy() {
      clearInterval(clock)
      glow.remove()
      line.remove()
    },
  }
}
