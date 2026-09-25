// Ink: a real fluid you stir with the pointer. Stable fluids (Stam):
// advect, add vorticity, project out divergence with a pressure solve.
// Dark grounds show it as lit smoke; light grounds as ink in water. When
// nobody touches it, a slow current keeps it barely alive until it settles.

const ADVECT = `
uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform vec2 u_texel;
uniform float u_dt;
uniform float u_dissipation;
void main() {
  vec2 coord = uv - u_dt * texture(u_velocity, uv).xy * u_texel;
  o = texture(u_source, coord) / (1.0 + u_dissipation * u_dt);
}
`

const SPLAT = `
uniform sampler2D u_target;
uniform vec2 u_point;
uniform vec3 u_value;
uniform float u_radius;
uniform float u_aspect;
void main() {
  vec2 p = uv - u_point;
  p.x *= u_aspect;
  float g = exp(-dot(p, p) / u_radius);
  o = vec4(texture(u_target, uv).xyz + g * u_value, 1.0);
}
`

const CURL = `
uniform sampler2D u_velocity;
uniform vec2 u_texel;
void main() {
  float l = texture(u_velocity, uv - vec2(u_texel.x, 0.0)).y;
  float r = texture(u_velocity, uv + vec2(u_texel.x, 0.0)).y;
  float t = texture(u_velocity, uv + vec2(0.0, u_texel.y)).x;
  float b = texture(u_velocity, uv - vec2(0.0, u_texel.y)).x;
  o = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}
`

const VORTICITY = `
uniform sampler2D u_velocity;
uniform sampler2D u_curl;
uniform vec2 u_texel;
uniform float u_strength;
uniform float u_dt;
void main() {
  float l = texture(u_curl, uv - vec2(u_texel.x, 0.0)).x;
  float r = texture(u_curl, uv + vec2(u_texel.x, 0.0)).x;
  float t = texture(u_curl, uv + vec2(0.0, u_texel.y)).x;
  float b = texture(u_curl, uv - vec2(0.0, u_texel.y)).x;
  float c = texture(u_curl, uv).x;
  vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  force /= length(force) + 0.0001;
  force *= u_strength * c;
  force.y *= -1.0;
  vec2 v = texture(u_velocity, uv).xy + force * u_dt;
  o = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}
`

const DIVERGENCE = `
uniform sampler2D u_velocity;
uniform vec2 u_texel;
void main() {
  vec2 c = texture(u_velocity, uv).xy;
  float l = texture(u_velocity, uv - vec2(u_texel.x, 0.0)).x;
  float r = texture(u_velocity, uv + vec2(u_texel.x, 0.0)).x;
  float t = texture(u_velocity, uv + vec2(0.0, u_texel.y)).y;
  float b = texture(u_velocity, uv - vec2(0.0, u_texel.y)).y;
  if (uv.x - u_texel.x < 0.0) l = -c.x;
  if (uv.x + u_texel.x > 1.0) r = -c.x;
  if (uv.y + u_texel.y > 1.0) t = -c.y;
  if (uv.y - u_texel.y < 0.0) b = -c.y;
  o = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}
`

const SCALE = `
uniform sampler2D u_source;
uniform float u_value;
void main() { o = u_value * texture(u_source, uv); }
`

const PRESSURE = `
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform vec2 u_texel;
void main() {
  float l = texture(u_pressure, uv - vec2(u_texel.x, 0.0)).x;
  float r = texture(u_pressure, uv + vec2(u_texel.x, 0.0)).x;
  float t = texture(u_pressure, uv + vec2(0.0, u_texel.y)).x;
  float b = texture(u_pressure, uv - vec2(0.0, u_texel.y)).x;
  float d = texture(u_divergence, uv).x;
  o = vec4((l + r + b + t - d) * 0.25, 0.0, 0.0, 1.0);
}
`

const GRADIENT = `
uniform sampler2D u_pressure;
uniform sampler2D u_velocity;
uniform vec2 u_texel;
void main() {
  float l = texture(u_pressure, uv - vec2(u_texel.x, 0.0)).x;
  float r = texture(u_pressure, uv + vec2(u_texel.x, 0.0)).x;
  float t = texture(u_pressure, uv + vec2(0.0, u_texel.y)).x;
  float b = texture(u_pressure, uv - vec2(0.0, u_texel.y)).x;
  vec2 v = texture(u_velocity, uv).xy - vec2(r - l, t - b);
  o = vec4(v, 0.0, 1.0);
}
`

const DISPLAY = `
uniform sampler2D u_dye;
uniform vec2 u_dyeTexel;
void main() {
  float d = texture(u_dye, uv).x;
  // Light the smoke from one side: its density gradient is a surface normal.
  float dx = texture(u_dye, uv + vec2(u_dyeTexel.x, 0.0)).x - texture(u_dye, uv - vec2(u_dyeTexel.x, 0.0)).x;
  float dy = texture(u_dye, uv + vec2(0.0, u_dyeTexel.y)).x - texture(u_dye, uv - vec2(0.0, u_dyeTexel.y)).x;
  vec3 n = normalize(vec3(-dx * 3.0, -dy * 3.0, 1.0));
  float lit = clamp(dot(n, normalize(u_light + vec3(0.0, 0.0, 0.6))), 0.0, 1.0);
  float body = smoothstep(0.0, 1.1, d);
  if (u_mode < 0.5) {
    vec3 color = mix(u_color2, u_color1, smoothstep(0.35, 1.2, d) * 0.6 + lit * 0.4);
    o = emit(color, body * (0.55 + 0.45 * lit));
  } else {
    vec3 ink = mix(u_accent, vec3(0.12), 0.45);
    o = emit(mix(vec3(1.0), ink, 0.85), body * (0.75 + 0.25 * (1.0 - lit)));
  }
}
`

export const ink = {
  name: "Ink",
  defaults: { fps: 60, maxPixels: 1_200_000 },
  init(ctx) {
    const s = (ctx.state = { rng: seeded(ctx.opts.seed), nextAmbient: 0.6 })
    s.programs = {
      advect: ctx.program(ADVECT),
      splat: ctx.program(SPLAT),
      curl: ctx.program(CURL),
      vorticity: ctx.program(VORTICITY),
      divergence: ctx.program(DIVERGENCE),
      scale: ctx.program(SCALE),
      pressure: ctx.program(PRESSURE),
      gradient: ctx.program(GRADIENT),
      display: ctx.program(DISPLAY),
    }
    this.allocate(ctx)
    // Start with something to look at: a few soft plumes.
    for (let i = 0; i < 5; i++) this.ambient(ctx, 0.9)
  },
  allocate(ctx) {
    const s = ctx.state
    const size = (short) => {
      const a = ctx.aspect
      return a >= 1 ? [Math.round(short * a), short] : [short, Math.round(short / a)]
    }
    const [vw, vh] = size(128)
    const [dw, dh] = size(420)
    for (const t of ["velocity", "dye", "pressure"]) s[t]?.dispose()
    for (const t of ["divergence", "curl"]) s[t]?.dispose()
    s.velocity = ctx.pingpong(vw, vh)
    s.pressure = ctx.pingpong(vw, vh)
    s.dye = ctx.pingpong(dw, dh)
    s.divergence = ctx.target(vw, vh)
    s.curl = ctx.target(vw, vh)
  },
  resize(ctx) {
    this.allocate(ctx)
    for (let i = 0; i < 4; i++) this.ambient(ctx, 0.9)
  },
  splat(ctx, x, y, fx, fy, amount, radius = 0.0028) {
    const s = ctx.state
    const { draw } = ctx
    draw(s.programs.splat, s.velocity.write, { u_target: s.velocity.read, u_point: [x, y], u_value: [fx, fy, 0], u_radius: radius, u_aspect: ctx.aspect })
    s.velocity.swap()
    draw(s.programs.splat, s.dye.write, { u_target: s.dye.read, u_point: [x, y], u_value: [amount, 0, 0], u_radius: radius * 1.4, u_aspect: ctx.aspect })
    s.dye.swap()
  },
  /** A slow plume entering from near an edge: the current that keeps it alive. */
  ambient(ctx, amount = 0.45) {
    const r = ctx.state.rng
    const side = Math.floor(r() * 4)
    const t = 0.15 + r() * 0.7
    const [x, y] = [[t, 0.04], [0.96, t], [t, 0.96], [0.04, t]][side]
    const angle = Math.atan2(0.5 - y, 0.5 - x) + (r() - 0.5) * 1.2
    const force = 260 + r() * 260
    this.splat(ctx, x, y, Math.cos(angle) * force, Math.sin(angle) * force, amount, 0.006)
  },
  step(ctx) {
    const s = ctx.state
    const p = s.programs
    const { draw, pointer } = ctx
    const dt = Math.min(ctx.dt, 1 / 30)
    if (pointer.moved && pointer.inside) {
      this.splat(ctx, pointer.x, pointer.y, pointer.dx * 6000 * ctx.aspect, pointer.dy * 6000, 0.55)
    }
    for (const c of pointer.clicks) {
      for (let i = 0; i < 3; i++) {
        const a = s.rng() * Math.PI * 2
        this.splat(ctx, c.x, c.y, Math.cos(a) * 900, Math.sin(a) * 900, 0.7, 0.004)
      }
    }
    if (ctx.time > s.nextAmbient) {
      this.ambient(ctx)
      s.nextAmbient = ctx.time + 2.6 + s.rng() * 1.6
    }
    const vt = s.velocity.read.texel
    draw(p.curl, s.curl, { u_velocity: s.velocity.read, u_texel: vt })
    draw(p.vorticity, s.velocity.write, { u_velocity: s.velocity.read, u_curl: s.curl, u_texel: vt, u_strength: 15, u_dt: dt })
    s.velocity.swap()
    draw(p.divergence, s.divergence, { u_velocity: s.velocity.read, u_texel: vt })
    draw(p.scale, s.pressure.write, { u_source: s.pressure.read, u_value: 0.8 })
    s.pressure.swap()
    for (let i = 0; i < 20; i++) {
      draw(p.pressure, s.pressure.write, { u_pressure: s.pressure.read, u_divergence: s.divergence, u_texel: vt })
      s.pressure.swap()
    }
    draw(p.gradient, s.velocity.write, { u_pressure: s.pressure.read, u_velocity: s.velocity.read, u_texel: vt })
    s.velocity.swap()
    draw(p.advect, s.velocity.write, { u_velocity: s.velocity.read, u_source: s.velocity.read, u_texel: vt, u_dt: dt, u_dissipation: 0.25 })
    s.velocity.swap()
    draw(p.advect, s.dye.write, { u_velocity: s.velocity.read, u_source: s.dye.read, u_texel: vt, u_dt: dt, u_dissipation: 0.32 })
    s.dye.swap()
  },
  still(ctx) {
    for (let i = 0; i < 90; i++) {
      ctx.dt = 1 / 60
      ctx.time += 1 / 60
      this.step(ctx)
    }
  },
  render(ctx) {
    const s = ctx.state
    ctx.gl.clearColor(0, 0, 0, 0)
    ctx.draw(s.programs.display, null, { u_dye: s.dye.read, u_dyeTexel: s.dye.read.texel })
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
