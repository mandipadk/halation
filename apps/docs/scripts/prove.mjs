// Proves the built site before it ships: serves dist, runs the page check on
// every page in both modes at both widths, and writes proof.json and its seal,
// proof.svg, into dist. Exits 1, and so stops the deploy, if a page broke a rule.
// With HALATION_PROOF_KEY set to an SSH key (or its .pub, with the key in an
// agent), the proof is signed too.

import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { formatProof, prove } from "../../../packages/cli/src/proof.js"

const PAGES = ["/", "/start", "/foundations", "/components", "/phenomena", "/motion", "/signature", "/rules", "/specimens"]
const PORT = 4174
const docs = fileURLToPath(new URL("..", import.meta.url))

const server = spawn("pnpm", ["exec", "vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: docs, stdio: ["ignore", "ignore", "inherit"] })
const base = `http://localhost:${PORT}`
let code = 1
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break
    } catch {}
    if (i > 100) throw new Error("The preview server didn't start.")
    await new Promise((r) => setTimeout(r, 100))
  }
  const made = await prove(PAGES.map((p) => base + p), { out: "dist/proof.json", name: "Halation", counterexamples: true, sign: process.env.HALATION_PROOF_KEY, cwd: docs })
  process.stdout.write(formatProof(made, docs, { unsigned: "Not signed. Set HALATION_PROOF_KEY to an SSH key to sign it." }))
  code = made.proof.pass ? 0 : 1
} catch (e) {
  process.stderr.write(`${e.message}\n`)
} finally {
  server.kill()
}
process.exit(code)
