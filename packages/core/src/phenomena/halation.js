// Halation, the phenomenon the system is named after: on film, strong light
// bleeds back through the emulsion and bright things get a halo. Here the
// brightest parts of an element glow in the accent's hue. It's an SVG
// filter, so it costs no script per frame and can sit over any other
// phenomenon. On light grounds it steps aside: there is nothing bright
// enough to bloom. It's the one glow text may take (R22), once per page.

const FILTER_ID = "hl-halation"

function ensureFilter() {
  if (document.getElementById(FILTER_ID)) return
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("width", "0")
  svg.setAttribute("height", "0")
  svg.setAttribute("aria-hidden", "true")
  svg.style.position = "absolute"
  svg.innerHTML = `<filter id="${FILTER_ID}" x="-40%" y="-120%" width="180%" height="340%" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.62 1.2 0.22 0 -1.2" result="bright"/>
    <feGaussianBlur in="bright" stdDeviation="2.4" result="near"/>
    <feGaussianBlur in="bright" stdDeviation="18" result="far"/>
    <feFlood class="hl-halation-core" result="coreColor"/>
    <feComposite in="coreColor" in2="near" operator="in" result="coreGlow"/>
    <feFlood class="hl-halation-edge" result="edgeColor"/>
    <feComposite in="edgeColor" in2="far" operator="in" result="edgeGlow"/>
    <feMerge><feMergeNode in="edgeGlow"/><feMergeNode in="coreGlow"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`
  document.body.appendChild(svg)
}

/**
 * Makes an element's bright parts glow. Options: strength (0 to 1.5),
 * bloom (animate in, default true). Returns { update, destroy }.
 */
export function halate(element, { strength = 1, bloom = true } = {}) {
  ensureFilter()
  element.classList.add("hl-halated")
  const set = (v) => document.documentElement.style.setProperty("--hl-glow", String(v))
  let current = strength
  if (bloom && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    set(0)
    const start = performance.now()
    const step = (t) => {
      const p = Math.min(1, (t - start) / 1600)
      set(current * (1 - (1 - p) ** 3))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  } else set(current)
  return {
    name: "halation",
    update(next) {
      if (next.intensity !== undefined) current = next.intensity
      if (next.strength !== undefined) current = next.strength
      set(current)
    },
    wake() {},
    destroy() {
      element.classList.remove("hl-halated")
    },
  }
}
