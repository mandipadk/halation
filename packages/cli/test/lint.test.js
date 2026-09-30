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
const BULLET_OP = "\u2219"
const DOT_OP = "\u22c5"

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
      ["a.less", `.hero { background: linear-gradient(red, blue); }`],
      ["a.ts", `export const hero = { background: "linear-gradient(90deg, red, blue)" }`],
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
      ["a.pcss", `.eyebrow { text-transform: uppercase; }`],
      ["a.ts", `export const eyebrow = { textTransform: "uppercase" }`],
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
      ["a.css", `.title { letter-spacing: -0.02em; }`],
      ["a.tsx", `<p className="tracking-tight">Label</p>`],
      ["a.ts", `export const label = { letterSpacing: "0.1em" }`],
    ],
    keep: [
      ["a.css", `.title { letter-spacing: 0; }`],
      ["a.css", `.title { letter-spacing: normal; }`],
      ["a.css", `.title { letter-spacing: var(--text-title-1--letter-spacing); }`],
      ["a.tsx", `<p className="text-title-1">Label</p>`],
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
      ["a.css", `.a::before { content: " ${DOT} "; }`],
      ["a.mdx", `Copy of Claude ${DOT} 412 MB`],
    ],
    keep: [
      ["a.ts", `type Mode = "light" | "dark"`],
      ["a.tsx", `const on = a || b`],
      ["a.tsx", `<Facts items={[["Name", "Copy of Claude"], ["Size", "412 MB"]]} />`],
      ["a.css", `.a::before { content: ""; }`],
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
      ["a.css", `.a { color: #7c3aed; }`],
      ["a.css", `:root { --color-accent: #8b5cf6; }`],
      ["a.ts", `export const card = { borderColor: "violet" }`],
      ["a.svg", `<svg><circle r="4" fill="#7c3aed" /></svg>`],
    ],
    keep: [
      ["a.tsx", `<div className="bg-surface text-fg-muted border-line" />`],
      ["a.tsx", `<div style={{ width: 12, color: "var(--color-fg)" }} />`],
      ["a.css", `.a { color: var(--color-fg); background: color-mix(in oklab, var(--color-accent) 20%, transparent); }`],
      ["packages/core/css/tokens.css", `:root { --color-fg: #111; }`],
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
      ["a.css", `@font-face { font-family: "Geist"; src: url(geist.woff2); }`],
    ],
  },
  R19: {
    flag: [
      ["app.css", `@import "tailwindcss";`],
      ["app.css", `@import 'tailwindcss/utilities';`],
    ],
    keep: [
      ["app.css", `@import "@halation/core/tailwind.css";`],
      ["packages/core/css/tailwind.css", `@import "tailwindcss";`],
    ],
  },
  R20: {
    flag: [
      ["a.ts", `if (navigator.webdriver) show(clean)`],
      ["a.tsx", `const bot = /HeadlessChrome/.test(navigator.userAgent)`],
      ["a.js", `if (window.__playwright || window.__puppeteer) hide()`],
    ],
    keep: [
      ["a.ts", `const agent = navigator.userAgent`],
    ],
  },
  R26: {
    flag: [
      ["a.css", `.cap { --m-cap-x: 9px; padding: 0 var(--m-cap-x); }`],
      ["a.scss", `.cap {\n  --m-cap-x: 9px;\n  padding: 0 var(--m-cap-x);\n}`],
      ["a.tsx", `<div style={{ "--m-x": "13px" }} />`],
      ["a.ts", `el.style.setProperty("--m-x", "13px")`],
      ["a.html", `<div style="--m-x: 13px">x</div>`],
    ],
    keep: [
      ["a.css", `.cap { --m-cap-x: 9px; /* a one-letter cap stays square at 38 px */ padding: 0 var(--m-cap-x); }`],
      ["a.css", `.cap { padding: 0 var(--m-cap-x); }`],
      ["a.tsx", `<div className="px-[var(--m-inset-x)]" />`],
      ["a.ts", `const inset = "var(--m-inset-x)"`],
    ],
  },
  R22: {
    flag: [
      ["a.css", `h1 { text-shadow: 0 0 24px var(--color-accent); }`],
      ["a.tsx", `<h1 style={{ textShadow: "0 0 20px var(--color-accent)" }}>Hi</h1>`],
      ["a.tsx", `<h1 className="text-shadow-lg">Hi</h1>`],
    ],
    keep: [
      ["a.css", `h1 { text-shadow: none; }`],
      ["a.tsx", `<h1 className="text-shadow-none">Hi</h1>`],
      ["a.css", `.card { box-shadow: var(--shadow-raised); }`],
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

  test("R10 is an error for a filled dot and a warning without a fill", () => {
    const [f] = lintText(`<span className="size-2 rounded-full" />`, "a.tsx")
    assert.equal(f.rule, "R10")
    assert.equal(f.level, "warn")
    const filled = lintText(`<span className="size-2 rounded-full bg-positive" />`, "a.tsx")
    assert.deepEqual(filled.map((x) => [x.rule, x.level]), [["R10", "error"]])
    assert.equal(lintText(`<p className="uppercase" />`, "a.tsx")[0].level, "error")
  })

  test("every detector ignores case", () => {
    for (const rule of withDetectors) for (const l of rule.lint) assert.ok(l.flags?.includes("i"), rule.id)
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

  // R3
  flags("R3 ignores case", "R3", "a.css", `.a { background: Radial-Gradient(circle, red, blue); }`)
  flags("R3 catches a gradient border", "R3", "a.css", `.a { border: 2px solid; border-image: linear-gradient(90deg, red, blue) 1; }`)
  flags("R3 catches a gradient after a comment that says mask", "R3", "a.css", `.a { background: /* mask: */ linear-gradient(red, blue); }`)
  flags("R3 catches a gradient after an arbitrary mask property", "R3", "a.tsx", `<div className="[mask-image:none] bg-[linear-gradient(90deg,red,blue)]" />`)
  keeps("R3 leaves a Tailwind mask alone", "R3", "a.tsx", `<div className="[mask-image:linear-gradient(to_bottom,black,transparent)]" />`)
  keeps("R3 leaves a mask in a style object alone", "R3", "a.tsx", `<div style={{ maskImage: "linear-gradient(black, transparent)" }} />`)
  keeps("R3 leaves a mask written in capitals alone", "R3", "a.css", `.a { MASK-IMAGE: Linear-Gradient(black, transparent); }`)

  // R5
  flags("R5 catches UPPERCASE", "R5", "a.css", `.a { text-transform: UPPERCASE; }`)
  flags("R5 catches uppercase with no spaces", "R5", "a.css", `.a{text-transform:uppercase}`)
  flags("R5 catches uppercase with odd spacing in a script", "R5", "a.ts", `const css = ".a { text-transform :  uppercase }"`)
  flags("R5 catches textTransform in a style object", "R5", "a.js", `export const s = { textTransform: 'uppercase' }`)
  flags("R5 catches small caps", "R5", "a.css", `.a { font-variant: small-caps; }`)
  flags("R5 catches all small caps", "R5", "a.scss", `.a { font-variant-caps: all-small-caps; }`)
  flags("R5 catches fontVariantCaps", "R5", "a.tsx", `<p style={{ fontVariantCaps: "all-small-caps" }}>New</p>`)
  keeps("R5 leaves toUpperCase alone", "R5", "a.ts", `const initials = name.toUpperCase()`)
  keeps("R5 leaves capitalize alone", "R5", "a.css", `.a { text-transform: none; font-variant-numeric: tabular-nums; }`)

  // R6
  for (const value of ["0.3ch", "3pt", "0.4vw", "1vh", "5%", "2px", "0.1em", ".08rem", "calc(0.3em)", "var(--wide)", "3PX", "-0.02em"]) {
    flags(`R6 catches letter-spacing: ${value}`, "R6", "a.css", `.a { letter-spacing: ${value}; }`)
  }
  for (const value of ["0", "0em", "normal", "inherit", "initial", "unset", "var(--text-body--letter-spacing)"]) {
    keeps(`R6 leaves letter-spacing: ${value} alone`, "R6", "a.css", `.a { letter-spacing: ${value}; }`)
  }
  flags("R6 catches letterSpacing as a number", "R6", "a.tsx", `<p style={{ letterSpacing: 2 }}>Hi</p>`)
  flags("R6 catches an arbitrary letter-spacing property", "R6", "a.tsx", `<p className="before:[letter-spacing:0.4ch]">Hi</p>`)
  flags("R6 catches tracking-normal, which the theme doesn't define", "R6", "a.tsx", `<p className="md:tracking-normal">Hi</p>`)
  flags("R6 catches tracking in @apply", "R6", "a.css", `.a { @apply tracking-wide; }`)
  keeps("R6 leaves tracking tokens in custom properties alone", "R6", "a.css", `.a { --tracking-x: var(--tracking-y); }`)
  keeps("R6 leaves letterSpacing: \"0\" alone", "R6", "a.ts", `export const s = { letterSpacing: "0" }`)

  // R9
  for (const [name, text] of [
    ["&middot; with no spaces", `<p>Copy&middot;412 MB</p>`],
    ["&nbsp;&middot;&nbsp;", `<p>Copy of Claude&nbsp;&middot;&nbsp;412 MB</p>`],
    ["&#183;", `<p>Copy&#183;412 MB</p>`],
    ["&bull;", `<p>Copy&bull;412 MB</p>`],
    ["&#8226;", `<p>Copy &#8226; 412 MB</p>`],
    ["a dot alone between tags", `<p><span>Copy</span><span>${DOT}</span><span>412 MB</span></p>`],
    ["a dot between tags with &nbsp;", `<p><span>Copy</span>&nbsp;${DOT}&nbsp;<span>412 MB</span></p>`],
    ["a bullet operator", `<p>Copy ${BULLET_OP} 412 MB</p>`],
    ["a dot operator", `<p>Copy ${DOT_OP} 412 MB</p>`],
    ["a dot in a JSX string", `<p>{name}{"${DOT}"}{size}</p>`],
    ["a dot in a Tailwind content value", `<p className="before:content-['New_${DOT}_Beta']">Hi</p>`],
  ]) flags(`R9 catches ${name}`, "R9", "a.tsx", text)
  flags("R9 catches a dot in CSS content", "R9", "a.css", `.fact + .fact::before { content: "${DOT}"; }`)
  flags("R9 catches an escaped bullet in CSS content", "R9", "a.css", `.fact + .fact::before { content: "\\2022"; }`)
  flags("R9 catches a bullet operator in CSS content", "R9", "a.less", `.fact::before { content: "${BULLET_OP}"; }`)
  keeps("R9 leaves other content alone", "R9", "a.css", `.a::before { content: "\\2192"; }`)
  keeps("R9 leaves decimals alone", "R9", "a.tsx", `<p>1.5 MB</p>`)

  // R10
  flags("R10 makes a filled dot an error", "R10", "a.tsx", `<span className="size-3 rounded-full bg-positive animate-ping" />`)
  flags("R10 catches size-4", "R10", "a.tsx", `<span className="size-4 rounded-full bg-accent" />`)
  flags("R10 catches an arbitrary pixel size", "R10", "a.tsx", `<span className="size-[8px] rounded-full bg-positive" />`)
  flags("R10 catches rounded-[50%]", "R10", "a.tsx", `<span className="h-2 w-2 rounded-[50%] bg-positive" />`)
  test("R10 makes a filled dot an error, not a warning", () => {
    const f = lintText(`<span className="w-3 h-3 rounded-full bg-emerald-500" />`, "a.tsx").filter((x) => x.rule === "R10")
    assert.deepEqual(f.map((x) => x.level), ["error"])
  })
  keeps("R10 leaves a size-5 avatar alone", "R10", "a.tsx", `<img className="size-5 rounded-full bg-fill" />`)
  keeps("R10 leaves a thin bar with a fill alone", "R10", "a.tsx", `<div className="h-1 w-full rounded-full bg-accent" />`)
  keeps("R10 leaves max-w-2 alone", "R10", "a.tsx", `<div className="max-w-2 h-2 rounded-full" />`)

  // R17
  for (const [name, css] of [
    ["hex", `.a { color: #a855f7; }`],
    ["hex in capitals", `.a { color: #A855F7; }`],
    ["rgb", `.a { background: rgb(124 58 237); }`],
    ["rgba", `.a { background: rgba(0, 0, 0, .5); }`],
    ["hsl", `.a { border-color: hsl(270 80% 60%); }`],
    ["oklch", `.a { color: oklch(60% 0.2 300); }`],
    ["oklab", `.a { color: oklab(0.6 0.1 -0.1); }`],
    ["lab", `.a { color: lab(50% 40 -60); }`],
    ["lch", `.a { color: lch(50% 60 300); }`],
    ["color-mix with a literal", `.a { background: color-mix(in oklab, var(--color-accent), #fff); }`],
    ["a custom property", `:root { --color-accent: #8b5cf6; }`],
    ["a Sass variable", `$accent: #8b5cf6;`],
    ["a shadow", `.a { box-shadow: 0 0 40px #7c3aed; }`],
    ["a declaration over lines", `.a {\n  box-shadow:\n    0 0 40px rgb(0 0 0 / 50%);\n}`],
  ]) flags(`R17 catches ${name} in a style sheet`, "R17", "a.css", css)
  for (const name of ["red", "blue", "purple", "violet", "magenta", "fuchsia", "indigo", "pink", "white", "black", "gray", "mediumpurple", "RebeccaPurple"]) {
    flags(`R17 catches the named color ${name}`, "R17", "a.css", `.a { color: ${name}; }`)
  }
  for (const ext of ["scss", "pcss", "postcss", "less", "sass", "styl"]) flags(`R17 reads .${ext}`, "R17", `a.${ext}`, `.a { color: #7c3aed; }`)
  keeps("R17 leaves an id selector alone", "R17", "a.css", `#add, a:hover #fade { color: var(--color-fg); }`)
  keeps("R17 leaves keywords alone", "R17", "a.css", `.a { color: currentColor; background: transparent; border-color: inherit; outline-color: initial; fill: unset; }`)
  keeps("R17 leaves properties named like colors alone", "R17", "a.css", `.a { white-space: nowrap; transition: color 150ms; }`)
  keeps("R17 leaves colors built from tokens alone", "R17", "a.css", `.a { color: oklch(from var(--color-accent) l c h / 50%); background: rgb(var(--rgb)); }`)
  keeps("R17 leaves masks alone", "R17", "a.css", `.a { mask-image: linear-gradient(to bottom, black 45%, transparent); -webkit-mask-image: linear-gradient(#000, transparent); }`)
  keeps("R17 leaves url fragments alone", "R17", "a.css", `.a { fill: url(#abc); }`)
  keeps("R17 leaves Halation's core alone", "R17", "packages/core/css/signature.css", `.a { color: #fff; }`)
  flags("R17 catches typed Tailwind values", "R17", "a.tsx", `<p className="bg-[color:#7c3aed]">Hi</p>`)
  flags("R17 catches colors inside Tailwind shadows", "R17", "a.tsx", `<p className="shadow-[0_0_40px_#7c3aed]">Hi</p>`)
  flags("R17 catches color-mix in Tailwind", "R17", "a.tsx", `<p className="bg-[color-mix(in_oklab,#7c3aed,white)]">Hi</p>`)
  flags("R17 catches oklab in Tailwind", "R17", "a.tsx", `<p className="text-[oklab(0.6_0.1_0.1)]">Hi</p>`)
  flags("R17 catches a named color in Tailwind", "R17", "a.tsx", `<p className="bg-[red]">Hi</p>`)
  flags("R17 catches arbitrary color properties", "R17", "a.tsx", `<p className="[color:#7c3aed]">Hi</p>`)
  flags("R17 catches a style object after a template literal", "R17", "a.tsx", "<p style={{ width: `${w}px`, color: \"#7c3aed\" }}>Hi</p>")
  flags("R17 catches a style object in a variable", "R17", "a.tsx", `const purple = { color: "#7c3aed" }`)
  flags("R17 catches named colors in style objects", "R17", "a.tsx", `<p style={{ color: "purple", background: "violet" }}>Hi</p>`)
  flags("R17 catches a custom property in a style object", "R17", "a.tsx", `<p style={{ "--glow": "#7c3aed" }}>Hi</p>`)
  flags("R17 catches colors in a box shadow object", "R17", "a.tsx", `<div style={{ boxShadow: "0 0 80px 40px #7c3aed" }} />`)
  flags("R17 catches CSS in a script string", "R17", "a.ts", "export const css = `.x { color: #7c3aed; }`")
  flags("R17 catches style.color", "R17", "a.ts", `el.style.color = "#7c3aed"`)
  flags("R17 catches style.background with a named color", "R17", "a.js", `el.style.background = 'hotpink'`)
  flags("R17 catches setProperty", "R17", "a.ts", `document.documentElement.style.setProperty("--color-accent", "oklch(60% 0.2 300)")`)
  flags("R17 catches SVG fill", "R17", "a.tsx", `<circle r="4" fill="#7c3aed" />`)
  flags("R17 catches SVG stopColor", "R17", "a.tsx", `<stop stopColor="#db2777" />`)
  flags("R17 catches SVG stop-color", "R17", "icon.svg", `<stop stop-color="rgb(10,10,10)" />`)
  flags("R17 catches a named color in an SVG", "R17", "icon.svg", `<path stroke="red" />`)
  flags("R17 catches a style attribute", "R17", "a.html", `<p style="color: red">Hi</p>`)
  flags("R17 catches colors in mdx", "R17", "a.mdx", `<p style={{ color: "#333" }}>Hi</p>`)
  keeps("R17 leaves SVG keywords alone", "R17", "icon.svg", `<path fill="none" stroke="currentColor" />`)
  keeps("R17 leaves token-based style objects alone", "R17", "a.tsx", `<p style={{ color: "var(--color-fg)", border: "1px solid var(--color-line)" }}>Hi</p>`)
  keeps("R17 leaves ordinary words alone", "R17", "a.tsx", `<p>Notes: white space, a black box and red tape</p>`)
  keeps("R17 leaves ordinary objects alone", "R17", "a.ts", `const tones = { tone: "red", label: "Black" }`)

  // R18
  for (const [name, text] of [
    ["a system stack before Inter", `.a { font-family: system-ui, Inter, sans-serif; }`],
    ["a font nobody listed", `.a { font-family: "Space Grotesk", sans-serif; }`],
    ["a lower-case name", `.a { font-family: 'inter'; }`],
    ["a variable that isn't a font token", `.a { font-family: var(--f); }`],
    ["a token with a fallback", `.a { font-family: var(--font-sans), sans-serif; }`],
  ]) flags(`R18 catches ${name}`, "R18", "a.css", text)
  flags("R18 catches fontFamily with quotes inside", "R18", "a.tsx", `<p style={{ fontFamily: "'Inter', sans-serif" }}>Hi</p>`)
  flags("R18 catches any arbitrary Tailwind font", "R18", "a.tsx", `<p className="font-['Poppins']">Hi</p>`)
  flags("R18 catches font-family in a script string", "R18", "a.ts", "export const css = `.x { font-family: Lato }`")
  keeps("R18 leaves font tokens alone", "R18", "a.css", `.a { font-family: var(--font-serif); } .b { font-family: inherit; }`)
  keeps("R18 leaves a fontFamily token alone", "R18", "a.tsx", `<p style={{ fontFamily: "var(--font-mono)" }}>Hi</p>`)
  keeps("R18 leaves a Tailwind font token alone", "R18", "a.tsx", `<p className="font-[var(--font-serif)]">Hi</p>`)

  // R19, R20 and R22
  flags("R19 catches a url import", "R19", "a.css", `@import url("tailwindcss");`)
  flags("R19 catches Tailwind 3 directives", "R19", "a.scss", `@tailwind base;`)
  flags("R20 catches a webdriver check in capitals", "R20", "a.ts", `if (NAVIGATOR.WEBDRIVER) {}`)
  flags("R20 catches the chromedriver marker", "R20", "a.js", `if (document.cdc_adoQpoasnfa76pfcZLmcfl_Array) {}`)
  flags("R22 catches a text-shadow arbitrary property", "R22", "a.tsx", `<h1 className="[text-shadow:0_0_20px_var(--color-accent)]">Hi</h1>`)
  flags("R22 catches text-shadow in capitals", "R22", "a.pcss", `h1 { TEXT-SHADOW: 0 0 8px var(--color-accent); }`)
  keeps("R22 leaves textShadow: none alone", "R22", "a.tsx", `<h1 style={{ textShadow: "none" }}>Hi</h1>`)
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
  test("in a CSS comment", () => assert.deepEqual(ids(`.a { text-transform: uppercase; } /* halation-ignore R5: the logo lockup */`, "a.css"), []))
  test("in an HTML comment", () => assert.deepEqual(ids(`<!-- halation-ignore R9 quoted from the brief -->\n${line}`, "a.html"), []))
  test("in a comment over several lines", () => assert.deepEqual(ids(`/*\n * halation-ignore R9: a quote from the press kit\n */\n${line}`, "a.tsx"), []))
  test("in a comment after a string", () => assert.deepEqual(ids(`<p title="A">A ${DOT} B</p> {/* halation-ignore R9 */}`, "a.tsx"), []))
  test("after an apostrophe in text", () => assert.deepEqual(ids(`<p>Don't A ${DOT} B</p> {/* halation-ignore R9 */}`, "a.tsx"), []))
  test("rule ids in any case", () => assert.deepEqual(ids(`// halation-ignore r9\n${line}`, "a.tsx"), []))

  test("a bare one does nothing and is reported as R21", () => {
    const text = `<p className="text-sm uppercase">A ${DOT} B</p> // halation-ignore`
    const found = lintText(text, "a.tsx")
    assert.deepEqual(found.map((f) => f.rule).sort(), ["R21", "R5", "R7", "R9"].sort())
    const r21 = found.find((f) => f.rule === "R21")
    assert.equal(r21.level, "error")
    assert.equal(r21.column, text.indexOf("halation-ignore") + 1)
  })
  test("one with a reason but no rule id is reported too", () => {
    assert.deepEqual(ids(`/* halation-ignore because the brand says so */\n.a { text-transform: uppercase; }`, "a.css").sort(), ["R21", "R5"])
  })
  test("one on its own line is reported", () => assert.deepEqual(ids(`/* halation-ignore */\n.a{text-transform:uppercase}`, "a.css"), ["R21", "R5"]))
  test("in a string it does nothing and isn't reported", () => {
    assert.deepEqual(ids(`const note = "halation-ignore R9"\n${line}`, "a.tsx"), ["R9"])
    assert.deepEqual(ids(`const note = 'halation-ignore R9'; const b = \`A ${DOT} B\``, "a.ts"), ["R9"])
  })
  test("in a class name it does nothing", () => {
    assert.deepEqual(ids(`<p className="halation-ignore uppercase">A ${DOT} B</p>`, "a.tsx").sort(), ["R5", "R9"])
    assert.deepEqual(ids(`.halation-ignore R5 { text-transform: uppercase; }`, "a.css"), ["R5"])
  })
  test("a string that looks like a comment does nothing", () => assert.deepEqual(ids(`const a = "// halation-ignore R9 " + \`A ${DOT} B\``, "a.ts"), ["R9"]))
  test("a closed comment earlier on the line doesn't count", () => assert.deepEqual(ids(`/* note */ .halation-ignore-R5, .a { text-transform: uppercase; }`, "a.css"), ["R5"]))
  test("a glob in a string doesn't open a comment", () => assert.deepEqual(ids(`const g = "src/**/*.ts"\nconst x = "halation-ignore R9"\nconst y = \`A ${DOT} B\``, "a.ts"), ["R9"]))
  test("R21 itself can't be ignored", () => assert.deepEqual(ids(`// halation-ignore R21\n// halation-ignore\n`, "a.ts"), ["R21"]))
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
  put("package.json", "{}\n")
  for (const skipped of ["node_modules/pkg/x.tsx", "src/node_modules/pkg/x.tsx", "dist/x.tsx", ".next/x.tsx", "build/x.tsx", "vendor/x.css", ".git/x.tsx", ".claude/x.tsx", "src/.claude/x.tsx", "packages/ui/package.json", "packages/ui/dist/x.tsx"]) put(skipped, `<p className="text-sm" />`)
  put("other/x.min.css", `.a { text-transform: uppercase; }`)
  const linted = ["src/vendor/blatant.css", "src/build/x.tsx", "src/dist/x.tsx", "src/.x/hidden.tsx", "src/deep/out/x.tsx", ".storybook/preview.tsx", "packages/ui/src/vendor/x.tsx", "styles/theme.pcss", "styles/theme.postcss", "styles/a.less", "styles/a.sass", "styles/a.styl", "docs/page.mdx", "icons/i.svg"]
  put("src/vendor/blatant.css", `.a { text-transform: uppercase; }\n`)
  for (const f of linted.slice(1)) if (!f.startsWith("src/vendor")) put(f, f.endsWith(".svg") ? `<svg><path fill="#7c3aed" /></svg>` : f.endsWith(".tsx") || f.endsWith(".mdx") ? `<p className="text-sm" />` : `.a { color: #7c3aed; }`)
  const run = (...args) => spawnSync(process.execPath, [BIN, "lint", ...args], { cwd: dir, encoding: "utf8" })
  const rel = (files) => files.map((f) => path.relative(dir, f).split(path.sep).join("/")).sort()

  test("walks source and skips dependencies, git, Claude Code's files and build output at a package's top", () => {
    assert.deepEqual(rel(collectFiles(["."], { cwd: dir })), ["src/bad.tsx", "src/fine.tsx", "src/warn.tsx", ...linted].sort())
  })

  test("build folders inside src are linted, and so are other dot-folders", () => {
    const files = rel(collectFiles(["src"], { cwd: dir }))
    for (const f of ["src/vendor/blatant.css", "src/build/x.tsx", "src/dist/x.tsx", "src/.x/hidden.tsx", "src/deep/out/x.tsx"]) assert.ok(files.includes(f), f)
    assert.ok(!files.includes("src/.claude/x.tsx"))
    assert.ok(!files.includes("src/node_modules/pkg/x.tsx"))
  })

  test("a build folder directly in the folder being linted is skipped", () => {
    assert.deepEqual(rel(collectFiles(["other"], { cwd: dir })), [])
    put("loose/dist/x.tsx", `<p className="text-sm" />`)
    put("loose/src/dist/x.tsx", `<p className="text-sm" />`)
    assert.deepEqual(rel(collectFiles(["loose"], { cwd: dir })), ["loose/src/dist/x.tsx"])
  })

  test("reads .pcss and the other new file types", () => {
    const r = run("styles/theme.pcss", "icons/i.svg", "docs/page.mdx")
    assert.equal(r.status, 1)
    assert.match(r.stdout, /styles\/theme\.pcss:1:\d+ {2}R17/)
    assert.match(r.stdout, /icons\/i\.svg:1:\d+ {2}R17/)
    assert.match(r.stdout, /docs\/page\.mdx:1:\d+ {2}R7/)
  })

  test("lint src finds what's in src/vendor", () => {
    const r = run("src")
    assert.match(r.stdout, /src\/vendor\/blatant\.css:1:\d+ {2}R5/)
  })

  test("reports file:line:col, the rule and what it says, then why and instead once", () => {
    const r = run("src/bad.tsx", "src/warn.tsx", "src/fine.tsx")
    assert.equal(r.status, 1)
    assert.match(r.stdout, /^src\/bad\.tsx:1:38 {2}R7 {2}Eleven named text styles; no other sizes\./m)
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
    const r = run("src/bad.tsx", "src/warn.tsx", "src/fine.tsx", "--json")
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
