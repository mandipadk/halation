// A small WebGL2 kit for the simulated phenomena (fluid, waves, growth,
// fibers, relief): float render targets, ping-pong buffers, full-screen
// passes and pointer tracking. Each phenomenon gets the same guarantees as
// the light atmospheres: a render budget, no work off screen or in a hidden
// tab, stillness for reduced motion, an optional settle, and a light-mode
// treatment (multiplied shade instead of emitted light).

const VERTEX = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }
`

/** Declarations and helpers every simulation shader starts with. */
export const HEADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 o;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_accent;
uniform float u_intensity;
uniform float u_mode;
uniform float u_seed;
uniform vec4 u_quiet;
uniform float u_quietness;
uniform vec3 u_light;

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
float quiet() {
  if (u_quiet.z <= 0.0) return 1.0;
  float d = length((gl_FragCoord.xy / u_resolution - u_quiet.xy) / u_quiet.zw);
  return 1.0 - u_quietness * (1.0 - smoothstep(0.55, 1.25, d));
}
// Premultiplied: light on dark grounds, shade (multiplied) on light ones.
vec4 emit(vec3 color, float amount) {
  float a = clamp(amount * u_intensity * quiet(), 0.0, 1.0);
  return vec4(color * a, a);
}
`

export function channels(hex) {
  const h = hex.length === 4 ? [...hex.slice(1)].map((x) => x + x).join("") : hex.slice(1, 7)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}

/**
 * Mounts a simulated phenomenon into `host`.
 * `def`: { defaults?, init(ctx), resize?(ctx), step?(ctx), render(ctx), still?(ctx) }
 * Options: color1, color2, accent (hex), mode, intensity, speed, seed, quiet,
 * quietness, settleAfter, fps, maxPixels, dpr, light ({ azimuth, elevation }
 * in radians: where the light comes from), interactive.
 */
export function mountSim(host, def, options = {}) {
  const opts = {
    color1: "#fff3ec",
    color2: "#ffb89e",
    accent: "#ff6b3d",
    mode: "dark",
    intensity: 1,
    speed: 1,
    seed: 7,
    quietness: 0.6,
    settleAfter: 0,
    fps: 60,
    maxPixels: 1_400_000,
    dpr: 1.5,
    light: { azimuth: 2.3, elevation: 0.5 },
    interactive: true,
    ...def.defaults,
    ...options,
  }
  const canvas = document.createElement("canvas")
  canvas.setAttribute("aria-hidden", "true")
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" })
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: !!opts.antialias, powerPreference: "high-performance" })
  if (!gl) return { update() {}, wake() {}, destroy() {}, supported: false }
  const floatOk = !!gl.getExtension("EXT_color_buffer_float")
  gl.getExtension("OES_texture_float_linear")
  host.appendChild(canvas)

  const quad = gl.createVertexArray()
  gl.bindVertexArray(quad)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const compile = (type, source) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, source)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`${def.name ?? "sim"}: ${gl.getShaderInfoLog(s)}`)
    return s
  }

  /** A full-screen program. `source` is the body after HEADER. */
  const program = (source, vertex = VERTEX) => {
    const p = gl.createProgram()
    gl.bindAttribLocation(p, 0, "p")
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vertex))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, vertex === VERTEX ? HEADER + source : source))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link failed")
    const locations = new Map()
    const loc = (name) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(p, name))
      return locations.get(name)
    }
    return {
      handle: p,
      use(uniforms = {}) {
        gl.useProgram(p)
        let unit = 0
        for (const [name, value] of Object.entries({ ...shared(), ...uniforms })) {
          const l = loc(name)
          if (l === null || value === undefined) continue
          if (value && value.tex) {
            gl.activeTexture(gl.TEXTURE0 + unit)
            gl.bindTexture(gl.TEXTURE_2D, value.tex)
            gl.uniform1i(l, unit++)
          } else if (typeof value === "number") gl.uniform1f(l, value)
          else if (value.length === 2) gl.uniform2fv(l, value)
          else if (value.length === 3) gl.uniform3fv(l, value)
          else if (value.length === 4 || value.length % 4 === 0) gl.uniform4fv(l, value)
          else gl.uniform1fv(l, value)
        }
      },
    }
  }

  /** A render target; half-float where the GPU allows, 8-bit otherwise. */
  const target = (w, h, { filter = "linear", wrap = "clamp", float = true } = {}) => {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    const f = filter === "linear" ? gl.LINEAR : gl.NEAREST
    const r = wrap === "repeat" ? gl.REPEAT : gl.CLAMP_TO_EDGE
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, r)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, r)
    const useFloat = float && floatOk
    gl.texImage2D(gl.TEXTURE_2D, 0, useFloat ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, useFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return { tex, fbo, w, h, texel: [1 / w, 1 / h], dispose() { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo) } }
  }
  const pingpong = (w, h, o) => {
    const pair = { read: target(w, h, o), write: target(w, h, o) }
    pair.swap = () => ([pair.read, pair.write] = [pair.write, pair.read])
    pair.dispose = () => { pair.read.dispose(); pair.write.dispose() }
    return pair
  }
  /** Uploads a 2D canvas (or image) as a texture. */
  const texture = (source, { filter = "linear" } = {}) => {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    const f = filter === "linear" ? gl.LINEAR : gl.NEAREST
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return { tex, dispose() { gl.deleteTexture(tex) } }
  }
  const draw = (prog, dest, uniforms) => {
    prog.use(uniforms)
    if (dest) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dest.fbo)
      gl.viewport(0, 0, dest.w, dest.h)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    gl.bindVertexArray(quad)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)")
  const pointer = { x: 0.5, y: 0.5, dx: 0, dy: 0, inside: false, moved: false, down: false, clicks: [] }
  const ctx = {
    gl, canvas, opts, draw, program, target, pingpong, texture, pointer,
    width: 0, height: 0, time: 0, dt: 1 / 60, floatOk,
    get reduced() { return reduce.matches },
    get aspect() { return ctx.width / Math.max(1, ctx.height) },
  }
  const shared = () => {
    const q = opts.quiet
    const light = opts.light
    return {
      u_resolution: [canvas.width, canvas.height],
      u_time: ctx.time,
      u_color1: channels(opts.color1),
      u_color2: channels(opts.color2),
      u_accent: channels(opts.accent),
      u_intensity: opts.intensity,
      u_mode: opts.mode === "light" ? 1 : 0,
      u_seed: opts.seed,
      u_quiet: q ? [q.x, 1 - q.y, q.rx, q.ry] : [0, 0, 0, 0],
      u_quietness: opts.quietness,
      u_light: [Math.cos(light.azimuth) * Math.cos(light.elevation), Math.sin(light.azimuth) * Math.cos(light.elevation), Math.sin(light.elevation)],
    }
  }

  let visible = false
  let frame = 0
  let last = 0
  let started = 0
  let lastDraw = 0
  let dirty = true
  let initialized = false
  let lastTouch = -1e9

  const resize = () => {
    const rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const dpr = Math.min(opts.dpr, devicePixelRatio || 1)
    const scale = Math.min(dpr, Math.sqrt(opts.maxPixels / (rect.width * rect.height)))
    canvas.width = Math.max(1, Math.round(rect.width * scale))
    canvas.height = Math.max(1, Math.round(rect.height * scale))
    ctx.width = canvas.width
    ctx.height = canvas.height
    if (!initialized) {
      def.init(ctx)
      initialized = true
      if (reduce.matches) def.still?.(ctx)
    } else def.resize?.(ctx)
    dirty = true
  }

  const onMove = (e) => {
    const rect = host.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = 1 - (e.clientY - rect.top) / rect.height
    const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1
    if (inside && pointer.inside) {
      pointer.dx += x - pointer.x
      pointer.dy += y - pointer.y
      pointer.moved = true
    }
    pointer.x = x
    pointer.y = y
    pointer.inside = inside
  }
  const onDown = (e) => {
    onMove(e)
    if (pointer.inside) {
      pointer.down = true
      pointer.clicks.push({ x: pointer.x, y: pointer.y })
    }
  }
  const onUp = () => (pointer.down = false)
  if (opts.interactive) {
    addEventListener("pointermove", onMove, { passive: true })
    addEventListener("pointerdown", onDown, { passive: true })
    addEventListener("pointerup", onUp, { passive: true })
  }

  const pace = (now) => {
    if (!opts.settleAfter) return 1
    const t = (now - started) / 1000 - opts.settleAfter
    return t <= 0 ? 1 : (1 - Math.min(1, t / 4)) ** 3
  }

  const tick = (now) => {
    frame = requestAnimationFrame(tick)
    if (!visible || document.hidden || !initialized) {
      last = now
      return
    }
    if (!started) started = now
    if (now - lastDraw < 1000 / opts.fps - 2 && !dirty) return
    const delta = last ? Math.min(50, now - last) / 1000 : 1 / 60
    last = now
    lastDraw = now
    const speed = pace(now) * opts.speed
    const interacting = pointer.moved || pointer.clicks.length > 0
    if (interacting) lastTouch = now
    // After a touch the simulation keeps running a while, so a stirred
    // fluid finishes its swirl even once the page has settled.
    const settling = now - lastTouch < 6000
    let stepped = false
    if (!reduce.matches && (speed > 0 || settling)) {
      const rate = Math.max(speed, settling ? 1 : 0)
      ctx.dt = delta * rate
      ctx.time += delta * rate
      def.step?.(ctx)
      stepped = true
    }
    pointer.dx = 0
    pointer.dy = 0
    pointer.moved = false
    pointer.clicks.length = 0
    if (!stepped && !dirty) return
    def.render(ctx)
    dirty = false
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    dirty = true
  }, { rootMargin: "120px" })
  visibility.observe(host)
  const setBlend = () => (canvas.style.mixBlendMode = !def.opaque && opts.mode === "light" ? "multiply" : "normal")
  setBlend()
  resize()
  frame = requestAnimationFrame(tick)

  return {
    supported: true,
    ctx,
    update(next) {
      Object.assign(opts, next)
      setBlend()
      def.update?.(ctx, next)
      dirty = true
    },
    wake() {
      started = 0
    },
    destroy() {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibility.disconnect()
      removeEventListener("pointermove", onMove)
      removeEventListener("pointerdown", onDown)
      removeEventListener("pointerup", onUp)
      gl.getExtension("WEBGL_lose_context")?.loseContext()
      canvas.remove()
    },
  }
}
