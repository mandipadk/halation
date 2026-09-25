import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { batch, colophon, hash, score, sealParts, sealSvg } from "../src/signature/seal.js"
import { lightAt, lightingFor, tint } from "../src/phenomena/daylight.js"

test("a name always gives the same seal, and different names usually differ", () => {
  assert.equal(sealSvg("Parallex", 32), sealSvg("Parallex", 32))
  assert.equal(hash("Parallex"), hash("  parallex "))
  const names = ["Parallex", "Tally", "Margins", "Shoebox", "Halation", "Field notes"]
  const shapes = new Set(names.map((n) => JSON.stringify(sealParts(n))))
  assert.ok(shapes.size >= names.length - 1)
  for (const n of names) assert.ok(sealParts(n).length >= 1 && sealParts(n).length <= 3)
})

test("the score has one note per slit, within the tempo's scale", () => {
  const notes = score("Parallex", "calm")
  assert.equal(notes.length, sealParts("Parallex").length)
  for (const n of notes) assert.ok(n.frequency >= 200 && n.frequency <= 900)
  assert.ok(score("Parallex", "lively").every((n, i) => n.at <= notes[i].at))
})

test("the colophon is true to its inputs", () => {
  const lines = Object.fromEntries(colophon("Parallex", { light: "Rays", lens: "Editorial", tempo: "Crisp", form: "Soft", stock: "Ink", accent: "Vermilion" }, { rules: 18 }))
  assert.equal(lines.Project, "Parallex")
  assert.equal(lines["Rules kept"], "18 of 18")
  assert.equal(lines["Film batch"], batch("Parallex"))
})

test("the sun rises on the left, is overhead at noon and sets on the right", () => {
  const morning = lightAt(7.5, 268)
  const noon = lightAt(12.2, 268)
  const evening = lightAt(17.3, 268)
  const night = lightAt(23, 268)
  assert.ok(morning.across < 0.2 && evening.across > 0.8)
  assert.ok(Math.abs(noon.across - 0.5) < 0.1)
  assert.ok(noon.elevation > morning.elevation && noon.elevation > evening.elevation)
  assert.equal(night.phase, "night")
  assert.ok(evening.golden > 0.5 && noon.golden < 0.1)
})

test("daylight tints warm at golden hour and silver at night", () => {
  const warm = tint("#ffffff", lightAt(17.6, 268))
  const cool = tint("#ffffff", lightAt(23, 268))
  const [wr, , wb] = [1, 3, 5].map((i) => parseInt(warm.slice(i, i + 2), 16))
  const [cr, , cb] = [1, 3, 5].map((i) => parseInt(cool.slice(i, i + 2), 16))
  assert.ok(wr > wb, "golden hour is warm")
  assert.ok(cb >= cr, "night is cool")
  assert.ok(lightingFor("rays", lightAt(17.6, 268), { color1: "#ffffff", color2: "#ffcccc", mode: "dark" }).position > 80)
})

test("the generated tokens pass the contrast report and cover every role", () => {
  const report = readFileSync(new URL("../contrast.md", import.meta.url), "utf8")
  assert.ok(!report.includes("✗"), "no failing pair in contrast.md")
  const css = readFileSync(new URL("../css/tokens.css", import.meta.url), "utf8")
  for (const role of ["canvas", "fg", "fg-muted", "ink", "on-ink", "accent", "on-accent", "accent-fg", "ring", "light-core", "light-edge", "halation"]) {
    assert.ok(css.includes(`--color-${role}:`), role)
  }
})

test("the rulebook has reasons and alternatives for every rule", () => {
  const rules = JSON.parse(readFileSync(new URL("../rules.json", import.meta.url), "utf8"))
  assert.ok(rules.length >= 18)
  for (const r of rules) assert.ok(r.id && r.says && r.why && r.instead, r.id)
})
