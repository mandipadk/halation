// The opening: the first time someone opens a Halation project, the page
// appears the way a print does in the developer tray: pale and soft, then
// contrast rising, then sharp, with a last bloom of halation on the
// brightest things. Once per visitor; skipped for reduced motion.

const KEY = "hl-developed"

/** Develops `element` once per visitor. Pass { always: true } to replay. */
export function develop(element = document.body, { always = false, duration = 1800 } = {}) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null
  try {
    if (!always && localStorage.getItem(KEY)) return null
    localStorage.setItem(KEY, "1")
  } catch {}
  return element.animate(
    [
      { filter: "brightness(2.1) contrast(0.18) sepia(0.7) blur(9px)", opacity: 0.35 },
      { filter: "brightness(1.35) contrast(0.62) sepia(0.35) blur(2.5px)", opacity: 0.85, offset: 0.55 },
      { filter: "brightness(1) contrast(1) sepia(0) blur(0px)", opacity: 1 },
    ],
    { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "none" },
  )
}
