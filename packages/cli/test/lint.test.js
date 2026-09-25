import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { collectFiles, lintText } from "../src/lint.js"
import { loadRules } from "../src/rules.js"

const BIN = fileURLToPath(new URL("../bin/halation.js", import.meta.url))
// Separators are written as escapes so this file stays clean under R9 itself.
const DOT = "\u00b7"
const BULLET = "\u2022"

const ids = (text, file) => lintText(text, file).map((f) => f.rule)

/**
 * For every rule with a detector: text it must flag and text it must leave
 * alone. [file, text] pairs; the file's extension picks the detectors.
 */
const CASES = {
  R3: {
    flag: [
      ["a.tsx", `<div className="bg-gradient-to-r from-purple-500 to-pink-500" />`],
      ["a.tsx", `<div className="bg-linear-to-r" />`],
      ["a.css", `.hero { background: linear-gradient(90deg, red, blue); }`],
      ["a.scss", `.hero { background-image: radial-gradient(circle, red, blue); }`],
    ],
    keep: [
      ["a.tsx", `<div className="bg-surface text-fg" />`],
      ["a.css", `.hero { background: var(--color-surface); }`],
      ["src/phenomena/rays.css", `.ray { background: linear-gradient(red, blue); }`],
    ],
  },
  R5: {
    flag: [
      ["a.tsx", `<span className="uppercase text-caption">New</span>`],
      ["a.css", `.eyebrow { text-transform: uppercase; }`],
      ["a.html", `<span style="text-transform:uppercase">New</span>`],
    ],
    keep: [
      ["a.tsx", `<span className="normal-case">New</span>`],
      ["a.tsx", `const initials = name.toUpperCase()`],
    ],
  },
  R6: {
    flag: [
      ["a.tsx", `<p className="tracking-widest">Label</p>`],
      ["a.tsx", `<p className="tracking-[0.2em]">Label</p>`],
      ["a.css", `.label { letter-spacing: 0.1em; }`],
      ["a.css", `.label { letter-spacing: .08rem; }`],
    ],
    keep: [
      ["a.tsx", `<p className="tracking-tight">Label</p>`],
      ["a.css", `.title { letter-spacing: -0.02em; }`],
    ],
  },
  R7: {
    flag: [
      ["a.tsx", `<p className="text-sm">Hi</p>`],
      ["a.tsx", `<p className="md:text-2xl font-semibold">Hi</p>`],
      ["a.vue", `<p class="text-xs">Hi</p>`],
    ],
    keep: [
      ["a.tsx", `<p className="text-body-sm">Hi</p>`],
      ["a.tsx", `<p className="hl-text-body-sm text-fg-muted">Hi</p>`],
      ["a.css", `.a { font-size: var(--text-body-sm); } .text-sm {}`],
    ],
  },
  R9: {
    flag: [
      ["a.tsx", `<p>Copy of Claude ${DOT} 412 MB</p>`],
      ["a.tsx", `<p>{name} ${BULLET} {size}</p>`],
      ["a.ts", "const label = `${name} " + DOT + " ${size}`"],
      ["README.md", `Size ${DOT} 4 GB`],
    ],
    keep: [
      ["a.ts", `type Mode = "light" | "dark"`],
      ["a.tsx", `const on = a || b`],
      ["a.tsx", `<Facts items={[["Name", "Copy of Claude"], ["Size", "412 MB"]]} />`],
      ["a.css", `.a::before { content: " ${DOT} "; }`],
    ],
  },
  R10: {
    flag: [
      ["a.tsx", `<span className="size-2 rounded-full bg-accent" />`],
      ["a.tsx", `<span className="rounded-full w-2 h-2 bg-positive" />`],
      ["a.tsx", `<span className="inline-block size-1.5 rounded-full" />`],
    ],
    keep: [
      ["a.tsx", `<img className="size-8 rounded-full" />`],
      ["a.tsx", `<span className="size-2" />`],
      ["a.tsx", `<button className="rounded-full px-4 py-2">Go</button>`],
    ],
  },
  R16: {
    flag: [
      ["a.tsx", `<kbd>⌘</kbd><kbd>K</kbd>`],
      ["a.html", `<kbd>Ctrl</kbd>\n  <kbd>C</kbd>`],
    ],
    keep: [
      ["a.tsx", `<Keys keys={["⌘", "K"]} />`],
      ["a.tsx", `<kbd>⌘</kbd> + <kbd>K</kbd>`],
    ],
  },
  R17: {
    flag: [
      ["a.tsx", `<div className="bg-[#7c3aed] p-4" />`],
      ["a.tsx", `<div className="text-[rgb(10,10,10)]" />`],
      ["a.tsx", `<div style={{ color: "#333" }} />`],
      ["a.tsx", `<div style={{ background: "oklch(60% 0.2 30)" }} />`],
    ],
    keep: [
      ["a.tsx", `<div className="bg-surface text-fg-muted border-line" />`],
      ["a.tsx", `<div style={{ width: 12, color: "var(--color-fg)" }} />`],
    ],
  },
  R18: {
    flag: [
      ["a.css", `body { font-family: Inter, sans-serif; }`],
      ["a.css", `body { font-family: "Roboto"; }`],
      ["a.tsx", `<p className="font-[Inter]">Hi</p>`],
    ],
    keep: [
      ["a.css", `body { font-family: var(--font-sans); }`],
      ["a.tsx", `<p className="font-sans">Hi</p>`],
    ],
  },
}

describe("every detector", () => {
  const withDetectors = loadRules().filter((r) => r.lint?.length)

  test("has cases here", () => {
    const missing = withDetectors.map((r) => r.id).filter((id) => !CASES[id])
    assert.deepEqual(missing, [], `Add lint cases for ${missing.join(", ")}`)
  })

  for (const rule of withDetectors) {
    const cases = CASES[rule.id] ?? { flag: [], keep: [] }
    for (const [file, text] of cases.flag) {
      test(`${rule.id} flags ${JSON.stringify(text)} in ${file}`, () => {
        assert.ok(ids(text, file).includes(rule.id), `expected ${rule.id} in ${JSON.stringify(ids(text, file))}`)
      })
    }
    for (const [file, text] of cases.keep) {
      test(`${rule.id} leaves ${JSON.stringify(text)} in ${file} alone`, () => {
        assert.ok(!ids(text, file).includes(rule.id), `unexpected ${rule.id}`)
      })
    }
  }

  test("R10 is a warning, the rest are errors", () => {
    const [f] = lintText(`<span className="size-2 rounded-full" />`, "a.tsx")
    assert.equal(f.rule, "R10")
    assert.equal(f.level, "warn")
    assert.equal(lintText(`<p className="uppercase" />`, "a.tsx")[0].level, "error")
  })

  test("files a detector doesn't cover are left alone", () => {
    assert.deepEqual(ids(`<p className="text-sm uppercase">A ${DOT} B</p>`, "a.py"), [])
    assert.deepEqual(ids(`.a { text-transform: uppercase }`, "notes.md"), [])
  })
})

describe("detector edge cases", () => {
  const flags = (name, rule, file, text) => test(name, () => assert.ok(ids(text, file).includes(rule), JSON.stringify(ids(text, file))))
  const keeps = (name, rule, file, text) => test(name, () => assert.ok(!ids(text, file).includes(rule), JSON.stringify(ids(text, file))))
  flags("R7 catches arbitrary sizes", "R7", "a.tsx", `<p className="text-[13px]">Hi</p>`)
  flags("R9 catches bars between facts in text", "R9", "a.tsx", `<p>Copy of Claude | 412 MB</p>`)
  keeps("R9 leaves type unions alone", "R9", "a.tsx", `const a: Array<string> | Array<number> = []`)
  flags("R9 catches the &middot; entity", "R9", "a.html", `<p>Copy of Claude &middot; 412 MB</p>`)
  flags("R9 catches the &bull; entity", "R9", "a.html", `<p>Copy of Claude &bull; 412 MB</p>`)
  flags("R17 catches literal colors inside cx()", "R17", "a.tsx", `<div className={cx("bg-[#7c3aed]", a)} />`)
  flags("R17 catches literal colors in template literals", "R17", "a.tsx", "<div className={`p-2 text-[rgb(0,0,0)]`} />")
  flags("R18 catches quoted Tailwind font values", "R18", "a.tsx", `<p className="font-['Inter']">Hi</p>`)
  flags("R18 catches fontFamily in style objects", "R18", "a.tsx", `<p style={{ fontFamily: "Inter" }}>Hi</p>`)
  flags("R6 catches whole-number letter-spacing", "R6", "a.css", `.a { letter-spacing: 2px; }`)
  flags("R6 catches letterSpacing in style objects", "R6", "a.tsx", `<p style={{ letterSpacing: "0.1em" }}>Hi</p>`)
  keeps("R6 leaves letterSpacing: 0 alone", "R6", "a.tsx", `<p style={{ letterSpacing: 0 }}>Hi</p>`)
  keeps("R6 leaves the generated tokens alone", "R6", "packages/core/css/tokens.css", `:root { --tracking-micro: 0.005em; letter-spacing: 0.005em; }`)
  keeps("R3 leaves gradients used as masks alone", "R3", "a.css", `.a { mask-image: linear-gradient(black, transparent); }`)
  keeps("R3 leaves every gradient in a mask alone", "R3", "a.css", `.a { -webkit-mask-image: linear-gradient(black, transparent), radial-gradient(black, transparent); }`)
  flags("R3 still catches a gradient after a mask", "R3", "a.css", `.a { mask-image: linear-gradient(black, transparent); background: linear-gradient(red, blue); }`)
  keeps("R3 leaves Halation's own core alone", "R3", "packages/core/css/signature.css", `.a { background: radial-gradient(red, blue); }`)
  keeps("R10 leaves thin progress bars alone", "R10", "a.tsx", `<div className="h-1 w-full rounded-full bg-fill" />`)
  keeps("R10 leaves half-width bars alone", "R10", "a.tsx", `<div className="h-2 w-1/2 rounded-full bg-fill" />`)
  flags("R10 catches a dot made of w and h", "R10", "a.tsx", `<span className="rounded-full w-2 h-2 bg-accent" />`)
  flags("R16 catches Kbd components pressed together", "R16", "a.tsx", `<Kbd>⌘</Kbd><Kbd>K</Kbd>`)
})

describe("positions", () => {
  test("line and column point at the offending text", () => {
    const text = `const a = 1\n<p className="x text-sm">Hi</p>\n<p>A ${DOT} B</p>`
    const found = lintText(text, "a.tsx")
    assert.deepEqual(found.map((f) => [f.rule, f.line, f.column]), [["R7", 2, 17], ["R9", 3, 6]])
    assert.equal(found[0].found, "text-sm")
  })
})

describe("ignore comments", () => {
  const line = `<p>A ${DOT} B</p>`
  test("on the same line", () => assert.deepEqual(ids(`${line} {/* halation-ignore R9 */}`, "a.tsx"), []))
  test("on the line above", () => assert.deepEqual(ids(`{/* halation-ignore R9 */}\n${line}`, "a.tsx"), []))
  test("only for the rule named", () => assert.deepEqual(ids(`{/* halation-ignore R7 */}\n${line}`, "a.tsx"), ["R9"]))
  test("not two lines up", () => assert.deepEqual(ids(`{/* halation-ignore R9 */}\n\n${line}`, "a.tsx"), ["R9"]))
  test("several rules at once", () => assert.deepEqual(ids(`// halation-ignore R7, R9\n<p className="text-sm">A ${DOT} B</p>`, "a.tsx"), []))
  test("every rule when none is named", () => assert.deepEqual(ids(`<p className="text-sm uppercase">A ${DOT} B</p> // halation-ignore`, "a.tsx"), []))
})

describe("halation lint on disk", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "halation-lint-"))
  after(() => rmSync(dir, { recursive: true, force: true }))
  const put = (rel, text) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    writeFileSync(path.join(dir, rel), text)
  }
  put("src/bad.tsx", `export const A = () => <p className="text-sm">Hi</p>\n`)
  put("src/warn.tsx", `export const B = () => <span className="size-2 rounded-full" />\n`)
  put("src/fine.tsx", `export const C = () => <p className="text-body-sm">Hi</p>\n`)
  put("src/notes.py", `x = "text-sm"\n`)
  for (const skipped of ["node_modules/pkg/x.tsx", "dist/x.tsx", ".next/x.tsx", "build/x.tsx"]) put(skipped, `<p className="text-sm" />`)
  const run = (...args) => spawnSync(process.execPath, [BIN, "lint", ...args], { cwd: dir, encoding: "utf8" })

  test("walks source and skips dependencies, build output and hidden folders", () => {
    const files = collectFiles(["."], { cwd: dir }).map((f) => path.relative(dir, f).split(path.sep).join("/"))
    assert.deepEqual(files.sort(), ["src/bad.tsx", "src/fine.tsx", "src/warn.tsx"])
  })

  test("reports file:line:col, the rule and what it says, then why and instead once", () => {
    const r = run("src")
    assert.equal(r.status, 1)
    assert.match(r.stdout, /^src\/bad\.tsx:1:38 {2}R7 {2}Ten named text styles; no other sizes\./m)
    assert.match(r.stdout, /src\/warn\.tsx:1:\d+ {2}R10 .*\(warning\)/)
    assert.equal(r.stdout.match(/^ {2}Why:/gm).length, 2)
    assert.match(r.stdout, /Found 1 error and 1 warning in 2 files, out of 3 files linted\./)
  })

  test("warnings alone don't fail", () => {
    assert.equal(run("src/warn.tsx", "src/fine.tsx").status, 0)
  })

  test("a clean run says so and exits 0", () => {
    const r = run("src/fine.tsx")
    assert.equal(r.status, 0)
    assert.equal(r.stdout, "No problems in 1 file.\n")
  })

  test("--json", () => {
    const r = run("src", "--json")
    assert.equal(r.status, 1)
    const out = JSON.parse(r.stdout)
    assert.equal(out.files, 3)
    assert.equal(out.errors, 1)
    assert.equal(out.warnings, 1)
    assert.deepEqual(Object.keys(out.rules).sort(), ["R10", "R7"])
    assert.equal(out.findings[0].file, "src/bad.tsx")
  })

  test("a missing path says what's wrong", () => {
    const r = run("nope")
    assert.equal(r.status, 1)
    assert.match(r.stderr, /There's no file or folder at nope\./)
  })
})
