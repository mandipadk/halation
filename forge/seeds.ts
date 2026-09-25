// The accents the lab builds. A project would list just its own.

import type { Seed } from "./theme.ts"

export const seeds: Seed[] = [
  { id: "vermilion", name: "Vermilion", accent: "#ff6b3d" },
  { id: "cobalt", name: "Cobalt", accent: { l: 0.62, c: 0.19, h: 258 } },
  { id: "jade", name: "Jade", accent: { l: 0.72, c: 0.15, h: 162 } },
  { id: "amber", name: "Amber", accent: { l: 0.8, c: 0.16, h: 75 } },
]
