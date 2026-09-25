// The console greeting: open the developer tools on a Halation project and
// it says hello with its seal, its character and an invitation to read how
// it was made.

import { sealSvg, colophon } from "./seal.js"

export function greet(name, character, { rules = 18 } = {}) {
  const svg = sealSvg(name, 64).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
  console.log("%c ", `padding: 30px 30px; background: url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}") no-repeat center / 60px 60px;`)
  const line = `Lit by ${String(character.light).toLowerCase()}, with a ${String(character.tempo).toLowerCase()} tempo and the ${String(character.lens).toLowerCase()} lens.`
  console.log(`%c${name}%c\n${line}\n%cBuilt with Halation. Type halation.colophon() to see how it was made.`, "font: 600 18px system-ui, sans-serif", "font: 13px system-ui, sans-serif; color: #999", "font: 12px system-ui, sans-serif; color: #888")
  globalThis.halation = { name, character, rules, colophon: () => console.table(Object.fromEntries(colophon(name, character))) }
}
