# Halation

A design system that holds your taste as rules, so every project, and every AI agent working in one, starts on-brand and can't drift off it.

Halation grew out of the [Parallex](https://github.com/mandipadk/parallex) site: light instead of paint, one color used as a signal, type that carries the voice. It keeps that taste in three forms:

- **Values computed and proven.** Every color comes from one accent and must pass contrast in both light and dark modes, or the build stops and says which pair failed.
- **Components that behave.** Built on [Base UI](https://base-ui.com), so they're accessible and keyboard-complete, with motion that means something.
- **Rules an agent can't argue with.** Off-system colors, sizes and letter-spacing don't exist in the theme. Lint runs after every edit an agent makes and hands problems back; a check reads the rendered page.

## Three layers

Projects built from one system usually look alike. Halation splits every project into three layers, and only the first is fixed.

| Layer | What it is |
| --- | --- |
| Grammar | The rules. Contrast, one color used as a signal, sentence case, no dots joining facts, the motion laws. Always enforced. |
| Character | What a project chooses: its phenomenon, type voice, tempo, shapes, the temperature of its greys, and its one accent. |
| Signature | Generated from the project's name: a seal that plays its own chime, a lit edge, a grain of its own, credits that roll. |

## Start

A new project, with the agent kit already set up:

```bash
npm create halation my-app
```

An existing React app:

```bash
npm i @halation/react
npm i -D @halation/cli
npx halation init
```

```tsx
import "@halation/react/styles.css"
import { HalationProvider, Stage, Heading, Serif, Button } from "@halation/react"

export function App() {
  return (
    <HalationProvider name="My project" accent="vermilion" tempo="crisp">
      <Stage phenomenon="rays" daylight>
        <div data-quiet>
          <Heading level={1}>
            Every app. <Serif>Twice.</Serif>
          </Heading>
          <Button variant="ink" shape="pill" size="lg">Download</Button>
        </div>
      </Stage>
    </HalationProvider>
  )
}
```

With Tailwind, import `@halation/core/tailwind.css` instead of Tailwind itself. Only Halation's values exist, so `bg-purple-500` or `text-4xl` simply don't generate.

## Packages

| Package | What's in it |
| --- | --- |
| `@halation/core` | Tokens and styles as plain CSS, the phenomena, daylight, the signature, motion, and the rendered check. No framework. |
| `@halation/react` | The components, stages and signature for React. |
| `@halation/cli` | `halation lint`, `check`, `rules`, `skill` and `init`, the agent kit. |
| `create-halation` | The starter: `npm create halation`. |

## Phenomena

Real processes, simulated and drawn slowly behind content. Each answers the pointer and, with daylight on, the visitor's time of day. On dark grounds you see the light; on light grounds, the shade it casts.

| Group | Phenomena |
| --- | --- |
| Light | Rays, blinds, caustics, halation |
| Air | Stir, ink |
| Water | Ripple |
| Matter | Silk, foil |
| Life | Growth |

They're original code: WebGL and WebGL2, a few kilobytes each, no libraries. They pause off screen, hold a still frame for reduced motion, and dim behind whatever is marked `data-quiet`.

## For agents

`npx halation init` adds a Claude Code skill generated from the rulebook, a hook that lints every file an agent edits (problems go back to the agent in the same turn), and an `AGENTS.md` other tools read too. The rulebook in `forge/rulebook.ts` is the one source for the skill, the lint rules, the page check and the docs.

```bash
npx halation lint src
npx halation check http://localhost:5173
npx halation rules
```

## Develop

```bash
pnpm install
pnpm build     # the forge, then every package
pnpm test
pnpm dev       # the docs site
```

The forge (`forge/`) computes the palette from the accents in `forge/seeds.ts` and writes `packages/core/css/tokens.css`, the Tailwind theme, `rules.json` and a contrast report. It exits with an error when any pair misses its target.

## License

MIT
