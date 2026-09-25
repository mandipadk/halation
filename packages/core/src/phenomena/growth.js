// Growth: reaction-diffusion (Gray-Scott), the chemistry behind coral,
// fingerprints and lichen. It grows out of a few seeds and out of anything
// the pointer draws, spreads through a soft oval like a specimen under
// glass, and draws only its living edges, as hairlines. The pattern comes
// to rest on its own: it grows once, then stays still.

const CLEAR = `
void main() { o = vec4(1.0, 0.0, 0.0, 1.0); }
`

const SEED = `
uniform sampler2D u_state;
uniform vec2 u_point;
uniform float u_radius;
uniform float u_aspect;
void main() {
  vec2 c = texture(u_state, uv).rg;
  vec2 p = uv - u_point;
  p.x *= u_aspect;
  float s = smoothstep(u_radius, u_radius * 0.5, length(p));
  o = vec4(c.r, max(c.g, s * 0.9), 0.0, 1.0);
}
`

const REACT = `
uniform sampler2D u_state;
uniform vec2 u_texel;
uniform float u_aspect;
uniform float u_feed;
uniform float u_kill;
void main() {
  vec2 c = texture(u_state, uv).rg;
  vec2 lap = -c;
  lap += 0.2 * texture(u_state, uv + vec2(u_texel.x, 0.0)).rg;
  lap += 0.2 * texture(u_state, uv - vec2(u_texel.x, 0.0)).rg;
  lap += 0.2 * texture(u_state, uv + vec2(0.0, u_texel.y)).rg;
  lap += 0.2 * texture(u_state, uv - vec2(0.0, u_texel.y)).rg;
  lap += 0.05 * texture(u_state, uv + u_texel).rg;
  lap += 0.05 * texture(u_state, uv - u_texel).rg;
  lap += 0.05 * texture(u_state, uv + vec2(u_texel.x, -u_texel.y)).rg;
  lap += 0.05 * texture(u_state, uv + vec2(-u_texel.x, u_texel.y)).rg;
  // The specimen: life only inside a soft oval; outside, it can't hold on.
  vec2 q = (uv - 0.5) * vec2(u_aspect, 1.0);
  float edge = smoothstep(0.42, 0.62, length(q * vec2(0.62, 1.0)));
  float kill = u_kill + edge * 0.02;
  float a = c.r;
  float b = c.g;
  float abb = a * b * b;
  a += 1.0 * lap.r - abb + u_feed * (1.0 - a);
  b += 0.5 * lap.g + abb - (kill + u_feed) * b;
  o = vec4(clamp(a, 0.0, 1.0), clamp(b, 0.0, 1.0), 0.0, 1.0);
}
`

const DISPLAY = `
uniform sampler2D u_state;
uniform vec2 u_stateTexel;
void main() {
  float b = texture(u_state, uv).g;
  float bx = texture(u_state, uv + vec2(u_stateTexel.x, 0.0)).g - texture(u_state, uv - vec2(u_stateTexel.x, 0.0)).g;
  float by = texture(u_state, uv + vec2(0.0, u_stateTexel.y)).g - texture(u_state, uv - vec2(0.0, u_stateTexel.y)).g;
  // The living edge: where the pattern changes fastest.
  float edge = smoothstep(0.1, 0.32, length(vec2(bx, by)));
  float body = smoothstep(0.18, 0.4, b);
  if (u_mode < 0.5) {
    o = emit(mix(u_color2, u_color1, edge), edge * 1.25 + body * 0.06);
  } else {
    o = emit(u_color2, edge * 0.8 + body * 0.1);
  }
}
`

export const growth = {
  name: "Growth",
  defaults: { fps: 60, dpr: 1.5, maxPixels: 1_600_000 },
  init(ctx) {
    ctx.state = {
      clear: ctx.program(CLEAR),
      seed: ctx.program(SEED),
      react: ctx.program(REACT),
      display: ctx.program(DISPLAY),
      rng: seeded(ctx.opts.seed),
    }
    this.allocate(ctx)
  },
  allocate(ctx) {
    const s = ctx.state
    const short = 400
    const a = ctx.aspect
    const [w, h] = a >= 1 ? [Math.round(short * a), short] : [short, Math.round(short / a)]
    s.field?.dispose()
    s.field = ctx.pingpong(w, h, { filter: "linear" })
    ctx.draw(s.clear, s.field.read)
    ctx.draw(s.clear, s.field.write)
    // Seeds: a loose cluster, placed by the project's seed.
    for (let i = 0; i < 7; i++) {
      const angle = s.rng() * Math.PI * 2
      const r = 0.05 + s.rng() * 0.2
      this.seedAt(ctx, 0.5 + (Math.cos(angle) * r) / ctx.aspect, 0.5 + Math.sin(angle) * r * 0.8, 0.008 + s.rng() * 0.006)
    }
  },
  resize(ctx) {
    this.allocate(ctx)
  },
  seedAt(ctx, x, y, radius) {
    const s = ctx.state
    ctx.draw(s.seed, s.field.write, { u_state: s.field.read, u_point: [x, y], u_radius: radius, u_aspect: ctx.aspect })
    s.field.swap()
  },
  iterate(ctx, n) {
    const s = ctx.state
    for (let i = 0; i < n; i++) {
      ctx.draw(s.react, s.field.write, { u_state: s.field.read, u_texel: s.field.read.texel, u_aspect: ctx.aspect, u_feed: 0.037, u_kill: 0.06 })
      s.field.swap()
    }
  },
  step(ctx) {
    const { pointer } = ctx
    if (pointer.moved && pointer.inside) this.seedAt(ctx, pointer.x, pointer.y, 0.008)
    for (const c of pointer.clicks) this.seedAt(ctx, c.x, c.y, 0.02)
    this.iterate(ctx, Math.round(24 * Math.min(2, ctx.dt * 60)))
  },
  still(ctx) {
    this.iterate(ctx, 3200)
  },
  render(ctx) {
    const s = ctx.state
    ctx.draw(s.display, null, { u_state: s.field.read, u_stateTexel: s.field.read.texel })
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
