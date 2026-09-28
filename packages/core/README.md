# @halation/core

Halation without a framework: tokens and component styles as plain CSS, the phenomena, daylight, the signature, motion helpers, the rendered check, runtime color math (`@halation/core/color`: derive an accent's roles and their contrast from a hue) and the instruments (`@halation/core/instruments`: the sundial's sky).

```css
@import "@halation/core/styles.css";        /* everything */
@import "@halation/core/tailwind.css";      /* or: Tailwind with only Halation's values */
```

```js
import { mountPhenomenon } from "@halation/core/phenomena"
import { mountLitEdge, sealSvg } from "@halation/core/signature"
import { check } from "@halation/core/check"

mountPhenomenon(document.querySelector(".hero-light"), "caustics", { daylight: true })
mountLitEdge()
console.table(check(document.body).rules)
```

Colors switch between light and dark on their own through `light-dark()`: set `data-theme="light"` or `"dark"` on the root to override the visitor's setting, and `data-accent` to one of `vermilion`, `cobalt`, `jade` or `amber`. `rules.json` is the rulebook the CLI and the checker read.

MIT
