// Silk: a satin drape, slowly moving. The threads stay parallel; the shine
// comes from folds turning the cloth toward and away from the light, lit
// with the fiber model (Kajiya-Kay): light reflects across a thread, never
// along it. The pointer moves the light, and presses a soft fold into the
// cloth where it rests.

const DRAPE = `
uniform vec3 u_pointer;
uniform float u_aspect;

// The fold of the cloth: height and its gradient, both analytic.
vec3 fold(vec2 p, float t) {
  float h = 0.0;
  vec2 g = vec2(0.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float angle = 1.9 + fi * 0.35 + 0.25 * sin(u_seed + fi * 1.7);
    vec2 k = vec2(cos(angle), sin(angle)) * (1.4 + fi * 0.9);
    float amp = 0.34 / (1.0 + fi * 0.9);
    float phase = dot(k, p) + t * (0.12 + fi * 0.03) + fi * 2.1 + u_seed;
    h += amp * sin(phase);
    g += amp * cos(phase) * k;
  }
  // The pointer presses a soft dimple.
  vec2 q = p - vec2(u_pointer.x * u_aspect, u_pointer.y) * 1.6;
  float r2 = dot(q, q);
  float dimple = -0.22 * u_pointer.z * exp(-r2 / 0.05);
  h += dimple;
  g += dimple * (-2.0 * q / 0.05);
  return vec3(h, g);
}

void main() {
  vec2 p = vec2(uv.x * u_aspect, uv.y) * 1.6;
  vec3 f = fold(p, u_time);
  vec3 n = normalize(vec3(-f.y * 0.55, -f.z * 0.55, 1.0));
  // Threads run across the folds, following the surface.
  vec2 along = normalize(vec2(0.82, -0.57));
  vec3 thread = normalize(vec3(along, dot(along, f.yz) * 1.4));
  vec3 l = normalize(u_light);
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float th = dot(thread, h);
  float primary = pow(sqrt(max(0.0, 1.0 - th * th)), 420.0);
  // Satin's second lobe: softer, wider, shifted along the thread.
  float th2 = dot(thread, normalize(h + thread * 0.12));
  float secondary = pow(sqrt(max(0.0, 1.0 - th2 * th2)), 60.0) * 0.22;
  float diffuse = clamp(dot(n, l) * 0.5 + 0.5, 0.0, 1.0);
  // The weave: a fine striation across the threads, barely there.
  vec2 across = vec2(-along.y, along.x);
  float phase = dot(p, across) * 620.0 + vnoise(p * 40.0) * 6.0;
  float fine = clamp(1.0 - fwidth(phase) * 0.25, 0.0, 1.0);
  float weave = 1.0 - 0.06 * fine * (0.5 + 0.5 * sin(phase));
  float shine = (primary * 0.95 + secondary) * weave;
  if (u_mode < 0.5) {
    vec3 color = mix(u_color2, u_color1, clamp(primary * 1.2, 0.0, 1.0));
    o = emit(color, diffuse * diffuse * 0.14 + shine * 0.75);
  } else {
    // In the light, the folds show as soft shade and the sheen stays bright.
    // Multiply can't brighten, so the cloth carries a little shade everywhere,
    // deeper in the folds, lifted where the sheen falls.
    float shade = clamp(0.2 + (1.0 - diffuse) * 1.15 - clamp(shine, 0.0, 1.0) * 0.35, 0.0, 1.0);
    o = emit(u_color2, shade * 0.9);
  }
}
`

export const silk = {
  name: "Silk",
  defaults: { fps: 60, dpr: 1.5, maxPixels: 1_600_000 },
  init(ctx) {
    ctx.state = { program: ctx.program(DRAPE), light: ctx.opts.light.azimuth, lift: ctx.opts.light.elevation, px: 0.5, py: 0.5, press: 0 }
  },
  step(ctx) {
    const s = ctx.state
    const { pointer } = ctx
    // The light follows the pointer, eased like a hand tilting the cloth.
    const azimuth = pointer.inside ? ctx.opts.light.azimuth + (pointer.x - 0.5) * 2.2 : ctx.opts.light.azimuth
    const elevation = pointer.inside ? Math.max(0.15, ctx.opts.light.elevation + (pointer.y - 0.5) * 0.7) : ctx.opts.light.elevation
    const k = Math.min(1, ctx.dt * 2.5)
    s.light += (azimuth - s.light) * k
    s.lift += (elevation - s.lift) * k
    s.px += (pointer.x - s.px) * Math.min(1, ctx.dt * 5)
    s.py += (pointer.y - s.py) * Math.min(1, ctx.dt * 5)
    s.press += ((pointer.inside ? 1 : 0) - s.press) * Math.min(1, ctx.dt * 2)
  },
  render(ctx) {
    const s = ctx.state
    ctx.draw(s.program, null, {
      u_light: [Math.cos(s.light) * Math.cos(s.lift), Math.sin(s.light) * Math.cos(s.lift), Math.sin(s.lift)],
      u_pointer: [s.px, s.py, s.press],
      u_aspect: ctx.aspect,
    })
  },
}
