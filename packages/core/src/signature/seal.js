// A project's signature, all generated from its name: the seal (slits of
// light), the score the seal plays, the grain of its film, its share card
// and its console greeting. The same name always gives the same result.

export function hash(text) {
  let h = 2166136261
  for (const ch of String(text).trim().toLowerCase()) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function sequence(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The seal: one to three slits of light, each with an angle, a length and a brightness. */
export function sealParts(name) {
  const r = sequence(hash(name || "Halation"))
  const count = 1 + Math.floor(r() * 3)
  const slits = []
  for (let i = 0; i < count; i++) {
    const x = 0.5 + (count === 1 ? 0 : (i / (count - 1) - 0.5) * 0.36)
    slits.push({ x, angle: Math.round((r() - 0.5) * 36), length: 0.42 + r() * 0.28, bright: 1 - i * 0.22 })
  }
  return slits
}

/** The seal as SVG. `lit` is the index of a slit to show glowing (while it sounds). */
export function sealSvg(name, size, { glow = "", lit = -1, tile = "oklch(16% 0 0)" } = {}) {
  const parts = sealParts(name)
  const w = size >= 40 ? 3.4 : 4.2
  const slits = parts
    .map((s, i) => {
      const cx = s.x * 64
      const len = s.length * 64
      const on = i === lit
      return `<rect x="${(cx - w / 2).toFixed(1)}" y="${(32 - len / 2).toFixed(1)}" width="${w}" height="${len.toFixed(1)}" rx="${w / 2}" fill="oklch(99% 0.01 60)" opacity="${on ? 1 : s.bright * (lit >= 0 ? 0.55 : 1)}" transform="rotate(${s.angle} ${cx.toFixed(1)} 32)"${on && glow ? ` filter="url(#${glow})"` : ""}/>`
    })
    .join("")
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><rect width="64" height="64" rx="18" fill="${tile}"/>${slits}</svg>`
}

/** Draws the seal (white on transparent) into a 2D canvas, for foil to press. */
export function drawSeal(name) {
  const parts = sealParts(name)
  return (g, w, h) => {
    const size = Math.min(w, h) * 0.62
    const ox = (w - size) / 2
    const oy = (h - size) / 2
    const k = size / 64
    g.save()
    g.fillStyle = "#fff"
    g.strokeStyle = "#fff"
    // The seal's border, pressed as a fine ring.
    g.lineWidth = 1.6 * k
    roundRect(g, ox + 2 * k, oy + 2 * k, 60 * k, 60 * k, 17 * k)
    g.stroke()
    for (const s of parts) {
      const cx = ox + s.x * 64 * k
      const cy = oy + 32 * k
      const len = s.length * 64 * k
      const width = 3.6 * k
      g.save()
      g.translate(cx, cy)
      g.rotate((s.angle * Math.PI) / 180)
      roundRect(g, -width / 2, -len / 2, width, len, width / 2)
      g.fill()
      g.restore()
    }
    g.restore()
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/**
 * The score: each slit is a note. Its angle picks the pitch within the
 * tempo's scale, its length the note's length. The seal is literally what
 * you hear.
 */
const SCALES = {
  calm: { root: 220, steps: [0, 2, 4, 7, 9, 12, 14], gap: 0.34 },
  crisp: { root: 261.63, steps: [0, 2, 4, 6, 7, 11, 12], gap: 0.22 },
  lively: { root: 329.63, steps: [0, 2, 4, 5, 7, 9, 12], gap: 0.16 },
}
export function score(name, tempo = "crisp") {
  const scale = SCALES[tempo] ?? SCALES.crisp
  return sealParts(name).map((s, i) => {
    const degree = Math.round(((s.angle + 18) / 36) * (scale.steps.length - 1))
    return { at: i * scale.gap, frequency: scale.root * 2 ** (scale.steps[degree] / 12), length: 0.9 + s.length * 1.6 }
  })
}

let audio = null
/** Plays the score as a soft bell: two-operator FM with a small room. */
export function playChime(notes, onNote = undefined) {
  audio ??= new AudioContext()
  const ctx = audio
  if (ctx.state === "suspended") ctx.resume()
  const out = ctx.createGain()
  out.gain.value = 0.22
  const room = ctx.createConvolver()
  room.buffer = impulse(ctx, 1.8)
  const wet = ctx.createGain()
  wet.gain.value = 0.28
  out.connect(ctx.destination)
  out.connect(room)
  room.connect(wet)
  wet.connect(ctx.destination)
  const start = ctx.currentTime + 0.05
  notes.forEach((n, i) => {
    const t = start + n.at
    const carrier = ctx.createOscillator()
    const modulator = ctx.createOscillator()
    const depth = ctx.createGain()
    const amp = ctx.createGain()
    carrier.frequency.value = n.frequency
    modulator.frequency.value = n.frequency * 2.76
    depth.gain.setValueAtTime(n.frequency * 1.6, t)
    depth.gain.exponentialRampToValueAtTime(1, t + n.length * 0.6)
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(1, t + 0.006)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + n.length)
    modulator.connect(depth)
    depth.connect(carrier.frequency)
    carrier.connect(amp)
    amp.connect(out)
    carrier.start(t)
    modulator.start(t)
    carrier.stop(t + n.length + 0.1)
    modulator.stop(t + n.length + 0.1)
    if (onNote) setTimeout(() => onNote(i), (t - ctx.currentTime) * 1000)
  })
  const total = Math.max(...notes.map((n) => n.at + n.length))
  if (onNote) setTimeout(() => onNote(-1), (start - ctx.currentTime + total * 0.55) * 1000)
}

function impulse(ctx, seconds) {
  const length = Math.round(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  const r = sequence(7)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) data[i] = (r() * 2 - 1) * (1 - i / length) ** 3
  }
  return buffer
}

/** The film's grain, seeded by the name: no two projects share a batch. */
export function paintGrain(canvas, name) {
  const g = canvas.getContext("2d")
  const { width: w, height: h } = canvas
  const image = g.createImageData(w, h)
  const r = sequence(hash(name) ^ 0x51ed27)
  // Two octaves of clumped grain, the way silver halide crystals clump.
  const coarse = new Float32Array(Math.ceil(w / 3) * Math.ceil(h / 3)).map(() => r())
  const cw = Math.ceil(w / 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = coarse[Math.floor(y / 3) * cw + Math.floor(x / 3)] * 0.45 + r() * 0.55
      const c = Math.round(58 + v * 120)
      const i = (y * w + x) * 4
      image.data[i] = image.data[i + 1] = image.data[i + 2] = c
      image.data[i + 3] = 255
    }
  }
  g.putImageData(image, 0, 0)
}

export const batch = (name) => String(hash(name) % 100000).padStart(5, "0")

/**
 * Everything a colophon says about a project, in order.
 * @returns {[string, string][]}
 */
export function colophon(name, character, { rules = 18 } = {}) {
  return [
    ["Project", name],
    ["Light", character.light],
    ["Lens", character.lens],
    ["Tempo", character.tempo],
    ["Form", character.form],
    ["Stock", character.stock],
    ["Accent", character.accent],
    ["Type", character.type ?? "Geist and Instrument Serif"],
    ["Contrast", "Every pair passes, in both modes"],
    ["Rules kept", `${rules} of ${rules}`],
    ["Film batch", batch(name)],
    ["Made with", "Halation"],
  ]
}
