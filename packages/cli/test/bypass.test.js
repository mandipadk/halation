// Every known way past the rendered check, kept: each is a page the check
// must fail. A newly found bypass gets a page here too.

import assert from "node:assert/strict"
import { createServer } from "node:http"
import { after, before, describe, test } from "node:test"
import { checkUrl } from "../src/check.js"

const DOT = "·"
const TOKENS = `:root { --color-accent: #ff6b3d; --color-ink: #f5f5f4; --color-positive: #3fbf7f; --color-warning: #e0a13a; --color-critical: #e5484d; --color-light-core: #fbf3ec; --color-light-edge: #f0b89a; --color-halation: #f06a3c; }
body { margin: 0; padding: 32px; background: #0b0b0b; color: #f5f5f4; font-family: Georgia, serif; font-size: 16px; }`
const page = (body, css = "") => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${TOKENS}${css}</style></head><body>${body}</body></html>`
const words = "<p>Every copy keeps its own accounts, settings and history.</p><p>Open any copy from the menu bar.</p><p>Size</p><p>412 MB</p>"

// The halation phenomenon's own filter, as its script installs it.
const HALATION = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="hl-halation" x="-40%" y="-120%" width="180%" height="340%" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.62 1.2 0.22 0 -1.2" result="bright"/><feGaussianBlur in="bright" stdDeviation="2.4" result="near"/><feGaussianBlur in="bright" stdDeviation="18" result="far"/><feFlood style="flood-color:var(--color-halation)" result="coreColor"/><feComposite in="coreColor" in2="near" operator="in" result="coreGlow"/><feFlood style="flood-color:var(--color-halation)" result="edgeColor"/><feComposite in="edgeColor" in2="far" operator="in" result="edgeGlow"/><feMerge><feMergeNode in="edgeGlow"/><feMergeNode in="coreGlow"/><feMergeNode in="SourceGraphic"/></feMerge></filter></svg>`

// [path, what it tries, the rule it must break, the page]
const BYPASSES = [
  ["/pseudo-eyebrow", "an uppercase, letter-spaced eyebrow drawn in ::before", "R5", page(`<h2 class="e">Features</h2>${words}`, `.e::before { content: "Introducing"; display: block; text-transform: uppercase; letter-spacing: 0.3em; font-size: 12px; }`)],
  ["/text-glow", "glowing headline text", "R22", page(`<h1 style="text-shadow: 0 0 24px #ff6b3d">Supercharge your workflow</h1>${words}`)],
  ["/dot-pill", "a 12px status dot in a tinted pill", "R10", page(`${words}<span style="display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:999px;background:rgb(34 197 94 / 15%);color:#4ade80"><i style="width:12px;height:12px;border-radius:50%;background:#22c55e"></i>Active</span>`)],
  ["/span-dots", "a separator in its own span", "R9", page(`${words}<p><span>No card needed</span><span> ${DOT} </span><span>Cancel anytime</span></p>`)],
  ["/entity-dots", "&nbsp;&middot;&nbsp; between facts", "R9", page(`${words}<p>14-day trial&nbsp;&middot;&nbsp;SOC 2</p>`)],
  ["/pseudo-dots", "dots added with ::after", "R9", page(`${words}<p><span class="f">Fast</span><span class="f">Secure</span></p>`, `.f::after { content: " ${DOT} "; }`)],
  ["/second-accent", "a purple accent set on one section", "R1", page(`${words}<section style="--color-accent:#8b5cf6" data-accent="violet"><button style="background:var(--color-accent);color:#fff;padding:12px 20px;border:0">Book a demo</button></section>`)],
  ["/purple", "purple text", "R1", page(`${words}<p style="color:#a78bfa">AI-powered insights</p>`)],
  ["/custom-ink", "three main buttons that aren't Halation's", "budget", page(`${words}<div><button class="b">Get started</button><button class="b">Book a demo</button><a class="b" href="#">Watch video</a></div>`, `.b { background: #f5f5f4; color: #111; padding: 12px 20px; border: 0; display: inline-block; }`)],
  ["/loop", "a pulse that never stops", "R14", page(`${words}<span class="p">Live</span>`, `.p { display: inline-block; animation: pulse 1s infinite; } @keyframes pulse { 50% { opacity: 0.5; } }`)],
  ["/late", "a transition that waits a second to start", "R14", page(`${words}<a href="#" style="transition: color 200ms ease 1s">Learn more</a>`)],
  ["/slow-glow", "a glow that takes 2.5 s", "R14", page(`${words}<div style="padding:20px;transition: box-shadow 2500ms ease">Card</div>`)],
  ["/counterexample", "slop wrapped in data-counterexample", "R5", page(`${words}<div data-counterexample><p style="text-transform:uppercase;letter-spacing:.2em">Trusted by teams</p></div>`)],
  ["/fake-phenomenon", "a gradient inside a fake phenomenon", "R3", page(`<section data-phenomenon="rays"><h1 style="background:linear-gradient(90deg,#8b5cf6,#ec4899);-webkit-background-clip:text;color:transparent">Welcome</h1></section>${words}`)],
  ["/fake-edge", "a gradient borrowing the lit edge's class", "R3", page(`${words}<div class="hl-lit-edge" style="height:200px;background:linear-gradient(#8b5cf6,#ec4899)"></div>`)],
  ["/paint-layer", "a purple glow on a layer that takes no clicks", "R3", page(`${words}<div class="glow"></div>`, `.glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle, #8b5cf6, transparent 60%); }`)],
  ["/gradient-border", "a gradient border", "R3", page(`${words}<div style="border:2px solid;border-image:linear-gradient(90deg,#8b5cf6,#f59e0b) 1;padding:20px">Intelligent automation</div>`)],
  ["/faint-text", "text faded to 20% so contrast isn't measured", "R4", page(`${words}<p style="color:rgb(245 245 244 / 20%)">No credit card required</p>`)],
  ["/faded-parent", "text faded by its parent's opacity", "R4", page(`${words}<div style="opacity:0.2"><p>Cancel anytime</p></div>`)],
  ["/hidden-faint", "faint text hidden from screen readers so contrast isn't measured", "R4", page(`${words}<p aria-hidden="true" style="color:rgb(245 245 244 / 25%)">Cancel anytime</p>`)],
  ["/loose-mono", "monospace stats claiming to be a surface", "R11", page(`${words}<div data-surface><p style="font-family:Menlo,monospace">uptime_sla // last_90d</p></div>`)],
  ["/shadow-dom", "an eyebrow inside a shadow root", "R5", page(`${words}<x-eyebrow></x-eyebrow><script>customElements.define("x-eyebrow", class extends HTMLElement { connectedCallback() { this.attachShadow({ mode: "open" }).innerHTML = '<p style="text-transform:uppercase">New release</p>' } })</script>`)],
  ["/iframe", "dots inside an iframe", "R9", page(`${words}<iframe srcdoc="<p>Fast ${DOT} Secure</p>"></iframe>`)],
  ["/late-content", "slop added after the page loads", "R5", page(`${words}<div id="x"></div><script>setTimeout(() => { document.getElementById("x").innerHTML = '<p style="text-transform:uppercase">Limited offer</p>' }, 800)</script>`)],
  ["/cloak", "a page that shows the checker something clean", "R5", page(`${words}<div id="x"></div><script>if (!navigator.webdriver && !/Headless/.test(navigator.userAgent)) document.getElementById("x").innerHTML = '<p style="text-transform:uppercase">Introducing Nexus</p>'</script>`)],
  ["/too-wide", "a row wider than a phone", "R23", page(`${words}<div style="width:1400px">Enterprise-grade security, global scale, lightning fast</div>`)],
  ["/light-dark-accent", "a second accent written as light-dark()", "R1", page(`${words}<section style="--color-accent: light-dark(#0f9fb0, #19b8c9)" data-accent="teal"><button style="background:var(--color-accent);color:#111;padding:12px 20px;border:0">Book a demo</button></section>`, `:root { color-scheme: light dark; --color-accent: light-dark(#e2562b, #ff6b3d); }`)],
  ["/svg-glow", "a glow drawn by an SVG filter on the headline", "R22", page(`${words}<svg width="0" height="0"><filter id="g"><feGaussianBlur stdDeviation="6"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></svg><h1 style="filter:url(#g)">Supercharge your workflow</h1>`)],
  ["/parent-glow", "a colored drop-shadow on the text's parent", "R22", page(`${words}<div style="filter:drop-shadow(0 0 12px #ff6b3d)"><h1>Supercharge your workflow</h1></div>`)],
  ["/fake-halation", "a purple glow wearing the halation filter's name", "R22", page(`${words}<svg width="0" height="0"><filter id="hl-halation"><feGaussianBlur stdDeviation="8"/><feFlood flood-color="#8b5cf6"/></filter></svg><section class="hl-halated" style="filter:url(#hl-halation)"><h1>Supercharge your workflow</h1></section>`)],
  ["/halation-twice", "the real halation bloom on two parts of one page", "R22", page(`${words}${HALATION}<section style="filter:url(#hl-halation)"><h1>Shot on film</h1></section><section style="filter:url(#hl-halation)"><h2>Developed tonight</h2></section>`)],
  ["/halation-light", "the real halation bloom on a light page", "R22", page(`${words}${HALATION}<section style="filter:url(#hl-halation);background:#f7f6f4;color:#111;padding:24px"><h1>Shot on film</h1></section>`)],
  ["/blank", "a blank page", "empty", page(``)],
  ["/crash", "a page that throws", "error", page(`${words}<script>null.boom()</script>`)],
]

// Pages the check must pass, so it never blocks good work.
const CLEAN = {
  // Light is allowed: a sheen of the light's own colors, on a layer that takes no clicks.
  "/clean": page(`<h1>Every app, twice</h1>${words}<button style="background:#f5f5f4;color:#111;padding:12px 20px;border:0">Download</button><div class="sheen"></div>`, `.sheen { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 30% 20%, rgb(251 243 236 / 12%), transparent 45%); }`),
  // The halation phenomenon's bloom, once, on a dark ground; and a card's dark shadow.
  "/clean-halation": page(`<h1>Every app, twice</h1>${words}${HALATION}<section style="filter:url(#hl-halation)"><h2>Shot on film</h2></section><div style="filter:drop-shadow(0 8px 24px rgb(0 0 0 / 60%));padding:20px"><p>A card with a real shadow.</p></div>`),
  // An app as it's really built: tokens written as light-dark(), content rendered by script
  // after load, and a section that rises into view only once it's scrolled to.
  "/clean-app": page(
    `<div id="app"></div><script>setTimeout(() => {
      document.getElementById("app").innerHTML = '<h1>Every app, twice</h1>${words}<div style="height:1600px"></div><div id="rise"><h2>Separate by default</h2><p style="color:var(--color-accent)">New in 1.0</p><button class="go">Download</button></div>'
      const items = document.querySelectorAll("#rise > *")
      items.forEach((i) => (i.style.opacity = "0.1"))
      const watch = new IntersectionObserver(([e]) => { if (e.isIntersecting) { items.forEach((i) => (i.style.opacity = "")); watch.disconnect() } }, { threshold: 0.2 })
      watch.observe(document.getElementById("rise"))
    }, 300)</script>`,
    `:root { color-scheme: light dark; --color-accent: light-dark(#e2562b, #ff6b3d); --color-ink: light-dark(#111, #f5f5f4); --color-light-core: light-dark(#fff8f2, #fbf3ec); }
    .go { background: var(--color-ink); color: #111; padding: 12px 20px; border: 0; }`,
  ),
}

let playwright = true
try {
  await import("playwright-core")
} catch {
  playwright = false
}

describe("known bypasses all fail", { skip: !playwright && "playwright-core isn't installed" }, () => {
  let server
  let base
  before(async () => {
    const pages = Object.fromEntries([...BYPASSES.map(([p, , , html]) => [p, html]), ...Object.entries(CLEAN)])
    server = createServer((req, res) => {
      const html = pages[req.url]
      res.writeHead(html ? 200 : 404, { "content-type": "text/html; charset=utf-8" })
      res.end(html ?? "Not found")
    })
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(() => server?.close())

  const run = async (t, path, widths = [1280]) => {
    try {
      return await checkUrl(`${base}${path}`, { modes: ["dark"], widths })
    } catch (e) {
      if (/Couldn't start a browser/.test(e.message)) t.skip(e.message)
      else throw e
    }
  }

  for (const path of Object.keys(CLEAN)) {
    test(`${path} passes, at both widths`, async (t) => {
      const result = await run(t, path, [1280, 375])
      if (!result) return
      const broken = result.runs.flatMap((r) => [...r.rules.filter((x) => !x.pass).map((x) => `${x.id} ${x.examples.join(" ")}`), ...r.budgets.filter((b) => !b.pass).map((b) => `${b.name}: ${b.value}`)])
      assert.deepEqual(broken, [])
      assert.ok(result.pass)
    })
  }

  for (const [path, tries, rule] of BYPASSES) {
    test(`${tries} fails ${rule}`, async (t) => {
      const result = await run(t, path, path === "/too-wide" ? [375] : [1280])
      if (!result) return
      assert.equal(result.pass, false, `${path} passed`)
      const run0 = result.runs[0]
      if (rule === "budget") assert.ok(run0.budgets.some((b) => !b.pass))
      else if (rule === "empty") assert.ok(run0.elements < 5)
      else if (rule === "error") assert.ok(run0.errors.length > 0)
      else assert.equal(run0.rules.find((r) => r.id === rule)?.pass, false, `${rule} kept: ${JSON.stringify(run0.rules.filter((r) => !r.pass).map((r) => r.id))}`)
    })
  }

  test("counterexamples are allowed only when asked, and counted", async (t) => {
    let result
    try {
      result = await checkUrl(`${base}/counterexample`, { modes: ["dark"], widths: [1280], counterexamples: true })
    } catch (e) {
      if (/Couldn't start a browser/.test(e.message)) return t.skip(e.message)
      throw e
    }
    assert.equal(result.runs[0].rules.find((r) => r.id === "R5").pass, true)
    assert.ok(result.runs[0].exempted.counterexamples > 0)
  })
})
