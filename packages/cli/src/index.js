// @halation/cli as a library: the same pieces the command line uses.

export { main } from "./cli.js"
export { lintText, lintFiles, lintHook, collectFiles, formatReport } from "./lint.js"
export { checkUrl, checkerSource, formatCheck } from "./check.js"
export { gate, gateCss, gateHtml, formatGate, parseCss, checkDeclaration, loadOwnStyles } from "./gate.js"
export { prove, makeProof, proofSvg, signProof, verify, intact, formatProof, formatVerify } from "./proof.js"
export { renderSkill } from "./skill.js"
export { init, mergeHook, mergeMcp, HOOK, HOOK_COMMAND, MCP_SERVER } from "./init.js"
export { createMcpServer, serveMcp, TOOLS, PROMPTS, PROTOCOL_VERSIONS } from "./mcp.js"
export { loadRules, compileDetectors } from "./rules.js"
