// The rulebook, read from @halation/core so an installed CLI checks against
// the rules of the core it was installed with.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** Resolves a file exported by @halation/core to a path on disk. */
export function corePath(specifier) {
  return fileURLToPath(import.meta.resolve(`@halation/core/${specifier}`))
}

let cached
/** Every rule, in rulebook order. */
export function loadRules() {
  cached ??= JSON.parse(readFileSync(corePath("rules.json"), "utf8"))
  return cached
}

/** One compiled detector per rule `lint` entry. */
export function compileDetectors(rules = loadRules()) {
  const detectors = []
  for (const rule of rules) {
    for (const lint of rule.lint ?? []) {
      const flags = [...new Set(`${lint.flags ?? ""}g`)].join("")
      detectors.push({
        rule,
        level: lint.level,
        re: new RegExp(lint.pattern, flags),
        files: new Set(lint.files.map((e) => e.replace(/^\./, "").toLowerCase())),
        skip: lint.skip ? new RegExp(lint.skip) : null,
      })
    }
  }
  return detectors
}

/** The file extensions at least one detector reads. */
export function coveredExtensions(detectors = compileDetectors()) {
  const all = new Set()
  for (const d of detectors) for (const e of d.files) all.add(e)
  return [...all]
}
