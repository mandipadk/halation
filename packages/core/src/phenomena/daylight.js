// Daylight: a project's light follows the visitor's local time. A real
// solar position (declination and hour angle) from the clock and the date,
// turned into one lighting state every phenomenon reads: where the light
// comes from, how high it is, how warm, how strong. Morning light enters
// from the left, evening light from the right, and at night it becomes a
// dim, silvery moonlight. No location is asked for: it assumes a
// mid-latitude sky, which is right enough for light.

const DEG = Math.PI / 180

/** The sun for a given moment. Hour may be fractional (17.5 = 5:30 pm). */
export function sun(hour, dayOfYear, latitude = 42) {
  const declination = 23.44 * DEG * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365)
  const hourAngle = (hour - 12) * 15 * DEG
  const lat = latitude * DEG
  const elevation = Math.asin(Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle))
  // Compass azimuth from north, clockwise: east 90°, south 180°, west 270°.
  const fromSouth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat))
  const azimuth = fromSouth + Math.PI
  return { elevation, azimuth }
}

const smooth = (e0, e1, v) => {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/**
 * The lighting state for a moment. Returns:
 *   hour, phase ("night" | "dawn" | "morning" | "midday" | "afternoon" | "golden hour" | "dusk"),
 *   across (0 = light from the far left, 1 = the far right), elevation (radians),
 *   day (0 night to 1 full daylight), golden (0 to 1, strongest at low sun),
 *   warmth (-1 cool moonlight to 1 warm sun), light ({ azimuth, elevation } for shaders).
 */
export function daylight(date = new Date(), latitude = 42) {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date - start) / 86_400_000)
  return lightAt(hour, dayOfYear, latitude)
}

export function lightAt(hour, dayOfYear = 180, latitude = 42) {
  const s = sun(hour, dayOfYear, latitude)
  const e = s.elevation / DEG
  const day = smooth(-6, 8, e)
  const golden = smooth(-4, 3, e) * (1 - smooth(8, 22, e))
  const night = 1 - smooth(-10, -2, e)
  // Facing south: east is to the left, west to the right.
  const across = Math.min(1, Math.max(0, (s.azimuth / DEG - 90) / 180))
  const warmth = golden * 0.9 + day * 0.15 - night * 0.6
  const phase =
    night > 0.6 ? "night" : e < 3 && hour < 12 ? "dawn" : e < 3 ? "dusk" : golden > 0.5 ? "golden hour" : hour < 10.5 ? "morning" : hour < 14 ? "midday" : "afternoon"
  // Shader light: azimuth in the screen plane (0 = from the right, π/2 = from above).
  const screenAzimuth = Math.PI * (1 - across) * 0.8 + Math.PI * 0.1
  const lift = Math.max(0.12, Math.min(1.2, (Math.max(e, 0) * DEG) * 1.1 + 0.12))
  return {
    hour,
    phase,
    across: night > 0.6 ? 0.62 : across,
    elevation: s.elevation,
    day,
    golden,
    night,
    warmth,
    light: { azimuth: night > 0.6 ? Math.PI * 0.42 : screenAzimuth, elevation: night > 0.6 ? 0.5 : lift },
  }
}

/** A color tinted by the light: warm toward low sun, silver toward the moon. */
export function tint(hex, state, dim = true) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const warm = [1, 0.8, 0.6]
  const moon = [0.84, 0.88, 0.94]
  const toward = state.warmth >= 0 ? warm : moon
  const k = Math.min(0.55, Math.abs(state.warmth) * 0.5)
  const brightness = dim ? 0.55 + 0.45 * Math.max(state.day, 1 - state.night * 0.7) : 1
  const out = c.map((v, i) => Math.min(1, (v * (1 - k) + v * toward[i] * k * 1.08) * brightness))
  return "#" + out.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")
}

/** How each phenomenon answers the day: overrides for its options. */
export function lightingFor(kind, state, base) {
  const core = tint(base.color1, state)
  const edge = tint(base.color2, state)
  const colors = base.mode === "light" ? { color1: base.color1, color2: base.color2 } : { color1: core, color2: edge }
  switch (kind) {
    case "rays":
      return { ...colors, position: 12 + state.across * 76, strength: 6 + state.golden * 9 + state.day * 4, reach: 4 + state.golden * 5 }
    case "blinds":
      return { ...colors, sunAngle: 0.25 + state.across * 0.6, shear: 0.15 + (1 - Math.min(1, state.elevation * 1.6)) * 0.5, intensity: 0.45 + state.day * 0.55 }
    case "caustics":
      return { ...colors, intensity: 0.35 + state.day * 0.65 }
    case "halation":
      return { glow: 0.8 + state.night * 0.5 + state.golden * 0.2 }
    default:
      return { ...colors, light: state.light }
  }
}
