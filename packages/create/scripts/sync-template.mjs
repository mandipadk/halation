// Writes the starter's agent files from the CLI, so a new project ships
// exactly what `halation init` would write: the skill, the script the hooks
// run, and the MCP server entry.

import { writeFileSync } from "node:fs"
import { HOOK_SCRIPT, mergeMcp } from "../../cli/src/init.js"
import { renderSkill } from "../../cli/src/skill.js"

const template = new URL("../template/", import.meta.url)
writeFileSync(new URL(".claude/skills/halation/SKILL.md", template), await renderSkill())
writeFileSync(new URL(".halation/hooks.sh", template), HOOK_SCRIPT)
const mcp = {}
mergeMcp(mcp)
writeFileSync(new URL(".mcp.json", template), `${JSON.stringify(mcp, null, 2)}\n`)
