// Halation's motion, as runnable code: tempo, springs and the entrance.
// Durations come from the tokens and scale with the tempo; springs are
// simulated so they carry velocity and can be retargeted mid-flight. Most
// moves are CSS in styles.css (unfold, focus pull, press, stack); this is
// what needs a script.

export const motion = {
  tempo: "crisp",
  slow: 1,
  forcedReduce: false,
  tempos: {
    calm: { scale: 1.25, bounce: 0, stagger: 65, rise: 20, blur: 12 },
    crisp: { scale: 1, bounce: 0.15, stagger: 50, rise: 16, blur: 10 },
    lively: { scale: 0.85, bounce: 0.3, stagger: 40, rise: 12, blur: 6 },
  },
  get t() {
    return motion.tempos[motion.tempo]
  },
  reduced() {
    return motion.forcedReduce || matchMedia("(prefers-reduced-motion: reduce)").matches
  },
  /** A token duration in ms, scaled by tempo and slow motion. */
  ms(name) {
    const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--duration-${name}`)) || 200
    return value * motion.t.scale * motion.slow
  },
  ease(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--ease-${name}`).trim() || "ease-out"
  },
  apply() {
    const root = document.documentElement
    root.style.setProperty("--t", String(motion.t.scale * motion.slow))
    root.style.setProperty("--stagger-t", `${motion.t.stagger * motion.slow}ms`)
    root.style.setProperty("--rise", `${motion.t.rise}px`)
    root.style.setProperty("--rise-blur", `${motion.t.blur}px`)
    root.style.setProperty("--ease-tempo-spring", springEasing(motion.t.bounce))
    root.dataset.reduce = motion.reduced() ? "on" : "off"
  },
}

/**
 * A damped spring, Apple's parameters: `response` (seconds per oscillation)
 * and `bounce` (0 = no overshoot). Integrated in small fixed steps so a
 * release velocity carries into the motion.
 */
export function spring({ from, to, velocity = 0, bounce = motion.t.bounce, response = 0.42, onUpdate, onDone }) {
  const zeta = 1 - Math.max(0, Math.min(0.9, bounce))
  const stiffness = (2 * Math.PI / response) ** 2
  const damping = (4 * Math.PI * zeta) / response
  let x = from
  let v = velocity
  let target = to
  let frame = 0
  let last = performance.now()
  const step = (now) => {
    let dt = Math.min(0.064, (now - last) / 1000) / motion.slow
    last = now
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240)
      const a = -stiffness * (x - target) - damping * v
      v += a * h
      x += v * h
      dt -= h
    }
    onUpdate(x)
    if (Math.abs(v) < 0.02 && Math.abs(x - target) < 0.02) {
      onUpdate(target)
      onDone?.()
      return
    }
    frame = requestAnimationFrame(step)
  }
  if (motion.reduced()) {
    onUpdate(to)
    onDone?.()
    return { stop() {}, retarget() {} }
  }
  frame = requestAnimationFrame(step)
  return {
    stop() {
      cancelAnimationFrame(frame)
    },
    retarget(next) {
      target = next
    },
    get velocity() {
      return v
    },
  }
}

/** The same spring, sampled into a CSS linear() easing (from rest, 0 to 1). */
export function springEasing(bounce, samples = 48) {
  const zeta = 1 - Math.max(0, Math.min(0.9, bounce))
  const omega = (2 * Math.PI) / 0.5
  const x = (t) => {
    if (zeta >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t)
    const wd = omega * Math.sqrt(1 - zeta * zeta)
    return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
  }
  const end = Math.log(1000) / (zeta * omega)
  const stops = []
  for (let i = 0; i <= samples; i++) stops.push(i === samples ? "1" : String(Number(x((i / samples) * end).toFixed(4))))
  return `linear(${stops.join(", ")})`
}

/** Web Animations with tempo and slow motion applied. */
export function play(el, keyframes, { duration = "dialog", easing = "out", delay = 0, fill = "both" } = {}) {
  const ms = typeof duration === "number" ? duration * motion.t.scale * motion.slow : motion.ms(duration)
  return el.animate(keyframes, {
    duration: motion.reduced() ? Math.min(ms, 200) : ms,
    easing: easing.startsWith("cubic") || easing.startsWith("linear(") ? easing : motion.ease(easing),
    delay: delay * motion.slow,
    fill,
  })
}

/** A color token resolved to a concrete value for the current mode. */
export function resolveColor(name, alpha = 1) {
  const probe = document.createElement("span")
  probe.style.color = `color-mix(in oklab, var(--color-${name}) ${alpha * 100}%, transparent)`
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

/** Rise: elements arrive in reading order, out of a soft blur. */
export function rise(elements, { stagger = motion.t.stagger } = {}) {
  const list = [...elements]
  return list.map((el, i) => {
    if (motion.reduced()) return play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 })
    return play(
      el,
      [
        { opacity: 0.1, transform: `translateY(${motion.t.rise}px)`, filter: `blur(${motion.t.blur}px)` },
        { opacity: 1, transform: "none", filter: "blur(0)" },
      ],
      { duration: "reveal", delay: Math.min(i, 5) * stagger },
    )
  })
}

/** Sets the page's tempo: "calm", "crisp" or "lively". */
export function setTempo(name) {
  motion.tempo = name
  motion.apply()
}
