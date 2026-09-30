// `halation proof`: checks a site's pages and writes what it found as a
// certificate anyone can read and verify. The proof names the rulebook and
// the checker it used by their hashes, lists every page in every mode and
// width, and carries an id that is the hash of all of it, so a changed
// result no longer matches its id. With an SSH key, it's signed too.

import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { sealSvg } from "@halation/core/signature"
import { checkerSource, checkUrl } from "./check.js"
import { loadRules } from "./rules.js"

const NAMESPACE = "halation-proof"
const sha256 = (text) => createHash("sha256").update(text).digest("hex")

/** Object keys in a fixed order, so the same proof always hashes the same. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`
  return JSON.stringify(value)
}

function versions() {
  const require = createRequire(import.meta.url)
  const cli = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")).version
  let core = null
  try {
    core = JSON.parse(readFileSync(require.resolve("@halation/core/package.json"), "utf8")).version
  } catch {}
  return { cli, core }
}

/** A proof from page check results. Everything in it is covered by its id. */
export function makeProof(results, { name, modes, widths, at = new Date() } = {}) {
  const rules = loadRules()
  const body = {
    proof: 1,
    name: name ?? new URL(results[0]?.url ?? "http://site").host,
    checkedAt: at.toISOString(),
    versions: versions(),
    rulebook: { rules: rules.length, sha256: sha256(canonical(rules)) },
    checker: { sha256: sha256(checkerSource()) },
    matrix: { modes, widths },
    measured: results[0]?.runs?.[0]?.rules.map((x) => x.id) ?? [],
    pages: results.map((r) => ({
      url: r.url,
      pass: r.pass,
      runs: r.runs.map((run) => ({
        mode: run.mode,
        width: run.width,
        pass: run.rules.every((x) => x.pass) && run.budgets.every((b) => b.pass) && !run.errors?.length,
        broken: run.rules.filter((x) => !x.pass).map((x) => ({ id: x.id, count: x.count, examples: x.examples })),
        budgets: run.budgets.map((b) => ({ name: b.name, value: b.value, limit: b.limit })),
        exempted: run.exempted,
        elements: run.elements,
      })),
    })),
  }
  body.pass = body.pages.every((p) => p.pass)
  return { ...body, id: sha256(canonical(body)) }
}

/** Whether a proof's content still matches its id. */
export function intact(proof) {
  const { id, ...body } = proof
  return typeof id === "string" && id === sha256(canonical(body))
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`

/** The proof's seal as a small SVG: the site's own seal, what was proven, and the proof's short id. */
export function proofSvg(proof) {
  const pages = proof.pages.length
  const modes = proof.matrix.modes.length === 2 ? "Light and dark" : `${proof.matrix.modes[0][0].toUpperCase()}${proof.matrix.modes[0].slice(1)} mode`
  const widths = proof.matrix.widths.map((w) => `${w}`).join(" and ")
  const title = proof.pass ? "Proven by Halation" : "Checked by Halation"
  const line = proof.pass ? `${plural(proof.measured.length, "rule")} held on ${plural(pages, "page")}` : `${plural(proof.pages.filter((p) => !p.pass).length, "page")} of ${pages} broke a rule`
  const day = new Date(proof.checkedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  const detail = `${modes}, at ${widths} px, ${day}`
  const seal = sealSvg(proof.name, 56).replace("<svg ", '<svg x="16" y="16" ')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 88" width="400" height="88" role="img" aria-label="${esc(`${title}: ${line}, ${detail}`)}">
<rect width="400" height="88" rx="20" fill="oklch(14% 0 0)"/>
<rect x="0.5" y="0.5" width="399" height="87" rx="19.5" fill="none" stroke="oklch(100% 0 0 / 10%)"/>
${seal}
<g font-family="Geist, ui-sans-serif, system-ui, sans-serif" fill="oklch(97% 0 0)">
<text x="88" y="34" font-size="15" font-weight="600">${esc(title)}</text>
<text x="88" y="54" font-size="13" fill="oklch(78% 0 0)">${esc(line)}</text>
<text x="88" y="72" font-size="12" fill="oklch(62% 0 0)">${esc(detail)}</text>
</g>
<text x="384" y="34" text-anchor="end" font-family="Geist Mono, ui-monospace, monospace" font-size="11" fill="oklch(62% 0 0)">${esc(proof.id.slice(0, 8))}</text>
</svg>
`
}

/** Checks each page and writes the proof, its seal, and a signature when a key is given. */
export async function prove(urls, { out = "proof.json", sign, name, modes = ["light", "dark"], widths, counterexamples = false, cwd = process.cwd() } = {}) {
  const results = []
  for (const url of urls) results.push(await checkUrl(url, { modes, widths, counterexamples, cwd }))
  const used = results[0]?.runs ? [...new Set(results[0].runs.map((r) => r.width))] : widths
  const proof = makeProof(results, { name, modes, widths: used })
  const file = path.resolve(cwd, out)
  writeFileSync(file, `${JSON.stringify(proof, null, 2)}\n`)
  const svg = file.replace(/\.json$/i, "") + ".svg"
  writeFileSync(svg, proofSvg(proof))
  const signature = sign ? signProof(file, path.resolve(cwd, sign)) : null
  return { proof, file, svg, signature }
}

/** Signs a proof file with an SSH key (or its .pub, with the key in an agent). Returns the signature's path. */
export function signProof(file, key) {
  const r = spawnSync("ssh-keygen", ["-Y", "sign", "-n", NAMESPACE, "-f", key, file], { encoding: "utf8" })
  if (r.status !== 0) throw new Error(`Couldn't sign the proof: ${(r.stderr || r.error?.message || "ssh-keygen failed").trim().split("\n").pop()}`)
  return `${file}.sig`
}

/**
 * Verifies a proof: its content matches its id, and, when there's a
 * signature, that one of the allowed signers made it.
 */
export function verify(file, { signers, identity, cwd = process.cwd() } = {}) {
  const abs = path.resolve(cwd, file)
  const proof = JSON.parse(readFileSync(abs, "utf8"))
  const result = { file: abs, proof, intact: intact(proof), signed: null, rulebook: null }
  const sig = `${abs}.sig`
  if (signers) {
    const allowed = path.resolve(cwd, signers)
    if (!existsSync(sig)) result.signed = { ok: false, reason: `there's no signature at ${path.relative(cwd, sig) || sig}` }
    else {
      let who = identity
      if (!who) {
        const found = spawnSync("ssh-keygen", ["-Y", "find-principals", "-f", allowed, "-s", sig], { encoding: "utf8" })
        who = found.status === 0 ? found.stdout.trim().split("\n")[0] : null
      }
      if (!who) result.signed = { ok: false, reason: "none of the allowed signers made this signature" }
      else {
        const v = spawnSync("ssh-keygen", ["-Y", "verify", "-f", allowed, "-I", who, "-n", NAMESPACE, "-s", sig], { input: readFileSync(abs), encoding: "utf8" })
        result.signed = v.status === 0 ? { ok: true, by: who } : { ok: false, reason: (v.stderr || v.stdout).trim().split("\n").pop() }
      }
    }
  }
  try {
    result.rulebook = proof.rulebook?.sha256 === sha256(canonical(loadRules()))
  } catch {}
  return result
}

/** What a proof says, for people. */
export function formatProof({ proof, file, svg, signature }, cwd = process.cwd(), { unsigned = "Not signed. Pass --sign with an SSH key to sign it." } = {}) {
  const rel = (p) => path.relative(cwd, p) || p
  const out = []
  const pages = proof.pages.length
  if (proof.pass) out.push(`All ${plural(proof.measured.length, "rule")} the page check measures held on ${plural(pages, "page")}, in ${proof.matrix.modes.join(" and ")} mode, at ${proof.matrix.widths.join(" and ")} px.`)
  else {
    out.push(`${plural(proof.pages.filter((p) => !p.pass).length, "page")} of ${pages} broke a rule:`)
    for (const p of proof.pages.filter((x) => !x.pass)) {
      const ids = [...new Set(p.runs.flatMap((r) => r.broken.map((b) => b.id)))]
      out.push(`  ${p.url}: ${ids.join(", ") || "the page didn't load cleanly"}`)
    }
  }
  out.push("", `Proof ${proof.id.slice(0, 8)} written to ${rel(file)}, and its seal to ${rel(svg)}.`)
  if (signature) out.push(`Signed: ${rel(signature)}.`)
  else out.push(unsigned)
  return `${out.join("\n")}\n`
}

export function formatVerify(r, cwd = process.cwd()) {
  const out = []
  const name = path.relative(cwd, r.file) || r.file
  out.push(r.intact ? `${name} is intact: its content matches its id, ${r.proof.id.slice(0, 8)}.` : `${name} has been changed since it was made: its content no longer matches its id.`)
  if (r.signed) out.push(r.signed.ok ? `Signed by ${r.signed.by}.` : `The signature doesn't hold: ${r.signed.reason}.`)
  else out.push("Its signature wasn't checked. Pass --signers with an allowed signers file to check it.")
  if (r.rulebook === true) out.push("It was checked against the rulebook installed here.")
  else if (r.rulebook === false) out.push("It was checked against a different rulebook from the one installed here.")
  out.push(r.proof.pass ? `It says all ${plural(r.proof.measured?.length ?? 0, "rule")} the page check measures held on ${plural(r.proof.pages.length, "page")}, on ${r.proof.checkedAt.slice(0, 10)}.` : `It says ${plural(r.proof.pages.filter((p) => !p.pass).length, "page")} broke a rule.`)
  return `${out.join("\n")}\n`
}

export const proofOk = (r) => r.intact && (!r.signed || r.signed.ok)
