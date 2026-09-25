// Ripple: still water over a tiled floor. A real wave equation runs on a
// small grid; the pointer trails ripples, a click drops a stone, and the
// floor's hairline grid bends through the surface while the light glints
// on the crests. When nothing touches it, a rare drop keeps it from
// looking frozen, until the page settles.

const WAVE = `
uniform sampler2D u_state;
uniform vec2 u_texel;
uniform float u_damping;
void main() {
  // r: height now, g: height a step ago.
  vec2 c = texture(u_state, uv).rg;
  float l = texture(u_state, uv - vec2(u_texel.x, 0.0)).r;
  float r = texture(u_state, uv + vec2(u_texel.x, 0.0)).r;
  float t = texture(u_state, uv + vec2(0.0, u_texel.y)).r;
  float b = texture(u_state, uv - vec2(0.0, u_texel.y)).r;
  float next = ((l + r + t + b) * 0.5 - c.g) * u_damping;
  o = vec4(next, c.r, 0.0, 1.0);
}
`

const DROP = `
uniform sampler2D u_state;
uniform vec2 u_point;
uniform float u_radius;
uniform float u_amount;
uniform float u_aspect;
void main() {
  vec2 c = texture(u_state, uv).rg;
  vec2 p = uv - u_point;
  p.x *= u_aspect;
  float d = length(p) / u_radius;
  float drop = d < 1.0 ? 0.5 - cos(d * 3.14159) * 0.5 : 1.0;
  o = vec4(c.r - (1.0 - drop) * u_amount, c.g, 0.0, 1.0);
}
`

const SURFACE = `
uniform sampler2D u_state;
uniform vec2 u_stateTexel;
uniform float u_aspect;
uniform float u_tile;

float grid(vec2 p) {
  vec2 g = abs(fract(p) - 0.5);
  vec2 w = fwidth(p) * 0.9;
  vec2 line = smoothstep(vec2(0.5) - w, vec2(0.5), g);
  return max(line.x, line.y);
}

void main() {
  float hl = texture(u_state, uv - vec2(u_stateTexel.x, 0.0)).r;
  float hr = texture(u_state, uv + vec2(u_stateTexel.x, 0.0)).r;
  float ht = texture(u_state, uv + vec2(0.0, u_stateTexel.y)).r;
  float hb = texture(u_state, uv - vec2(0.0, u_stateTexel.y)).r;
  vec3 n = normalize(vec3(hl - hr, hb - ht, 0.07));
  // The floor seen through the water: bent by the surface's slope.
  vec2 floorUv = vec2(uv.x * u_aspect, uv.y) + n.xy * 0.035;
  float tiles = grid(floorUv * u_tile);
  // Light: a glint where the surface faces the sun, soft shade in the troughs.
  vec3 l = normalize(u_light);
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float glint = pow(max(dot(n, h), 0.0), 70.0);
  float slope = 1.0 - n.z;
  if (u_mode < 0.5) {
    float lines = tiles * 0.22;
    o = emit(mix(u_color2, u_color1, glint), lines + glint * 1.5 + slope * 1.6);
  } else {
    float lines = tiles * 0.32;
    o = emit(u_color2, lines + slope * 1.2);
  }
}
`

export const ripple = {
  name: "Ripple",
  defaults: { fps: 60, dpr: 1.5, maxPixels: 1_600_000 },
  init(ctx) {
    ctx.state = {
      wave: ctx.program(WAVE),
      drop: ctx.program(DROP),
      surface: ctx.program(SURFACE),
      rng: seeded(ctx.opts.seed),
      nextDrop: 1.2,
      last: null,
    }
    this.allocate(ctx)
  },
  allocate(ctx) {
    const s = ctx.state
    const short = 220
    const a = ctx.aspect
    const [w, h] = a >= 1 ? [Math.round(short * a), short] : [short, Math.round(short / a)]
    s.field?.dispose()
    s.field = ctx.pingpong(w, h)
  },
  resize(ctx) {
    this.allocate(ctx)
  },
  dropAt(ctx, x, y, radius, amount) {
    const s = ctx.state
    ctx.draw(s.drop, s.field.write, { u_state: s.field.read, u_point: [x, y], u_radius: radius, u_amount: amount, u_aspect: ctx.aspect })
    s.field.swap()
  },
  step(ctx) {
    const s = ctx.state
    const { pointer } = ctx
    if (pointer.moved && pointer.inside) {
      // A finger trailed through water: small drops along the path.
      const from = s.last ?? { x: pointer.x, y: pointer.y }
      const d = Math.hypot((pointer.x - from.x) * ctx.aspect, pointer.y - from.y)
      const n = Math.min(6, Math.ceil(d / 0.012))
      for (let i = 1; i <= n; i++) {
        const t = i / n
        this.dropAt(ctx, from.x + (pointer.x - from.x) * t, from.y + (pointer.y - from.y) * t, 0.012, 0.012)
      }
    }
    s.last = pointer.inside ? { x: pointer.x, y: pointer.y } : null
    for (const c of pointer.clicks) this.dropAt(ctx, c.x, c.y, 0.03, 0.09)
    if (ctx.time > s.nextDrop) {
      this.dropAt(ctx, 0.1 + s.rng() * 0.8, 0.1 + s.rng() * 0.8, 0.018, 0.04)
      s.nextDrop = ctx.time + 1.8 + s.rng() * 2.6
    }
    // Two steps a frame keeps the waves moving at a natural pace.
    for (let i = 0; i < 2; i++) {
      ctx.draw(s.wave, s.field.write, { u_state: s.field.read, u_texel: s.field.read.texel, u_damping: 0.992 })
      s.field.swap()
    }
  },
  still(ctx) {
    this.dropAt(ctx, 0.3, 0.6, 0.04, 0.08)
    this.dropAt(ctx, 0.7, 0.4, 0.03, 0.06)
    for (let i = 0; i < 70; i++) {
      ctx.draw(ctx.state.wave, ctx.state.field.write, { u_state: ctx.state.field.read, u_texel: ctx.state.field.read.texel, u_damping: 0.992 })
      ctx.state.field.swap()
    }
  },
  render(ctx) {
    const s = ctx.state
    ctx.draw(s.surface, null, { u_state: s.field.read, u_stateTexel: s.field.read.texel, u_aspect: ctx.aspect, u_tile: 9 })
  },
}

function seeded(seed) {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
