import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { catalog } from "@halation/core/phenomena"
import { lintText } from "../src/lint.js"
import { corePath, loadRules } from "../src/rules.js"
import { renderSkill } from "../src/skill.js"

const BIN = fileURLToPath(new URL("../bin/halation.js", import.meta.url))
const kit = (name) => JSON.parse(readFileSync(new URL(`../kit/${name}`, import.meta.url), "utf8"))
const { components, types, needs } = kit("components.json")
const foundations = kit("foundations.json")

describe("halation skill", async () => {
  const skill = await renderSkill()

  test("starts with Agent Skills frontmatter", () => {
    const m = skill.match(/^---\nname: halation\ndescription: (.+)\n---\n/)
    assert.ok(m, "frontmatter")
    assert.match(m[1], /^.{40,1024}$/)
    assert.match(m[1], /Use when/)
  })

  test("covers setup", () => {
    assert.match(skill, /import "@halation\/react\/styles\.css"/)
    assert.match(skill, /<HalationProvider name=/)
  })

  test("has every rule with its says, why and instead", () => {
    for (const r of loadRules()) {
      assert.ok(skill.includes(`### ${r.id}: ${r.says}`), r.id)
      assert.ok(skill.includes(`- Why: ${r.why}`), `${r.id} why`)
      assert.ok(skill.includes(`- Instead: ${r.instead}`), `${r.id} instead`)
    }
    assert.equal(skill.match(/^- Don't: /gm).length, loadRules().length)
    assert.equal(skill.match(/^- Do: /gm).length, loadRules().length)
  })

  test("has every component, text style, phenomenon and duration", () => {
    for (const c of components) assert.ok(skill.includes(`**${c.name}**`), c.name)
    for (const n of needs) assert.ok(skill.includes(n.need), n.need)
    for (const t of foundations.textStyles) assert.match(skill, new RegExp(`^\\| ${t.name} \\|`, "m"))
    for (const p of catalog) assert.match(skill, new RegExp(`^\\| ${p.name} \\| ${p.group} \\|`, "m"))
    for (const d of foundations.durations) assert.ok(skill.includes(`--duration-${d.name} | ${d.ms}`), d.name)
    assert.match(skill, /## Tells of generated design/)
  })

  test("keeps the rules itself", () => assert.deepEqual(lintText(skill, "SKILL.md"), []))

  test("the command prints it", () => {
    const r = spawnSync(process.execPath, [BIN, "skill"], { encoding: "utf8" })
    assert.equal(r.status, 0)
    assert.equal(r.stdout, skill)
  })
})

describe("the component catalog", () => {
  const index = readFileSync(fileURLToPath(new URL("../../react/src/index.ts", import.meta.url)), "utf8")
  const exported = { values: [], types: [] }
  for (const [, list] of index.matchAll(/export \{([^}]+)\} from/g)) {
    for (const item of list.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (item.startsWith("type ")) exported.types.push(item.slice(5).trim())
      else exported.values.push(item)
    }
  }
  for (const [, name] of index.matchAll(/export \* as (\w+) from/g)) exported.values.push(name)

  test("has every value export of @halation/react", () => {
    assert.deepEqual(components.map((c) => c.name).sort(), exported.values.sort())
  })
  test("lists every type export", () => assert.deepEqual([...types].sort(), exported.types.sort()))
  test("every entry has a use and an example", () => {
    for (const c of components) {
      assert.ok(c.use.length > 10, c.name)
      assert.ok(c.example.includes(c.name), c.name)
    }
  })
  test("examples keep the rules", () => {
    for (const c of components) assert.deepEqual(lintText(c.example, "example.tsx"), [], c.name)
  })
})

describe("the foundations", () => {
  const tokens = readFileSync(corePath("tokens.css"), "utf8")
  test("text styles match tokens.css", () => {
    const names = [...tokens.matchAll(/--text-([a-z0-9-]+):/g)].map((m) => m[1]).filter((n) => !n.includes("--"))
    assert.deepEqual(foundations.textStyles.map((t) => t.name), names)
  })
  test("durations match tokens.css", () => {
    const found = Object.fromEntries([...tokens.matchAll(/--duration-([a-z]+):\s*(\d+)ms/g)].map((m) => [m[1], Number(m[2])]))
    assert.deepEqual(Object.fromEntries(foundations.durations.map((d) => [d.name, d.ms])), found)
  })
  test("easings match tokens.css", () => {
    const found = [...tokens.matchAll(/--ease-([a-z-]+):/g)].map((m) => m[1])
    assert.deepEqual(foundations.eases.map((e) => e.name), found)
  })
})
