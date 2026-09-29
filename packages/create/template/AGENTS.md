# Working in this project

This is a React app built with Halation, a design system that holds the project's taste as rules. Keep every change inside those rules.

## Before you change the interface

Read the Halation skill in `.claude/skills/halation/SKILL.md`. It lists the components, the text styles, the tokens and the rules, with what to use instead of each thing the rules forbid.

Build with the components from `@halation/react` before writing your own markup. The project's name and its phenomenon live in `src/project.ts`.

## After every change

Run `pnpm lint` (or `npm run lint`). It checks `src` against the rules and says how to fix what it finds. In Claude Code, a hook runs it after every edit, so fix what it reports before moving on.

With the dev server running, `pnpm check` measures the rendered page in light and dark mode: contrast, stray capitals, dots, status dots and slow motion.

Run `pnpm build` before you call a change done. TypeScript must pass with no errors.

## The rules in short

- Sentence case everywhere. No uppercase labels and no letter-spaced eyebrows.
- Facts go in `Facts` or on separate lines. Never join them with `·`, `•` or a bar.
- Show a state with `State`, never a colored dot.
- Text comes in eleven styles: `display-xl`, `display`, `title-1`, `title-2`, `title-3`, `body-lg`, `body`, `control`, `body-sm`, `caption` and `micro`. `control` is for labels on tabs, keycaps and segmented controls. Use `Text`, `Heading` or the `hl-text-*` classes, not other sizes.
- Colors come from the tokens (`var(--color-fg)`, `var(--color-accent)` and the rest), never from literal values.
- No gradients as decoration. Depth comes from the phenomenon on the `Stage`, lit edges and shadows.
- One ink button per view: the main action. Everything else is secondary or ghost.
- At most one `Serif` phrase in a headline.
- One phenomenon per page, and it dims behind content marked `data-quiet`.
- Write plain, specific copy. A button says what happens when you press it.
