// Stir: a shaft of light through haze, with dust hanging in it, and the air
// answers you. Moving the pointer leaves a wake of small vortices that swirl
// both the haze and the dust, then die away; the dust glints as it turns
// and is only visible where it crosses the light. The motes, reborn: the
// point is the air, not the specks.

const HAZE = `
uniform vec4 u_vortices[12];
uniform float u_aspect;

float beam(vec2 p) {
  vec2 source = vec2(0.8 * u_aspect, 1.12);
  vec2 dir = normalize(vec2(-0.36, -1.0));
  vec2 d = p - source;
  float along = dot(d, dir);
  float across = abs(d.x * dir.y - d.y * dir.x);
  float width = 0.1 + along * 0.2;
  return exp(-(across * across) / (2.0 * width * width)) * smoothstep(-0.1, 0.25, along) * smoothstep(1.9, 0.6, along);
}

void main() {
  vec2 p = vec2(uv.x * u_aspect, uv.y);
  // The haze is carried by the same vortices that carry the dust.
  vec2 swirl = vec2(0.0);
  for (int i = 0; i < 12; i++) {
    vec4 v = u_vortices[i];
    if (v.z == 0.0) continue;
    vec2 q = p - vec2(v.x * u_aspect, v.y);
    float r2 = dot(q, q) + v.w * v.w;
    swirl += v.z * vec2(-q.y, q.x) / r2 * exp(-dot(q, q) / (v.w * v.w * 9.0));
  }
  vec2 drift = vec2(u_time * 0.018, -u_time * 0.01);
  float haze = fbm(p * 2.2 + drift - swirl * 0.35) * 0.7 + fbm(p * 5.0 - drift * 1.7 - swirl * 0.6) * 0.3;
  float b = beam(p);
  float lit = b * (0.35 + 0.65 * smoothstep(0.35, 0.8, haze));
  if (u_mode < 0.5) {
    o = emit(mix(u_color2, u_color1, lit), lit * 0.38);
  } else {
    // In the light, the room outside the shaft is in soft shade.
    o = emit(u_color2, (1.0 - b) * 0.18 + (1.0 - haze) * b * 0.06);
  }
}
`

const DUST_VERTEX = `#version 300 es
precision highp float;
in vec4 a_mote;
uniform float u_aspect;
uniform float u_scale;
out float v_glint;
out float v_depth;
void main() {
  v_glint = a_mote.w;
  v_depth = a_mote.z;
  gl_Position = vec4(a_mote.x * 2.0 - 1.0, a_mote.y * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = (1.4 + a_mote.z * a_mote.z * 6.0) * u_scale;
}
`

const DUST_FRAGMENT = `#version 300 es
precision highp float;
in float v_glint;
in float v_depth;
out vec4 o;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_mode;
uniform float u_intensity;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float soft = smoothstep(1.0, 0.0, d);
  soft *= soft;
  float a = clamp(soft * v_glint * u_intensity, 0.0, 1.0);
  vec3 c = u_mode < 0.5 ? u_color1 : u_color2 * 0.7;
  o = vec4(c * a, a);
}
`

export const stir = {
  name: "Stir",
  defaults: { fps: 60, dpr: 1.5, maxPixels: 1_400_000 },
  init(ctx) {
    const { gl } = ctx
    const rng = seeded(ctx.opts.seed)
    const count = 1400
    const motes = new Float32Array(count * 4)
    const meta = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      motes[i * 4] = rng()
      motes[i * 4 + 1] = rng()
      motes[i * 4 + 2] = rng()
      meta[i * 3] = rng() * Math.PI * 2
      meta[i * 3 + 1] = 0.5 + rng() * 2
      meta[i * 3 + 2] = rng()
    }
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, motes, gl.DYNAMIC_DRAW)
    const dust = ctx.program(DUST_FRAGMENT, DUST_VERTEX)
    const loc = gl.getAttribLocation(dust.handle, "a_mote")
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    ctx.state = {
      haze: ctx.program(HAZE),
      dust,
      vao,
      buffer,
      motes,
      meta,
      count,
      vortices: [],
      sign: 1,
      travel: 0,
      rng,
    }
  },
  /** The beam, the same shape as in the shader, for lighting the dust. */
  beam(ctx, x, y) {
    const a = ctx.aspect
    const px = x * a
    const dx = px - 0.8 * a
    const dy = y - 1.12
    const len = Math.hypot(-0.36, -1)
    const ux = -0.36 / len
    const uy = -1 / len
    const along = dx * ux + dy * uy
    const across = Math.abs(dx * uy - dy * ux)
    const width = 0.1 + along * 0.2
    const smooth = (e0, e1, v) => {
      const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)))
      return t * t * (3 - 2 * t)
    }
    return Math.exp(-(across * across) / (2 * width * width)) * smooth(-0.1, 0.25, along) * smooth(1.9, 0.6, along)
  },
  step(ctx) {
    const s = ctx.state
    const { pointer } = ctx
    const dt = Math.min(ctx.dt, 1 / 30)
    const a = ctx.aspect
    // The wake: vortices shed along the pointer's path, alternating in turn.
    if (pointer.moved && pointer.inside) {
      const speed = Math.hypot(pointer.dx * a, pointer.dy) / Math.max(dt, 1 / 120)
      s.travel += Math.hypot(pointer.dx * a, pointer.dy)
      if (s.travel > 0.035 && speed > 0.05) {
        s.travel = 0
        s.sign *= -1
        s.vortices.push({ x: pointer.x, y: pointer.y, strength: s.sign * Math.min(0.02, speed * 0.004), radius: 0.05, age: 0 })
        if (s.vortices.length > 12) s.vortices.shift()
      }
    }
    for (const v of s.vortices) v.age += dt
    s.vortices = s.vortices.filter((v) => v.age < 3.5)
    const t = ctx.time
    for (let i = 0; i < s.count; i++) {
      const o = i * 4
      let x = s.motes[o]
      let y = s.motes[o + 1]
      const depth = s.motes[o + 2]
      // The room's slow air: a gentle, changing drift.
      let vx = 0.004 * Math.sin(y * 5.1 + t * 0.21 + depth * 3) + 0.002
      let vy = 0.004 * Math.cos(x * 4.3 - t * 0.17) + 0.0015
      for (const v of s.vortices) {
        const qx = (x - v.x) * a
        const qy = y - v.y
        const r2 = qx * qx + qy * qy + v.radius * v.radius
        const life = Math.exp(-v.age * 1.1) * Math.exp(-(qx * qx + qy * qy) / (v.radius * v.radius * 9))
        vx += (v.strength * -qy / r2) * life / a
        vy += (v.strength * qx / r2) * life
      }
      const parallax = 0.5 + depth
      x += vx * dt * 10 * parallax
      y += vy * dt * 10 * parallax
      if (x < -0.02) x += 1.04
      if (x > 1.02) x -= 1.04
      if (y < -0.02) y += 1.04
      if (y > 1.02) y -= 1.04
      s.motes[o] = x
      s.motes[o + 1] = y
      const m = i * 3
      const glint = 0.3 + 0.7 * Math.max(0, Math.sin(s.meta[m] + t * s.meta[m + 1])) ** 3
      s.motes[o + 3] = this.beam(ctx, x, y) * glint * (0.45 + depth * 0.9)
    }
  },
  render(ctx) {
    const s = ctx.state
    const { gl } = ctx
    const flat = new Float32Array(48)
    s.vortices.slice(-12).forEach((v, i) => {
      flat.set([v.x, v.y, v.strength * Math.exp(-v.age * 1.1), v.radius], i * 4)
    })
    gl.clearColor(0, 0, 0, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.clear(gl.COLOR_BUFFER_BIT)
    ctx.draw(s.haze, null, { u_vortices: flat, u_aspect: ctx.aspect })
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    s.dust.use({ u_aspect: ctx.aspect, u_scale: ctx.width / Math.max(1, ctx.canvas.clientWidth) })
    gl.bindVertexArray(s.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, s.buffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.motes)
    gl.drawArrays(gl.POINTS, 0, s.count)
    gl.bindVertexArray(null)
    gl.disable(gl.BLEND)
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
