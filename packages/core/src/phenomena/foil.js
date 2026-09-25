// Foil: a headline letterpressed into cotton card and foil-stamped in the
// accent. The pointer is a lamp held low over the paper: the pressed edges
// catch it on one side and fall into shadow on the other, and the foil
// flashes as the lamp passes. Without a pointer the light comes from the
// day (see daylight.js). It paints an opaque surface, not a glow.

const SURFACE = `
uniform sampler2D u_height;
uniform sampler2D u_foil;
uniform vec2 u_texel;
uniform vec4 u_lamp;
uniform float u_aspect;

// Cotton card: long soft fibers and a fine tooth.
float paper(vec2 p) {
  vec2 q = vec2(p.x * 0.9 + p.y * 0.3, p.y * 0.9 - p.x * 0.3);
  return fbm(q * vec2(90.0, 26.0) + u_seed) * 0.6 + vnoise(p * 420.0) * 0.4;
}

void main() {
  vec2 p = vec2(uv.x * u_aspect, uv.y);
  float e = 1.0 / u_resolution.y;
  // Height: the pressed type (from the texture) plus the paper's tooth.
  float hc = texture(u_height, uv).r;
  float hx = texture(u_height, uv + vec2(u_texel.x, 0.0)).r - texture(u_height, uv - vec2(u_texel.x, 0.0)).r;
  float hy = texture(u_height, uv + vec2(0.0, u_texel.y)).r - texture(u_height, uv - vec2(0.0, u_texel.y)).r;
  float px = paper(p + vec2(e, 0.0)) - paper(p - vec2(e, 0.0));
  float py = paper(p + vec2(0.0, e)) - paper(p - vec2(0.0, e));
  vec3 n = normalize(vec3(-(hx * 9.0 + px * 0.6), -(hy * 9.0 + py * 0.6), 1.0));
  float foil = texture(u_foil, uv).r;
  // Foil is a thin metal film with a slight crinkle.
  if (foil > 0.01) {
    vec2 c = vec2(vnoise(p * 70.0 + 3.0), vnoise(p * 70.0 - 5.0)) - 0.5;
    n = normalize(n + vec3(c * 0.14 * foil, 0.0));
  }
  // The lamp: a point light over the page when the pointer is there,
  // otherwise the day's light from far away.
  vec3 surface = vec3(p, 0.0);
  vec3 lampPos = vec3(u_lamp.x * u_aspect, u_lamp.y, 0.32);
  vec3 toLamp = lampPos - surface;
  vec3 l = normalize(mix(u_light, normalize(toLamp), u_lamp.w));
  float falloff = mix(1.0, 1.0 / (1.0 + dot(toLamp, toLamp) * 2.2), u_lamp.w);
  vec3 v = vec3(0.0, 0.0, 1.0);
  float diffuse = max(dot(n, l), 0.0);
  float cavity = smoothstep(0.5, 0.36, hc);
  if (u_mode < 0.5) {
    vec3 card = vec3(0.072, 0.07, 0.068);
    vec3 color = card * (0.35 + 1.5 * diffuse * falloff) - cavity * 0.012;
    // Foil: a metal mirror tinted by the accent, bright only where it faces the lamp.
    vec3 r = reflect(-l, n);
    float spec = pow(max(dot(r, v), 0.0), 40.0);
    float sheen = pow(max(dot(r, v), 0.0), 5.0);
    // The foil also mirrors the room: a soft brightness from above.
    float room = 0.3 + 0.35 * smoothstep(-0.3, 0.6, n.y);
    vec3 metal = u_accent * (room * 0.55 + 0.9 * sheen * falloff) + mix(u_accent, vec3(1.0), 0.6) * spec * 3.0 * falloff;
    color = mix(color, metal, foil);
    o = vec4(color, 1.0);
  } else {
    vec3 card = vec3(0.955, 0.948, 0.935);
    vec3 color = card * (0.72 + 0.34 * diffuse * falloff) - cavity * 0.02;
    vec3 r = reflect(-l, n);
    float spec = pow(max(dot(r, v), 0.0), 60.0);
    float sheen = pow(max(dot(r, v), 0.0), 6.0);
    vec3 metal = u_accent * (0.55 + 0.45 * sheen * falloff) + mix(u_accent, vec3(1.0), 0.6) * spec * 1.6 * falloff;
    color = mix(color, metal, foil);
    o = vec4(color, 1.0);
  }
}
`

/** Draws text runs centered in a canvas; returns their bounding box. */
function setType(canvas, runs, box) {
  const g = canvas.getContext("2d")
  const measure = (size) =>
    runs.map((r) => {
      g.font = r.font.replace("{size}", `${size * (r.scale ?? 1)}px`)
      g.letterSpacing = r.tracking ?? "0px"
      return g.measureText(r.text).width
    })
  // Match the page's own heading when we know where it is; otherwise fit.
  let size = box ? box.size * canvas.height : 150 * (canvas.height / 900)
  const total = measure(size).reduce((a, b) => a + b, 0)
  if (total > canvas.width * 0.92) size *= (canvas.width * 0.92) / total
  const widths = measure(size)
  const totalWidth = widths.reduce((a, b) => a + b, 0)
  let x = (canvas.width - totalWidth) / 2
  const y = box ? box.baseline * canvas.height : canvas.height * 0.44
  g.textBaseline = "alphabetic"
  runs.forEach((r, i) => {
    g.font = r.font.replace("{size}", `${size * (r.scale ?? 1)}px`)
    g.letterSpacing = r.tracking ?? "0px"
    g.fillText(r.text, x, y)
    x += widths[i]
  })
  return { top: y - size * 0.8, bottom: y + size * 0.25, size }
}

export const foil = {
  name: "Foil",
  opaque: true,
  defaults: { fps: 60, dpr: 1.5, maxPixels: 1_800_000 },
  init(ctx) {
    ctx.state = { program: ctx.program(SURFACE), lamp: [0.5, 0.6, 0], textures: null }
    this.typeset(ctx)
    document.fonts?.ready.then(() => this.typeset(ctx))
  },
  resize(ctx) {
    this.typeset(ctx)
  },
  update(ctx, next) {
    if (next.runs || next.typeBox || next.drawMark) this.typeset(ctx)
  },
  typeset(ctx) {
    const s = ctx.state
    const w = ctx.width
    const h = ctx.height
    if (!w || !h) return
    const runs = ctx.opts.runs ?? [{ text: "Pressed into ", font: "600 {size} Geist, sans-serif", tracking: "-0.04em" }, { text: "paper.", font: "italic 400 {size} 'Instrument Serif', serif", scale: 1.06, tracking: "-0.01em" }]
    // Height: paper at mid grey, type pressed below it, edges softened into a bevel.
    const height = document.createElement("canvas")
    height.width = w
    height.height = h
    const hg = height.getContext("2d")
    hg.fillStyle = "rgb(128,128,128)"
    hg.fillRect(0, 0, w, h)
    const type = document.createElement("canvas")
    type.width = w
    type.height = h
    const tg = type.getContext("2d")
    tg.fillStyle = "#fff"
    // A drawn mark (a project's seal) instead of type, when given.
    const box = ctx.opts.drawMark ? (ctx.opts.drawMark(tg, w, h), { size: h * 0.3 }) : setType(type, runs, ctx.opts.typeBox)
    // The same type in black, pressed into the grey: darker is deeper.
    const ink = document.createElement("canvas")
    ink.width = w
    ink.height = h
    const ig = ink.getContext("2d")
    ig.drawImage(type, 0, 0)
    ig.globalCompositeOperation = "source-in"
    ig.fillStyle = "#000"
    ig.fillRect(0, 0, w, h)
    hg.filter = `blur(${Math.max(1, box.size * 0.018)}px)`
    hg.globalAlpha = 0.55
    hg.drawImage(ink, 0, 0)
    hg.filter = "none"
    hg.globalAlpha = 1
    // The foil sits on the type's face, a hair inside its edge.
    const mask = document.createElement("canvas")
    mask.width = w
    mask.height = h
    const mg = mask.getContext("2d")
    mg.fillStyle = "#000"
    mg.fillRect(0, 0, w, h)
    mg.filter = `blur(${Math.max(0.6, box.size * 0.006)}px)`
    mg.drawImage(type, 0, 0)
    s.textures?.height.dispose()
    s.textures?.foil.dispose()
    s.textures = { height: ctx.texture(height), foil: ctx.texture(mask) }
    s.box = box
  },
  step(ctx) {
    const s = ctx.state
    const { pointer } = ctx
    const k = Math.min(1, ctx.dt * 6)
    s.lamp[0] += (pointer.x - s.lamp[0]) * k
    s.lamp[1] += (pointer.y - s.lamp[1]) * k
    s.lamp[2] += ((pointer.inside ? 1 : 0) - s.lamp[2]) * Math.min(1, ctx.dt * 2.5)
  },
  render(ctx) {
    const s = ctx.state
    if (!s.textures) return
    ctx.draw(s.program, null, {
      u_height: s.textures.height,
      u_foil: s.textures.foil,
      u_texel: [1 / ctx.width, 1 / ctx.height],
      u_lamp: [s.lamp[0], s.lamp[1], 0, s.lamp[2]],
      u_aspect: ctx.aspect,
    })
  },
}
