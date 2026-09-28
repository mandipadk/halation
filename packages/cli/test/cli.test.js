import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { loadRules } from "../src/rules.js"

const BIN = fileURLToPath(new URL("../bin/halation.js", import.meta.url))
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" })

describe("help", () => {
  test("halation --help lists the commands", () => {
    const r = run("--help")
    assert.equal(r.status, 0)
    for (const c of ["lint", "check", "rules", "skill", "init", "guard"]) assert.match(r.stdout, new RegExp(`^ {2}${c}\\b`, "m"))
  })
  test("no command shows help", () => assert.equal(run().status, 0))
  for (const c of ["lint", "check", "rules", "skill", "init", "guard"]) {
    test(`halation ${c} --help`, () => {
      const r = run(c, "--help")
      assert.equal(r.status, 0)
      assert.match(r.stdout, new RegExp(`Usage: halation ${c}`))
    })
  }
  test("an unknown command exits 1 with help", () => {
    const r = run("lnt")
    assert.equal(r.status, 1)
    assert.match(r.stderr, /There's no command called lnt\.\n\nHalation keeps/)
  })
  test("check refuses a width that isn't a phone-to-desktop pixel count", () => {
    for (const w of ["wide", "12", "375.5"]) {
      const r = run("check", "http://localhost:1", "--width", w)
      assert.equal(r.status, 1, w)
      assert.match(r.stderr, /--width is a whole number of pixels from 240 to 3840/)
    }
  })
  test("check knows --allow-counterexamples", () => {
    const r = run("check", "--help")
    assert.match(r.stdout, /--allow-counterexamples/)
    const bad = run("check", "http://localhost:1", "--allow-counterexample")
    assert.match(bad.stderr, /has no --allow-counterexample option/)
  })
  test("lint takes --hook or --stop, not both", () => {
    const r = run("lint", "--hook", "--stop")
    assert.equal(r.status, 1)
    assert.match(r.stderr, /halation lint takes --hook or --stop, not both\./)
  })
  test("an unknown option says how to find the right one", () => {
    const r = run("rules", "--yaml")
    assert.equal(r.status, 1)
    assert.match(r.stderr, /halation rules has no --yaml option\. Run halation rules --help/)
  })
  test("--version", () => assert.match(run("--version").stdout, /^\d+\.\d+\.\d+\n$/))
})

describe("halation rules", () => {
  test("prints each rule with why, instead and what catches it", () => {
    const r = run("rules")
    assert.equal(r.status, 0)
    for (const rule of loadRules()) {
      assert.ok(r.stdout.includes(`${rule.id}  ${rule.says}\n    Why: ${rule.why}\n    Instead: ${rule.instead}\n    Caught by: `), rule.id)
    }
  })
  test("--json is the rulebook", () => assert.deepEqual(JSON.parse(run("rules", "--json").stdout), loadRules()))
})

describe("the CLI's own words keep the rules", () => {
  const outputs = [run("--help"), ...["lint", "check", "rules", "skill", "init", "guard"].map((c) => run(c, "--help")), run("rules"), run("lnt")]
  const text = outputs.map((r) => r.stdout + r.stderr).join("\n")
  test("no dots or bullets joining facts", () => assert.doesNotMatch(text, /\s[\u00b7\u2022]\s/))
  test("no capitalized labels", () => {
    const shouting = (text.match(/\b[A-Z]{3,}\b/g) ?? []).filter((w) => !["JSON", "WCAG", "CSS", "HTML", "SKILL", "AGENTS", "CLAUDE", "MD", "UI", "CLI"].includes(w))
    assert.deepEqual(shouting, [])
  })
})
