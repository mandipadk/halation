#!/usr/bin/env node
// create-halation: starts a new React project with Halation.
//
//   npm create halation my-app
//   pnpm create halation my-app --name "My app" --phenomenon caustics

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs"
import { basename, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

export const PHENOMENA = ["rays", "blinds", "caustics", "halation", "stir", "ink", "ripple", "silk", "foil", "growth"]

const TEMPLATE = fileURLToPath(new URL("../template", import.meta.url))
const DEFAULT_NAME = "My project"
const DEFAULT_PHENOMENON = "rays"
// Files a fresh directory may already hold without counting as "not empty".
const HARMLESS = new Set([".DS_Store", ".git"])

const USAGE = `Start a new project with Halation.

Usage
  npm create halation <directory> [-- --name "Project name"] [--phenomenon rays]
  pnpm create halation <directory> [--name "Project name"] [--phenomenon rays]

Options
  --name <name>          The project's name, shown on the page and used for its seal.
                         Defaults to the directory name.
  --phenomenon <name>    The light behind the opening section. Defaults to rays.
                         One of: ${PHENOMENA.join(", ")}.
  -h, --help             Show this help.
`

/** "acme-notes" becomes "Acme Notes". */
export function titleFromDir(dir) {
  const words = basename(resolve(dir)).split(/[\s._-]+/).filter(Boolean)
  if (words.length === 0) return DEFAULT_NAME
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
}

/** A valid npm package name from a directory name. */
export function packageNameFromDir(dir) {
  const name = basename(resolve(dir))
    .toLowerCase()
    .replace(/[^a-z0-9._~-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[-]+$/g, "")
  return name || "halation-app"
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function replaceOnce(file, from, to) {
  const text = readFileSync(file, "utf8")
  if (!text.includes(from)) throw new Error(`The template changed: ${basename(file)} no longer contains ${JSON.stringify(from)}.`)
  writeFileSync(file, text.replace(from, () => to))
}

/**
 * Creates a project in `dir` from the template. Throws with a plain message
 * when the directory isn't empty or an option is wrong.
 */
export function create(dir, { name, phenomenon = DEFAULT_PHENOMENON } = {}) {
  const target = resolve(dir)
  const projectName = (name ?? titleFromDir(target)).trim() || DEFAULT_NAME
  if (!PHENOMENA.includes(phenomenon)) {
    throw new Error(`There's no phenomenon called "${phenomenon}". Choose one of: ${PHENOMENA.join(", ")}.`)
  }
  if (existsSync(target)) {
    const inside = readdirSync(target).filter((f) => !HARMLESS.has(f))
    if (inside.length > 0) {
      throw new Error(`${relative(process.cwd(), target) || "This directory"} already has files in it. Choose a new or empty directory so nothing gets overwritten.`)
    }
  }
  mkdirSync(target, { recursive: true })
  cpSync(TEMPLATE, target, { recursive: true })
  // npm drops .gitignore files from published packages, so the template carries it as _gitignore.
  renameSync(join(target, "_gitignore"), join(target, ".gitignore"))

  const pkgFile = join(target, "package.json")
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"))
  pkg.name = packageNameFromDir(target)
  writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n")

  const projectFile = join(target, "src", "project.ts")
  replaceOnce(projectFile, `name: ${JSON.stringify(DEFAULT_NAME)},`, `name: ${JSON.stringify(projectName)},`)
  replaceOnce(projectFile, `phenomenon: ${JSON.stringify(DEFAULT_PHENOMENON)},`, `phenomenon: ${JSON.stringify(phenomenon)},`)
  replaceOnce(join(target, "index.html"), `<title>${DEFAULT_NAME}</title>`, `<title>${escapeHtml(projectName)}</title>`)
  replaceOnce(join(target, "README.md"), `# ${DEFAULT_NAME}`, `# ${projectName}`)

  return { target, name: projectName, packageName: pkg.name, phenomenon }
}

/** The package manager that ran us, so the next steps use the same one. */
function packageManager() {
  const agent = process.env.npm_config_user_agent ?? ""
  if (agent.startsWith("pnpm")) return "pnpm"
  if (agent.startsWith("yarn")) return "yarn"
  if (agent.startsWith("bun")) return "bun"
  return "npm"
}

function main(argv) {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        name: { type: "string" },
        phenomenon: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    })
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`)
    return 1
  }
  const { values, positionals } = parsed
  if (values.help) {
    console.log(USAGE)
    return 0
  }
  if (positionals.length > 1) {
    console.error(`Give one directory, not ${positionals.length}. If the name has spaces, put it in quotes or pass it with --name.\n\n${USAGE}`)
    return 1
  }
  const dir = positionals[0] ?? "my-project"

  let result
  try {
    result = create(dir, { name: values.name, phenomenon: values.phenomenon ?? DEFAULT_PHENOMENON })
  } catch (error) {
    console.error(error.message)
    return 1
  }

  const pm = packageManager()
  const run = pm === "npm" ? "npm run" : pm
  const where = relative(process.cwd(), result.target)
  const steps = [where && `cd ${where.includes(" ") ? JSON.stringify(where) : where}`, `${pm} install`, `${run} dev`].filter(Boolean)
  console.log(`
Created ${result.name} in ${where || "this directory"}.

Next, install and start it:

${steps.map((s) => `  ${s}`).join("\n")}

Then open the address it prints. Edit src/App.tsx and the page updates as you save.

Claude Code is already set up here: CLAUDE.md and AGENTS.md explain how to work
in the project, the Halation skill is in .claude/skills, and a hook runs
halation lint after every edit. Run ${run} lint to check the house rules yourself.
`)
  return 0
}

// Run directly or through a bin symlink (npm create, pnpm create); not when imported by tests.
const realpath = (p) => {
  try {
    return realpathSync(p)
  } catch {
    return p
  }
}
if (process.argv[1] && realpath(process.argv[1]) === realpath(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2))
}
