// @halation/cli as a library: the same pieces the command line uses.

export { main } from "./cli.js"
export { lintText, lintFiles, lintHook, collectFiles, formatReport } from "./lint.js"
export { checkUrl, checkerSource, formatCheck } from "./check.js"
export { gate, gateCss, gateHtml, formatGate, parseCss, checkDeclaration, loadOwnStyles } from "./gate.js"
export { renderSkill } from "./skill.js"
export { init, mergeHook, HOOK, HOOK_COMMAND } from "./init.js"
export { loadRules, compileDetectors } from "./rules.js"
