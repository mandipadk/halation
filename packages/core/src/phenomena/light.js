// The shader atmospheres. Each one is a real light phenomenon, drawn slowly
// and quietly behind content. Colors come from the accent: color1 is the
// near-white core of the light, color2 the tinted edge (in light mode, the
// shade).

/** Crepuscular rays: beams from a source above the frame (the Parallex look). */
export const rays = {
  name: "Rays",
  defaults: { speed: 0.8, intensity: 1 },
  uniforms(set, { width, height, opts }) {
    const position = opts.position ?? 50
    set("u_rayPos1", [(position / 100) * width, -0.4 * height])
    set("u_rayPos2", [(position / 100 + 0.02) * width, -0.5 * height])
    set("u_reach", ((opts.reach ?? 6) / 100) * 0.5)
    set("u_rays", 0.096)
    set("u_strength", ((opts.strength ?? 12) / 100) * 0.5)
  },
  fragment: `
uniform vec2 u_rayPos1;
uniform vec2 u_rayPos2;
uniform float u_reach;
uniform float u_rays;
uniform float u_strength;

float rayStrength(vec2 source, vec2 dir, vec2 coord, float seedA, float seedB, float speed) {
  vec2 toCoord = coord - source;
  float cosAngle = dot(normalize(toCoord), dir);
  float diagonal = length(u_resolution);
  return clamp((0.45 + 0.15 * sin(cosAngle * seedA + u_time * speed)) +
               (0.3 + 0.2 * cos(-cosAngle * seedB + u_time * speed)), u_reach, 1.0) *
         clamp((diagonal - length(toCoord)) / diagonal, u_reach, 1.0);
}

void main() {
  vec2 coord = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  float speed = u_rays * 10.0;
  float s1 = rayStrength(u_rayPos1, normalize(vec2(1.0, -0.116)), coord, 36.2214 * speed, 21.11349 * speed, 1.5 * speed);
  float s2 = rayStrength(u_rayPos2, normalize(vec2(1.0, 0.241)), coord, 22.3991 * speed, 18.0234 * speed, 1.1 * speed);
  float attenuation = clamp(u_reach - coord.y / u_resolution.y + 0.5 + u_strength, 0.0, 1.0);
  float a1 = s1 * attenuation;
  float a2 = s2 * attenuation;
  float alpha = a1 + a2 * (1.0 - a1);
  vec3 rgb = (u_color1 * a1 + u_color2 * a2) / max(alpha, 0.0001);
  if (u_mode < 0.5) {
    emit(rgb, alpha);
  } else {
    emit(u_color2, alpha * 0.55);
  }
}
`,
}

/**
 * Caustics: the net of light on a pool floor. Cell borders of a slowly
 * orbiting Worley field, bent by the water surface, in two layers.
 */
export const caustics = {
  name: "Caustics",
  defaults: { speed: 1, intensity: 1 },
  fragment: `
// The water surface is a sum of waves. Light refracted through it bunches
// up where the surface focuses it: where the mapping from surface to floor
// folds, its Jacobian's determinant approaches zero and the floor is bright.
// Everything here is analytic, so it stays cheap.
float focus(vec2 p, float t, float strength) {
  mat2 hessian = mat2(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float angle = fi * 2.39996 + u_seed;
    vec2 k = vec2(cos(angle), sin(angle)) * (1.3 + 0.42 * fi);
    float amp = 1.0 / (1.0 + fi * 0.55);
    float phase = dot(k, p) + t * (0.55 + 0.12 * fi);
    hessian += -amp * sin(phase) * mat2(k.x * k.x, k.x * k.y, k.x * k.y, k.y * k.y);
  }
  mat2 j = mat2(1.0) + strength * hessian;
  float det = j[0][0] * j[1][1] - j[0][1] * j[1][0];
  return 1.0 / max(abs(det), 0.03);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.y;
  vec2 frame = gl_FragCoord.xy / u_resolution.xy;
  float t = u_time * 0.6;
  vec2 p = uv * 7.5;
  float c = focus(p, t, 0.34);
  // Map focus to brightness: most of the floor stays dim, the filaments glow.
  float lines = smoothstep(3.0, 14.0, c);
  float glow = smoothstep(1.3, 3.5, c) * 0.16;
  float patch = smoothstep(0.25, 0.75, fbm(uv * 0.8 + t * 0.025 + u_seed));
  float depth = mix(0.35, 1.0, smoothstep(0.0, 0.9, frame.y));
  float edge = smoothstep(0.0, 0.3, min(frame.x, 1.0 - frame.x) + 0.1);
  float m = (lines + glow) * mix(0.35, 1.0, patch) * depth * edge;
  if (u_mode < 0.5) {
    emit(mix(u_color2, u_color1, lines), m * 0.7);
  } else {
    emit(u_color2, (0.45 - 0.45 * clamp(lines + glow, 0.0, 1.0)) * mix(0.3, 1.0, patch) * depth * edge);
  }
}
`,
}

/**
 * Blinds: afternoon light through a window with blinds, thrown across the
 * wall. The sun drifts, the penumbra widens with distance from the window,
 * and now and then a cloud passes. In light mode, the slats' shadows.
 */
export const blinds = {
  name: "Blinds",
  defaults: { speed: 1, intensity: 1 },
  uniforms(set, { opts }) {
    set("u_angle", opts.sunAngle ?? 0.55)
    set("u_shear", opts.shear ?? 0.38)
  },
  fragment: `
uniform float u_angle;
uniform float u_shear;
void main() {
  vec2 frame = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(frame.x * aspect, frame.y);
  float t = u_time;
  float sun = 0.04 * sin(t * 0.05 + u_seed);
  // The patch of window light on the wall: tilted and sheared, as a low sun throws it.
  // The patch lands opposite the sun: morning light on the right wall.
  vec2 center = vec2(aspect * (0.9 - u_angle * 0.5) + sun, 0.5);
  vec2 d = rot(u_angle + sun) * (p - center);
  d.x += d.y * u_shear;
  // Softer the further the light has travelled (from the window, top right).
  float travel = clamp(distance(frame, vec2(1.05, 1.1)), 0.0, 1.6);
  float pen = 0.006 + 0.03 * travel;
  float w = 0.36 * max(aspect, 1.0) * 0.9;
  float h = 0.58;
  float pane = smoothstep(w, w - pen * 5.0, abs(d.x)) * smoothstep(h, h - pen * 5.0, abs(d.y));
  float count = 10.0;
  float s = fract((d.y + h) * count / (2.0 * h));
  float slat = smoothstep(0.38 - pen * 6.0, 0.38 + pen * 6.0, s) * smoothstep(1.0 + pen * 6.0, 1.0 - pen * 6.0, s);
  float mullion = 1.0 - (1.0 - smoothstep(0.0, 0.012 + pen * 2.5, abs(d.x))) * 0.9;
  float cloud = 0.6 + 0.4 * smoothstep(0.25, 0.75, vnoise(vec2(t * 0.06, u_seed * 3.0)));
  float light = pane * slat * mullion;
  if (u_mode < 0.5) {
    emit(mix(u_color2, u_color1, 0.75), light * cloud * 0.55);
  } else {
    emit(u_color2, pane * (1.0 - slat * mullion) * cloud * 0.6);
  }
}
`,
}
