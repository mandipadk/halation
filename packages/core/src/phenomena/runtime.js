// The atmosphere runtime: one full-screen fragment shader behind content.
// Every atmosphere gets the same guarantees from here: a pixel budget and a
// 30 fps cap (the effects are soft and slow, so more buys nothing), no work
// while off screen or in a hidden tab, one still frame when motion is
// reduced, an optional settle to stillness, and a light-mode treatment:
// on dark grounds a shader emits light; on light grounds it emits shade,
// composited with multiply. "In the dark you see the light; in the light,
// its shadows."

const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

/** Uniforms and helpers every atmosphere shader can use. */
export const COMMON = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_intensity;
uniform float u_mode;
uniform float u_seed;
uniform vec4 u_quiet;
uniform float u_quietness;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash22(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }
// Premultiplied output. On dark grounds \`color\` is light; on light grounds
// it is the shade that multiply darkens the page with.
// Light never competes with words: inside the quiet zone (an ellipse around
// the content, in frame units: center xy, radius zw) the effect dims.
float quiet() {
  if (u_quiet.z <= 0.0) return 1.0;
  vec2 frame = gl_FragCoord.xy / u_resolution.xy;
  float d = length((frame - u_quiet.xy) / u_quiet.zw);
  return 1.0 - u_quietness * (1.0 - smoothstep(0.55, 1.25, d));
}
void emit(vec3 color, float amount) {
  float a = clamp(amount * u_intensity * quiet(), 0.0, 1.0);
  gl_FragColor = vec4(color * a, a);
}
`

/** "#rrggbb" to 0–1 channels. */
export function channels(hex) {
  const h = hex.length === 4 ? [...hex.slice(1)].map((x) => x + x).join("") : hex.slice(1, 7)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}

/**
 * Mounts an atmosphere into `host` (a positioned element; the canvas fills it).
 * `def` is { fragment, defaults?, uniforms?(set, context) }.
 * Options: color1, color2 (hex), mode "dark" | "light", intensity (1 = designed),
 * speed (1 = designed), seed, maxPixels, fps, settleAfter (seconds, 0 = never),
 * quiet ({ x, y, rx, ry } in 0–1 of the host, y from the top) and quietness (0–1).
 * Returns { update(options), wake(), destroy() }.
 */
export function mountAtmosphere(host, def, options = {}) {
  const opts = {
    color1: "#fff3ec",
    color2: "#ffb89e",
    mode: "dark",
    intensity: 1,
    speed: 1,
    seed: 0,
    maxPixels: 900_000,
    fps: 30,
    settleAfter: 0,
    ...def.defaults,
    ...options,
  }
  const canvas = document.createElement("canvas")
  canvas.setAttribute("aria-hidden", "true")
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" })
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: "low-power" })
  if (!gl) return { update() {}, wake() {}, destroy() {} }
  host.appendChild(canvas)

  const compile = (type, source) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, source)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader failed")
    return s
  }
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, COMMON + def.fragment))
  gl.linkProgram(program)
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const attribute = gl.getAttribLocation(program, "p")
  gl.enableVertexAttribArray(attribute)
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0)

  const locations = new Map()
  const set = (name, value) => {
    if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name))
    const loc = locations.get(name)
    if (loc === null) return
    if (typeof value === "number") gl.uniform1f(loc, value)
    else if (value.length === 2) gl.uniform2fv(loc, value)
    else if (value.length === 3) gl.uniform3fv(loc, value)
    else gl.uniform4fv(loc, value)
  }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)")
  let time = 20 + (opts.seed % 97) * 3.1
  let width = 0
  let height = 0
  let visible = true
  let dirty = true
  let frame = 0
  let last = 0
  let started = 0
  let lastDraw = 0

  const apply = () => {
    canvas.style.mixBlendMode = opts.mode === "light" ? "multiply" : "normal"
    set("u_color1", channels(opts.color1))
    set("u_color2", channels(opts.color2))
    set("u_intensity", opts.intensity)
    set("u_mode", opts.mode === "light" ? 1 : 0)
    set("u_seed", opts.seed)
    const q = opts.quiet
    set("u_quiet", q ? [q.x, 1 - q.y, q.rx, q.ry] : [0, 0, 0, 0])
    set("u_quietness", opts.quietness ?? 0.65)
    def.uniforms?.(set, { width, height, opts })
    dirty = true
  }

  const resize = () => {
    const rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const scale = Math.min(1, Math.sqrt(opts.maxPixels / (rect.width * rect.height)))
    width = Math.max(1, Math.round(rect.width * scale))
    height = Math.max(1, Math.round(rect.height * scale))
    canvas.width = width
    canvas.height = height
    gl.viewport(0, 0, width, height)
    set("u_resolution", [width, height])
    def.uniforms?.(set, { width, height, opts })
    dirty = true
  }

  // Speed multiplier: 1 until settleAfter, then eases to 0 over 4 s.
  const pace = (now) => {
    if (!opts.settleAfter) return 1
    const t = (now - started) / 1000 - opts.settleAfter
    return t <= 0 ? 1 : (1 - Math.min(1, t / 4)) ** 3
  }

  const tick = (now) => {
    frame = requestAnimationFrame(tick)
    if (!started) started = now
    const delta = last ? Math.min(100, now - last) : 0
    last = now
    const speed = pace(now) * opts.speed
    const moving = !reduce.matches && !document.hidden && visible && speed > 0
    if (moving) time += (delta / 1000) * speed
    if (!visible || (!moving && !dirty)) return
    if (!dirty && now - lastDraw < 1000 / opts.fps - 2) return
    lastDraw = now
    set("u_time", time)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    dirty = false
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) dirty = true
  })
  visibility.observe(host)
  const onReduce = () => (dirty = true)
  reduce.addEventListener("change", onReduce)

  apply()
  resize()
  frame = requestAnimationFrame(tick)

  return {
    update(next) {
      Object.assign(opts, next)
      apply()
    },
    wake() {
      started = 0
    },
    destroy() {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibility.disconnect()
      reduce.removeEventListener("change", onReduce)
      gl.getExtension("WEBGL_lose_context")?.loseContext()
      canvas.remove()
    },
  }
}
