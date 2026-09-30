import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { canonSelector, canonValue, checkDeclaration, colorVector, extractHtml, formatGate, gate, gateCss, gateHtml, literalColors, loadOwnStyles, OwnStyles, parseCss } from "../src/gate.js"
import { corePath, loadRules } from "../src/rules.js"

const BIN = fileURLToPath(new URL("../bin/halation.js", import.meta.url))
const FIXTURE = fileURLToPath(new URL("./fixtures/tailwind-build/", import.meta.url))
const run = (args, cwd) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", cwd })

const temps = []
const temp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "halation-gate-"))
  temps.push(dir)
  return dir
}
after(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true })
})

/** The rule ids one declaration breaks. */
const broken = (prop, value, extra = {}) => checkDeclaration({ prop, value, ...extra }).sort()
const rulesOf = (css, own) => gateCss(css, { own }).map((f) => f.rule)

describe("parseCss", () => {
  test("reads selectors, properties, values and !important through comments and strings", () => {
    const d = parseCss(`/* a; b { c } */ .a, .b > p { color: red !important; content: "x; } {"; /* mid */ margin : 0 }`)
    assert.deepEqual(
      d.map((x) => [x.selector, x.prop, x.value, x.important]),
      [
        [".a, .b > p", "color", "red", true],
        [".a, .b > p", "content", '"x; } {"', false],
        [".a, .b > p", "margin", "0", false],
      ],
    )
  })
  test("custom properties may hold braces, and semicolons inside strings", () => {
    const d = parseCss(`:root { --x: { a: b; c: d }; --y: "semi;colon"; --z: [1;2]; color: var(--x) }`)
    assert.deepEqual(
      d.map((x) => [x.prop, x.value]),
      [
        ["--x", "{ a: b; c: d }"],
        ["--y", '"semi;colon"'],
        ["--z", "[1;2]"],
        ["color", "var(--x)"],
      ],
    )
  })
  test("nested at-rules keep their context; keyframes and descriptor blocks are marked", () => {
    const css = `@layer base { @media (min-width: 40rem) { @supports (display: grid) { @container (width > 1px) { @scope (.card) { @starting-style { .a { color: red } } } } } } }
@keyframes pulse { from { opacity: 0 } 50% { text-shadow: 0 0 4px red } }
@font-face { font-family: "Geist"; src: url(geist.woff2) }
@layer properties { @supports (x: y) { * { --tw-ring-offset-color: #fff } } }
@import "x.css"; @layer a, b;`
    const d = parseCss(css)
    assert.equal(d[0].at.length, 6)
    assert.equal(d[0].selector, ".a")
    assert.equal(d.find((x) => x.prop === "text-shadow").keyframes, true)
    assert.equal(d.find((x) => x.prop === "text-shadow").selector, "50%")
    assert.equal(d.find((x) => x.prop === "font-family").descriptors, true)
    assert.equal(d.find((x) => x.prop === "--tw-ring-offset-color").properties, true)
    assert.equal(d.length, 6)
  })
  test("escaped selectors, unquoted urls with semicolons, and nesting", () => {
    const d = parseCss(`.text-\\[13px\\] { font-size: 13px } .bg-\\[url\\(x\\;y\\)\\] { background: url(data:image/svg+xml;utf8,<svg fill='%23f00'>) } .card { padding: 8px; &:hover { color: red } .title { margin: 0 } }`)
    assert.deepEqual(
      d.map((x) => [x.selector, x.prop]),
      [
        [".text-\\[13px\\]", "font-size"],
        [".bg-\\[url\\(x\\;y\\)\\]", "background"],
        [".card", "padding"],
        [".card:hover", "color"],
        [".card .title", "margin"],
      ],
    )
  })
})

describe("extractHtml", () => {
  test("finds CSS style blocks and style attributes, and skips scripts and comments", () => {
    const html = `<!doctype html><html><head><style>.a{color:red}</style><style type="text/x-template">.b{color:red}</style>
<script>const s = '<p style="color:red">'</script><!-- <p style="color:red"> --></head>
<body><p class="x" style="color: &quot;#8b5cf6&quot;; padding: 13px">x</p><div data-x='a>b' style='margin:0'></div></body></html>`
    const { sheets, attrs } = extractHtml(html)
    assert.deepEqual(sheets.map((s) => s.text), [".a{color:red}"])
    assert.deepEqual(
      attrs.map((a) => [a.tag, a.text]),
      [
        ["p", 'color: "#8b5cf6"; padding: 13px'],
        ["div", "margin:0"],
      ],
    )
  })
  test("reports a style attribute with its tag and line", () => {
    const f = gateHtml(`<html>\n<body>\n  <p style="color:#8b5cf6">x</p>\n</body></html>`, { file: "index.html" })
    assert.equal(f.length, 1)
    assert.equal(f[0].rule, "R17")
    assert.equal(f[0].line, 3)
    assert.equal(f[0].selector, "a style attribute on <p>")
  })
})

describe("literal colors (R17)", () => {
  const fails = ["#8b5cf6", "#FFF", "#ffffff80", "rgb(1 2 3)", "rgba(0,0,0,.5)", "hsl(270 90% 60%)", "hwb(0 0% 0%)", "lab(50% 40 30)", "lch(50% 40 30)", "oklab(0.5 0.1 0)", "oklch(70% 0.2 300)", "color(display-p3 1 0 0)", "red", "rebeccapurple", "light-dark(#fff, #000)", "oklch(from #8b5cf6 l c h)"]
  for (const v of fails) test(`color: ${v} fails`, () => assert.deepEqual(broken("color", v), ["R17"]))
  const passes = ["transparent", "currentColor", "currentcolor", "inherit", "var(--color-fg)", "color-mix(in oklab, var(--color-accent) 20%, transparent)", "oklch(from var(--color-accent) l c h / 50%)", "#0000", "rgb(0 0 0 / 0)", "var(--color-fg, var(--color-fg-muted))"]
  for (const v of passes) test(`color: ${v} passes`, () => assert.deepEqual(broken("color", v), []))
  test("in shorthands and shadows too", () => {
    assert.deepEqual(broken("border", "1px solid #8b5cf6"), ["R17"])
    assert.deepEqual(broken("box-shadow", "0 0 0 1px red"), ["R17"])
    assert.deepEqual(broken("background", "url(#a) no-repeat, var(--color-surface)"), [])
  })
  test("a word that happens to be a color name isn't one outside color properties", () => {
    assert.deepEqual(broken("animation-name", "tan"), [])
    assert.deepEqual(broken("grid-area", "red"), [])
  })
  test("masks are exempt: black and white only mean opaque and clear there", () => {
    assert.deepEqual(broken("mask-image", "linear-gradient(black, transparent)"), [])
    assert.deepEqual(broken("-webkit-mask", "linear-gradient(#000, #0000)"), [])
  })
  test("custom properties: only a new color token, or Tailwind's own variables, are checked", () => {
    assert.deepEqual(broken("--color-brand", "#8b5cf6"), ["R17"])
    assert.deepEqual(broken("--color-brand", "var(--color-accent)"), [])
    assert.deepEqual(broken("--tw-gradient-from", "#8b5cf6"), ["R17"])
    assert.deepEqual(broken("--tw-ring-color", "oklch(70% 0.2 300)"), ["R17"])
    assert.deepEqual(broken("--tw-shadow", "0 0 #0000"), [])
    assert.deepEqual(broken("--tw-ring-offset-color", "#fff", { properties: true }), [])
    assert.deepEqual(broken("--anything", "#8b5cf6"), [])
  })
  test("a literal color given a name of its own still fails", () => {
    assert.deepEqual(rulesOf(`:root { --brand: #8b5cf6 } .x { color: var(--brand) }`), ["R17"])
    assert.deepEqual(rulesOf(`:root { --brand: #8b5cf6; --ink: var(--brand) } .x { border: 1px solid var(--ink) }`), ["R17"])
    assert.deepEqual(rulesOf(`:root { --glow: 0 0 12px red } .x { box-shadow: var(--glow) }`), ["R17"])
    assert.deepEqual(rulesOf(`:root { --brand: var(--color-accent) } .x { color: var(--brand) }`), [])
    assert.deepEqual(rulesOf(`.x { color: var(--nowhere) }`), [])
    // Halation's own definitions are trusted: --shadow-raised holds literals in tokens.css.
    const own = loadOwnStyles()
    const tokens = readFileSync(corePath("tokens.css"), "utf8")
    assert.deepEqual(gateCss(`${tokens}\n.x { box-shadow: var(--shadow-raised); color: var(--color-fg) }`, { own }), [])
    assert.deepEqual(rulesOf(`:root { --shadow-raised: 0 0 4px #f00 } .x { box-shadow: var(--shadow-raised) }`, own), ["R17"])
  })
  test("literalColors skips strings and urls", () => {
    assert.deepEqual(literalColors(`"#fff red" url(#abc) url("x.svg#red")`), [])
  })
})

describe("text sizes (R7)", () => {
  for (const v of ["13px", "0.8125rem", "1.5em", "80%", "small", "larger", "clamp(1rem, 2vw, 2rem)", "calc(var(--text-body) + 1px)", "min(var(--text-display-xl), 12vw)", "calc(var(--m-unit) * 12px)", "var(--undefined-size)"]) {
    test(`font-size: ${v} fails`, () => assert.deepEqual(broken("font-size", v), ["R7"]))
  }
  for (const v of ["var(--text-body)", "var(--text-display-xl)", "inherit", "1.06em", "1em", "100%", "0.9em", "120%", "calc(var(--text-body) * 1.1)", "var(--m-numeral)", "calc(var(--m-unit) * 1em)", "min(var(--text-display-xl), var(--m-fit))"]) {
    test(`font-size: ${v} passes`, () => assert.deepEqual(broken("font-size", v), []))
  }
  test("the font shorthand's size and family", () => {
    assert.deepEqual(broken("font", "500 13px/1.3 var(--font-sans)"), ["R7"])
    assert.deepEqual(broken("font", "italic 600 var(--text-body)/1.2 Inter, sans-serif"), ["R18"])
    assert.deepEqual(broken("font", "small-caps var(--text-body) var(--font-sans)"), ["R5"])
    assert.deepEqual(broken("font", "500 var(--text-caption)/1 var(--font-sans)"), [])
    assert.deepEqual(broken("font", "inherit"), [])
  })
  test("--text-* can't be redefined, except as Tailwind's echo of the token", () => {
    assert.deepEqual(broken("--text-body", "13px"), ["R7"])
    assert.deepEqual(broken("--text-body", "var(--text-body)"), [])
  })
})

describe("letter-spacing, case, glow, fonts, gradients", () => {
  test("R6", () => {
    for (const v of [".2em", "0.05em", "1px", "var(--tracking-wide)", "var(--tw-tracking, .1em)"]) assert.deepEqual(broken("letter-spacing", v), ["R6"], v)
    for (const v of ["0", "0em", "normal", "inherit", "var(--text-body--letter-spacing)", "var(--font-serif--letter-spacing)", "var(--tw-tracking, var(--text-body--letter-spacing))"]) assert.deepEqual(broken("letter-spacing", v), [], v)
    assert.deepEqual(broken("--tw-tracking", ".2em"), ["R6"])
  })
  test("R5", () => {
    assert.deepEqual(broken("text-transform", "uppercase"), ["R5"])
    assert.deepEqual(broken("text-transform", "capitalize"), [])
    assert.deepEqual(broken("font-variant-caps", "all-small-caps"), ["R5"])
    assert.deepEqual(broken("font-variant", "small-caps slashed-zero"), ["R5"])
  })
  test("R22", () => {
    assert.deepEqual(broken("text-shadow", "0 0 20px var(--color-accent)"), ["R22"])
    assert.deepEqual(broken("text-shadow", "none"), [])
  })
  test("R18, and @font-face is exempt", () => {
    assert.deepEqual(broken("font-family", "Inter, sans-serif"), ["R18"])
    assert.deepEqual(broken("font-family", "var(--font-sans), sans-serif"), ["R18"])
    assert.deepEqual(broken("font-family", "var(--font-mono)"), [])
    assert.deepEqual(broken("font-family", "var(--default-font-family, ui-sans-serif, system-ui)"), [])
    // A project sets its lens by defining the font tokens, but not with a default-look face first.
    assert.deepEqual(broken("--font-display", '"Anybody", var(--font-sans)'), [])
    assert.deepEqual(broken("--font-sans", '"Söhne", ui-sans-serif, system-ui'), [])
    for (const v of ["Inter, sans-serif", '"Helvetica Neue", Arial', "system-ui, sans-serif", "-apple-system, BlinkMacSystemFont", "'Open Sans'", "serif"]) assert.deepEqual(broken("--font-sans", v), ["R18"], v)
    assert.deepEqual(broken("--default-font-family", "Roboto"), ["R18"])
    assert.deepEqual(broken("--font-weight-medium", "500"), [])
    assert.deepEqual(rulesOf(`.x { --font-brand: Poppins } .y { font-family: var(--font-brand) }`), ["R18"])
    assert.deepEqual(rulesOf(`@font-face { font-family: "Geist"; src: url(g.woff2); font-size: 13px }`), [])
  })
  test("R3: only the project's light, or clear, may be a gradient's colors", () => {
    assert.deepEqual(broken("background-image", "linear-gradient(to right, #7c3aed, #db2777)"), ["R17", "R3"].sort())
    assert.deepEqual(broken("background-image", "linear-gradient(var(--tw-gradient-stops))"), ["R3"])
    assert.deepEqual(broken("background", "linear-gradient(90deg, var(--color-accent), transparent)"), ["R3"])
    assert.deepEqual(broken("background", "repeating-conic-gradient(from 0deg, var(--color-fg) 0 10%, transparent 0 20%)"), ["R3"])
    assert.deepEqual(broken("background", "radial-gradient(38% 100% at var(--x, 50%) 0%, var(--color-light-core), transparent 100%)"), [])
    assert.deepEqual(broken("background", "radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--color-light-core) 10%, transparent), transparent 42%)"), [])
    assert.deepEqual(broken("background", "linear-gradient(var(--color-halation) 1px, #0000 1px)"), [])
    assert.deepEqual(broken("mask-image", "linear-gradient(to bottom, var(--color-fg), transparent)"), [])
  })
  test("inside @keyframes, only gradients, glow and literal colors are checked", () => {
    const css = `@keyframes a { from { font-size: 13px; letter-spacing: .3em; padding: 13px; text-shadow: 0 0 4px var(--color-accent) } to { background: linear-gradient(var(--color-accent), transparent) } }`
    assert.deepEqual(rulesOf(css).sort(), ["R22", "R3"])
  })
})

describe("spacing (R24) and radii (R25)", () => {
  const pass = (prop, v) => assert.deepEqual(broken(prop, v), [], `${prop}: ${v}`)
  const fail = (prop, v, id) => assert.deepEqual(broken(prop, v), [id], `${prop}: ${v}`)
  test("the grid: 2 px steps to 24, then 4 px steps, and a 1 px hairline", () => {
    for (const v of ["0", "1px", "2px", "24px", "28px", "0 12px", "1rem", "0.75rem 1.5rem", "50%", "inherit", "var(--space-section)", "var(--spacing-gutter)", "var(--m-inset-x)", "calc(var(--m-inset-x) + 1px)"]) pass("padding", v)
    for (const v of ["13px", "3px", "1.5px", "26px", "0 5px", "0.8rem", "1em", "2vw", "clamp(16px, 4vw, 48px)", "var(--gutter)", "calc(100% - 13px)"]) fail("padding", v, "R24")
  })
  test("Tailwind's spacing: calc(var(--spacing) * N) with N in half steps, negative too", () => {
    for (const v of ["calc(var(--spacing) * 3)", "calc(var(--spacing) * 1.5)", "calc(var(--spacing) * -2)", "calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse))", "calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-x-reverse)))"]) pass("margin-block-start", v)
    fail("padding", "calc(var(--spacing) * 3.25)", "R24")
    fail("padding", "calc(var(--spacing) * 2 + 1px)", "R24")
  })
  test("margins may be auto or negative; gaps and longhands are checked; inset isn't", () => {
    for (const [p, v] of [["margin", "0 auto"], ["margin-top", "-8px"], ["margin-inline", "auto"], ["gap", "8px 16px"], ["row-gap", "normal"]]) pass(p, v)
    for (const [p, v] of [["margin", "-13px auto 0"], ["gap", "7px"], ["column-gap", "10.5px"], ["padding-inline-start", "3px"], ["margin-left", "5px"]]) fail(p, v, "R24")
    pass("inset", "13px")
    pass("top", "7px")
  })
  test("a var() passes when every definition of it does", () => {
    assert.deepEqual(rulesOf(`:root { --gutter: var(--space-gutter) } @media (min-width: 40rem) { :root { --gutter: 24px } } .a { padding-inline: var(--gutter) }`), [])
    assert.deepEqual(rulesOf(`:root { --gutter: var(--space-gutter) } @media (min-width: 40rem) { :root { --gutter: 13px } } .a { padding-inline: var(--gutter) }`), ["R24"])
    assert.deepEqual(rulesOf(`.a { padding: var(--undefined) }`), ["R24"])
    assert.deepEqual(rulesOf(`:root { --a: var(--b); --b: var(--a) } .a { margin: var(--a) }`), ["R24"])
    assert.deepEqual(rulesOf(`:root { --corner: var(--radius-lg) } .a { border-radius: var(--corner) }`), [])
    assert.deepEqual(rulesOf(`:root { --corner: 7px } .a { border-radius: var(--corner) }`), ["R25"])
    assert.deepEqual(rulesOf(`:root { --label: var(--text-caption) } .a { font-size: var(--label) }`), [])
    assert.deepEqual(rulesOf(`:root { --label: 11px } .a { font-size: var(--label) }`), ["R7"])
  })
  test("radii: the scale, a full pill, zero, or nested in a parent's", () => {
    for (const v of ["var(--radius-lg)", "9999px", "999px", "50%", "100%", "0", "var(--m-corner)", "calc(var(--radius-xl) - 5px)", "var(--radius-3xl) var(--radius-3xl) 0 0", "inherit"]) pass("border-radius", v)
    for (const v of ["7px", "0.5rem", "0 0 8px 8px", "30%", "var(--corner)", "20px / 10px"]) fail("border-radius", v, "R25")
    fail("border-top-left-radius", "3px", "R25")
    fail("--radius-lg", "7px", "R25")
    fail("--radius-lg", "var(--radius-md)", "R25")
    pass("--radius-lg", "var(--radius-lg)")
  })
})

describe("Halation's own styles", () => {
  const own = loadOwnStyles()
  const components = readFileSync(corePath("styles.css").replace(/styles\.css$/, "components.css"), "utf8")
  /** A crude minifier: every declaration of one selector as sel{prop:value}. */
  const minify = (decls) => decls.map((d) => `${d.selector.replace(/\s*,\s*/g, ",").replace(/"/g, "")}{${d.prop}:${d.value.replace(/\b0\.(\d)/g, ".$1").replace(/\s*,\s*/g, ",")}}`).join("")
  const button = parseCss(components).filter((d) => /^\.hl-button\b/.test(d.selector))

  test("the real .hl-button declarations pass, as written and minified", () => {
    assert.ok(button.length > 20)
    assert.ok(button.some((d) => checkDeclaration(d).length), "some .hl-button declarations only pass as Halation's own")
    assert.deepEqual(gateCss(components.slice(components.indexOf(".hl-button")), { own }).filter((f) => f.selector.startsWith(".hl-button")), [])
    assert.deepEqual(gateCss(minify(button), { own }), [])
  })
  test("a new declaration on an hl- class is checked like any other", () => {
    assert.deepEqual(rulesOf(".hl-button { color: #8b5cf6 }", own), ["R17"])
    assert.deepEqual(rulesOf(".hl-button { padding: 0 15px; font-size: 13px }", own).sort(), ["R24", "R7"].sort())
    assert.deepEqual(rulesOf(".hl-anything { color: #8b5cf6 }", own), ["R17"])
    // The same value on the same selector is Halation's own, whichever of them wrote it.
    assert.deepEqual(rulesOf(".hl-button { padding: 0 13px }", own), [])
    assert.deepEqual(rulesOf(":root { --color-accent: #8b5cf6 }", own), ["R17"])
  })
  test("a real declaration moved to another selector isn't Halation's anymore", () => {
    const d = button.find((x) => x.selector === ".hl-button" && checkDeclaration(x).length)
    assert.ok(d)
    assert.deepEqual(rulesOf(`.my-button { ${d.prop}: ${d.value} }`, own), checkDeclaration(d))
  })
  test("matching survives what minifiers do", () => {
    const o = new OwnStyles()
    o.addCss(`.a[data-x="y"], .b::before { background: oklch(100% 0 0); padding: 0 13px; color: light-dark(oklch(60% 0.2 30), oklch(60% 0.2 30)); transition: color 900ms; letter-spacing: -0.01em; background-image: linear-gradient(to bottom, oklch(62% 0.2 28 / 16%) 1px, transparent 1px) }`, "test")
    const has = (sel, prop, value) => o.has(sel, prop, value)
    assert.ok(has(".b:before,.a[data-x=y]", "background", "#fff"))
    assert.ok(has(".a[data-x=y]", "background", "oklch(100% 0 0)"))
    assert.ok(has(".a[data-x=y]", "padding-left", "13px"))
    assert.ok(has(".a[data-x=y]", "padding", "0px 13px 0 13px"))
    assert.ok(has(".a[data-x=y]", "color", "oklch(60% .2 30)"))
    assert.ok(has(".a[data-x=y]", "letter-spacing", "-.01em"))
    assert.ok(has(".a[data-x=y]", "background-image", "linear-gradient(#e6443a29 1px,#0000 1px)"))
    assert.ok(!has(".a[data-x=y]", "background", "#8b5cf6"))
    assert.ok(!has(".a[data-x=y]", "padding", "0 14px"))
    assert.ok(!has(".a[data-x=y],.c", "background", "#fff"))
    assert.ok(!has(".c", "background", "#fff"))
  })
  test("canonical forms", () => {
    assert.equal(canonSelector(`.a  >  .b[data-x='y']::after`), ".a>.b[data-x=y]:after")
    assert.equal(canonValue("0.50em  0PX").key, canonValue(".5em 0").key)
    assert.equal(canonValue("var(--lightningcss-light,#fff)var(--lightningcss-dark,#000)").key, canonValue("light-dark(#fff, #000)").key)
    assert.ok(colorVector("#ffffff").every((v, i) => Math.abs(v - colorVector("oklch(100% 0 0)")[i]) < 0.002))
    assert.ok(colorVector("color(display-p3 1 1 1)").every((v, i) => Math.abs(v - colorVector("lab(100% 0 0)")[i]) < 0.002))
  })
})

describe("a real Tailwind build", () => {
  // Built once with Vite 8 and @tailwindcss/vite 4.3.3 from the pages in source.html.txt,
  // with core-css as the installed @halation/core. That snapshot is what counts as
  // Halation's own here, so the fixture stays valid as the core's CSS changes.
  const own = new OwnStyles()
  for (const f of readdirSync(path.join(FIXTURE, "core-css"))) own.addCss(readFileSync(path.join(FIXTURE, "core-css", f), "utf8"), f)
  // Tailwind's preflight, which a project with Tailwind installed has on disk.
  own.add("small", "font-size", "80%")
  own.add("sub,sup", "font-size", "75%")

  test("the clean page passes the gate", () => {
    const r = gate(["clean"], { cwd: FIXTURE, own })
    assert.equal(r.files, 2)
    assert.deepEqual(r.findings, [])
  })
  test("each leak fails with its rule", () => {
    const r = gate(["leaks"], { cwd: FIXTURE, own })
    const at = (selector) => r.findings.filter((f) => f.selector === selector).map((f) => f.rule).sort()
    assert.deepEqual(at(".text-\\[13px\\]"), ["R7"])
    assert.deepEqual(at(".bg-\\[\\#8b5cf6\\]"), ["R17"])
    assert.deepEqual(at(".tracking-\\[\\.2em\\]"), ["R6", "R6"])
    assert.deepEqual(at(".p-\\[13px\\]"), ["R24"])
    assert.deepEqual(at(".rounded-\\[7px\\]"), ["R25"])
    assert.deepEqual(at(".uppercase"), ["R5"])
    assert.deepEqual(at(".\\[text-shadow\\:0_0_20px_red\\]"), ["R17", "R22"])
    assert.deepEqual(at(".bg-linear-to-r"), ["R3"])
    assert.deepEqual(at(".from-\\[\\#8b5cf6\\]"), ["R17"])
    assert.deepEqual(at(".font-\\[Inter\\]"), ["R18"])
    assert.deepEqual(at("a style attribute on <p>"), ["R17"])
    const covered = new Set([".text-\\[13px\\]", ".bg-\\[\\#8b5cf6\\]", ".tracking-\\[\\.2em\\]", ".p-\\[13px\\]", ".rounded-\\[7px\\]", ".uppercase", ".\\[text-shadow\\:0_0_20px_red\\]", ".bg-linear-to-r", ".from-\\[\\#8b5cf6\\]", ".to-\\[\\#ec4899\\]", ".font-\\[Inter\\]", "a style attribute on <p>"])
    assert.deepEqual(r.findings.filter((f) => !covered.has(f.selector)), [])
  })
  test("without Halation's own styles to compare with, its literals would fail", () => {
    const r = gate(["clean"], { cwd: FIXTURE, own: new OwnStyles() })
    assert.ok(r.findings.some((f) => f.selector.startsWith(":root") && f.rule === "R17"))
  })
})

/** Resolves a package the docs app or its build tools depend on, or null. */
function resolveFromWorkspace(name, via = []) {
  const docs = fileURLToPath(new URL("../../../apps/docs/package.json", import.meta.url))
  try {
    let from = docs
    for (const step of via) from = createRequire(from).resolve(`${step}/package.json`)
    return createRequire(from).resolve(name)
  } catch {
    return null
  }
}

describe("current core CSS through a real minifier", () => {
  const lightningcss = resolveFromWorkspace("lightningcss", ["vite"])
  test("passes the gate at modern and older browser targets", { skip: !lightningcss && "lightningcss isn't installed in this workspace" }, async () => {
    const { transform } = await import(pathToFileURL(lightningcss).href)
    const own = loadOwnStyles()
    const dir = path.dirname(corePath("tokens.css"))
    for (const targets of [{}, { chrome: 90 << 16, safari: 14 << 16 }, { chrome: 120 << 16, safari: 17 << 16, firefox: 120 << 16 }]) {
      for (const f of readdirSync(dir).filter((n) => n.endsWith(".css") && n !== "tailwind.css" && n !== "styles.css")) {
        const { code } = transform({ filename: f, code: readFileSync(path.join(dir, f)), minify: true, targets })
        assert.deepEqual(gateCss(code.toString(), { own, file: f }), [], `${f} at ${JSON.stringify(targets)}`)
      }
    }
  })
})

describe("a real Vite build", () => {
  const vite = resolveFromWorkspace("vite")
  test("Halation's styles pass, and leaks in CSS and HTML fail", { skip: !vite && "vite isn't installed in this workspace" }, async () => {
    const { build } = await import(pathToFileURL(vite).href)
    const root = temp()
    mkdirSync(path.join(root, "node_modules", "@halation"), { recursive: true })
    symlinkSync(path.dirname(path.dirname(corePath("tokens.css"))), path.join(root, "node_modules", "@halation", "core"), "dir")
    writeFileSync(path.join(root, "package.json"), `{ "name": "gate-e2e", "private": true, "type": "module" }`)
    writeFileSync(path.join(root, "main.js"), `import "@halation/core/styles.css"\nimport "./app.css"\n`)
    writeFileSync(path.join(root, "app.css"), `.page { padding: calc(var(--spacing) * 6); color: var(--color-fg) }\n.tag { font-size: 13px; letter-spacing: .08em; text-transform: uppercase }\n`)
    writeFileSync(
      path.join(root, "index.html"),
      `<!doctype html><html><head><script type="module" src="/main.js"></script></head><body><main class="page"><p class="hl-text-body" style="color: #8b5cf6">x</p></main></body></html>`,
    )
    await build({ root, logLevel: "silent", configFile: false, build: { outDir: "dist" } })
    const r = gate([], { cwd: root })
    assert.deepEqual(r.dirs, ["dist"])
    assert.equal(r.files, 2)
    assert.deepEqual(
      r.findings.map((f) => [f.selector, f.rule]).sort(),
      [
        [".tag", "R5"],
        [".tag", "R6"],
        [".tag", "R7"],
        ["a style attribute on <p>", "R17"],
      ].sort(),
    )
  })
})

describe("counterexamples", () => {
  const css = `[data-counterexample] .spec { text-transform: uppercase; color: #fff } .spec[data-counterexample], [data-counterexample]>p { font-size: 13px } .a, [data-counterexample] .b { letter-spacing: .2em } .c { color: var(--color-fg) }`
  test("with the flag, rules entirely inside a counterexample are skipped and counted", () => {
    const exempted = { counterexamples: 0 }
    assert.deepEqual(gateCss(css, { counterexamples: true, exempted }).map((f) => f.selector), [".a, [data-counterexample] .b"])
    assert.equal(exempted.counterexamples, 3)
    const html = gateHtml(`<div data-counterexample style="color:#f00"></div><p style="color:#f00"></p>`, { counterexamples: true, exempted })
    assert.deepEqual(html.map((f) => f.selector), ["a style attribute on <p>"])
    assert.equal(exempted.counterexamples, 4)
  })
  test("without it, they're checked like anything else", () => {
    assert.deepEqual(gateCss(css).map((f) => f.rule).sort(), ["R17", "R5", "R6", "R7"].sort())
  })
  test("the command takes --allow-counterexamples and reports what it exempted", () => {
    const root = temp()
    mkdirSync(path.join(root, "dist"))
    writeFileSync(path.join(root, "dist", "a.css"), `[data-counterexample] .x{text-transform:uppercase}`)
    const plain = run(["gate"], root)
    assert.equal(plain.status, 1)
    const allowed = run(["gate", "--allow-counterexamples"], root)
    assert.equal(allowed.status, 0)
    assert.equal(allowed.stdout, "No problems in 1 built file in dist.\n\nExempted, and counted\n  1 declaration in counterexamples breaks a rule, allowed by --allow-counterexamples.\n")
    assert.equal(JSON.parse(run(["gate", "--json", "--allow-counterexamples"], root).stdout).exempted.counterexamples, 1)
  })
})

describe("halation gate", () => {
  test("reads the first build folder that exists, exits 1 with a report", () => {
    const root = temp()
    mkdirSync(path.join(root, "build", "static"), { recursive: true })
    writeFileSync(path.join(root, "build", "static", "app.css"), `.a{color:var(--color-fg)}\n.b{font-size:13px}`)
    const r = run(["gate"], root)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /^build\/static\/app\.css\n {2}2:4 {2}R7 {2}Eleven named text styles; no other sizes\. Found "font-size: 13px" in \.b\.\n/)
    assert.match(r.stdout, /R7: Eleven named text styles/)
    assert.match(r.stdout, /Found 1 problem in 1 file, out of 1 built file in build\./)
  })
  test("exits 0 when nothing breaks a rule", () => {
    const root = temp()
    mkdirSync(path.join(root, "out"))
    writeFileSync(path.join(root, "out", "a.css"), `.a{color:var(--color-fg);padding:calc(var(--spacing) * 4)}`)
    const r = run(["gate", "out"], root)
    assert.equal(r.status, 0)
    assert.equal(r.stdout, "No problems in 1 built file in out.\n")
  })
  test("--json", () => {
    const root = temp()
    mkdirSync(path.join(root, "dist"))
    writeFileSync(path.join(root, "dist", "index.html"), `<p style="letter-spacing:.2em">x</p>`)
    const r = run(["gate", "--json"], root)
    assert.equal(r.status, 1)
    const j = JSON.parse(r.stdout)
    assert.equal(j.files, 1)
    assert.equal(j.errors, 1)
    assert.equal(j.findings[0].rule, "R6")
    assert.equal(j.findings[0].property, "letter-spacing")
    assert.equal(j.rules.R6.slug, "no-tracking")
  })
  test("with no build output, or nothing in it, it says so and exits 1", () => {
    const root = temp()
    const none = run(["gate"], root)
    assert.equal(none.status, 1)
    assert.match(none.stderr, /There's no build output to read: none of dist, build, out, \.next\/static or \.output\/public is here\./)
    mkdirSync(path.join(root, "dist"))
    const empty = run(["gate"], root)
    assert.equal(empty.status, 1)
    assert.match(empty.stderr, /There were no \.css or \.html files in dist to read\./)
    assert.match(run(["gate", "nope"], root).stderr, /There's no file or folder at nope\./)
  })
  test("help", () => {
    const r = run(["gate", "--help"])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /Usage: halation gate \[dirs\.\.\.\] \[--json\]/)
    assert.match(run(["--help"]).stdout, /^ {2}gate \[dirs\.\.\.\] {4}Check what a build emitted/m)
  })
  test("the gate's own words keep the rules", () => {
    const root = temp()
    mkdirSync(path.join(root, "dist"))
    writeFileSync(path.join(root, "dist", "a.css"), `.a{font-size:13px;color:red;text-transform:uppercase;letter-spacing:1px;padding:13px;border-radius:7px;font-family:Inter;text-shadow:0 0 1px red;background:linear-gradient(red,blue)}`)
    const text = [run(["gate", "--help"]), run(["gate"], root), run(["gate"], temp())].map((r) => r.stdout + r.stderr).join("\n")
    assert.doesNotMatch(text, /\s[·•]\s/)
    const shouting = (text.match(/\b[A-Z]{3,}\b/g) ?? []).filter((w) => !["JSON", "CSS", "HTML"].includes(w))
    assert.deepEqual(shouting, [])
  })
  test("formatGate lists each file once, then its findings", () => {
    const rules = loadRules()
    const findings = [
      { file: "a.css", line: 1, column: 2, rule: "R7", says: "x", selector: ".a", found: "font-size: 1px" },
      { file: "a.css", line: 1, column: 9, rule: "R17", says: "y", selector: ".b", found: "color: red" },
      { file: "b.html", line: 3, column: 1, rule: "R17", says: "y", selector: "a style attribute on <p>", found: "color: red" },
    ]
    const out = formatGate({ dirs: ["dist"], files: 2, findings }, rules)
    assert.match(out, /^a\.css\n {2}1:2 {2}R7 {2}x Found "font-size: 1px" in \.a\.\n {2}1:9 {2}R17 {2}y Found "color: red" in \.b\.\n\nb\.html\n {2}3:1/)
  })
})

describe("the lock comes first (R27)", () => {
  test("a stylesheet whose first layer is the lock passes", () => {
    const text = "@layer halation-lock;\n@layer theme, base, components, utilities;\n@layer halation-lock { .x { text-transform: none !important; } }"
    assert.deepEqual(gateCss(text).filter((f) => f.rule === "R27"), [])
  })
  test("a layer declared before the lock is refused, where it's declared", () => {
    const text = "/* a reset */\n@layer reset, base;\n@layer halation-lock;\n@layer halation-lock { .x { text-transform: none !important; } }"
    const found = gateCss(text).filter((f) => f.rule === "R27")
    assert.equal(found.length, 1)
    assert.equal(found[0].line, 2)
    assert.match(found[0].found, /reset, base comes before halation-lock/)
  })
  test("a layer from an import counts too", () => {
    const text = '@import "./reset.css" layer(reset);\n@layer halation-lock;'
    assert.equal(gateCss(text).filter((f) => f.rule === "R27").length, 1)
  })
  test("a stylesheet without the lock isn't judged on order", () => {
    assert.deepEqual(gateCss("@layer reset;\n.a { color: var(--color-fg); }").filter((f) => f.rule === "R27"), [])
  })
})
