// The rulebook: every rule with its reason, what catches it, and what to do
// instead. The skill, the lint rules, the page checks and the docs are all
// meant to be generated from this one list, so guidance and enforcement
// can't drift apart.

export type Catcher = "Theme" | "Forge" | "Lint" | "Build gate" | "Page check" | "Critic"

/** A source-level detector: a pattern, the files it applies to, and how bad a match is. */
export type Lint = { pattern: string; flags?: string; files: string[]; level: "error" | "warn"; skip?: string }

export type Rule = {
  id: string
  slug: string
  says: string
  why: string
  instead: string
  caught: Catcher[]
  lint?: Lint[]
}

const re = String.raw

const UI = ["tsx", "jsx", "html", "vue", "svelte", "astro", "mdx"]
const STYLES = ["css", "scss", "pcss", "postcss", "less", "sass", "styl"]
const SCRIPTS = ["ts", "js"]

/** Halation's own sources, which define the tokens everything else must use. */
const CORE = "(halation|packages)/core/"

// CSS keywords, properties and hex digits ignore case, so every detector does too.
const lint = (pattern: string, files: string[], level: Lint["level"] = "error", skip?: string): Lint => ({ pattern, flags: "i", files, level, ...(skip ? { skip } : {}) })

/** Every CSS named color except transparent and currentColor. */
const NAMED = [
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "black", "blanchedalmond", "blue", "blueviolet", "brown", "burlywood",
  "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray",
  "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen", "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
  "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise", "darkviolet", "deeppink", "deepskyblue", "dimgray", "dimgrey", "dodgerblue",
  "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro", "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow", "grey",
  "honeydew", "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender", "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral",
  "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey", "lightpink", "lightsalmon", "lightseagreen", "lightskyblue",
  "lightslategray", "lightslategrey", "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "magenta", "maroon", "mediumaquamarine",
  "mediumblue", "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen", "mediumturquoise", "mediumvioletred",
  "midnightblue", "mintcream", "mistyrose", "moccasin", "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange", "orangered", "orchid",
  "palegoldenrod", "palegreen", "paleturquoise", "palevioletred", "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue", "purple",
  "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell", "sienna", "silver", "skyblue",
  "slateblue", "slategray", "slategrey", "snow", "springgreen", "steelblue", "tan", "teal", "thistle", "tomato", "turquoise", "violet", "wheat",
  "white", "whitesmoke", "yellow", "yellowgreen",
].join("|")

// Literal colors, the pieces of the R17 patterns.
const HEX = re`#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![0-9a-z-])`
const FUNC = re`(?<![\w-])(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\((?!\s*(?:from\s+)?var\()`
const NAME = re`(?<![\w\-./#$@])(?:${NAMED})(?![\w\-./(])`
/** A named color inside a Tailwind arbitrary value, where `_` stands for a space. */
const BRACKET_NAME = re`(?<=[\[,(_:])(?:${NAMED})(?=[\],)_])`
/** Properties and style-object keys that take a color. */
const COLOR_KEY = re`[a-z-]*(?:color|background|fill|stroke|border|outline|shadow)[a-z-]*`

// Letter-spacing that adds nothing: zero, the defaults and the text styles' own tracking.
const ZERO = re`[+-]?(?:0+(?:\.0*)?|\.0+)(?:[a-z%]+)?`
const NO_TRACKING = re`(?:${ZERO}|normal|inherit|initial|unset|revert|revert-layer|var\(\s*--(?:text-[\w-]+|font-serif--letter-spacing)\s*\))`

const SEP = re`[·•∙⋅]`
const SEP_ESCAPE = re`\\0*(?:b7|2022|2219|22c5)(?![0-9a-f])`

/** A small size: Tailwind steps 1 to 4, or 16px and under. */
const DOT = re`(?:1|1\.5|2|2\.5|3|3\.5|4|\[(?:[1-9]|1[0-6])px\]|\[0?\.\d+rem\]|\[1rem\])(?![\w/.-])`
const DOT_SIZE = re`(?<![\w-])size-${DOT}|(?<![\w-])w-${DOT}[^"'\`]*(?<![\w-])h-${DOT}|(?<![\w-])h-${DOT}[^"'\`]*(?<![\w-])w-${DOT}`
const ROUND = re`(?<![\w-])rounded-(?:full|\[50%\]|\[999px\]|\[9999px\])(?![\w-])`
/** A background utility that sets a color, not an image, position or size. */
const BG_COLOR = re`(?<![\w-])bg-(?!(?:none|transparent|fixed|local|scroll|repeat|no-repeat|round|space|top|bottom|left|right|center|auto|cover|contain)(?![\w\[-])|(?:clip|origin|blend|repeat|linear|radial|conic|gradient|size|position|top|bottom|left|right)-|\[url|\(image)[\w\[(]`

export const rules: Rule[] = [
  { id: "R1", slug: "one-accent", says: "One accent, used as a signal: identity, focus, selection, live state.", why: "Color that means something is only noticed when it's rare.", instead: "Neutral surfaces and ink; the accent only where it carries meaning.", caught: ["Theme", "Page check"] },
  { id: "R2", slug: "primary-is-ink", says: "The one main action is ink: white on dark, black on light.", why: "Keeps the accent free to mean something, and the main action obvious in both modes.", instead: "An ink button; accent fills only for identity moments.", caught: ["Page check"] },
  {
    id: "R3", slug: "light-not-paint", says: "No gradients as decoration. Depth comes from light: atmospheres, lit edges, shadows.", why: "Decorative gradients are the most common sign of generated design.", instead: "An atmosphere behind the page, or a raised surface.", caught: ["Theme", "Lint", "Build gate"],
    lint: [
      // A gradient that only masks is fine, but the mask property has to start the declaration.
      lint(re`\b(?:bg-gradient-|bg-linear-|bg-radial-|bg-conic-|from-[a-z]+-\d{2,3}(?![\w-]))|(?:linear|radial|conic)-gradient\((?<!(?:^|[{;\[,\n])\s*(?:-webkit-|webkit)?mask(?:-image|image)?\s*:\s*["'\`]?[^;{}\]]*)`, [...UI, ...STYLES, ...SCRIPTS, "svg"], "error", `phenomena|${CORE}`),
    ],
  },
  { id: "R4", slug: "contrast", says: "Every text and background pair passes WCAG 2 in both modes.", why: "Legibility isn't a style choice.", instead: "Use the text roles; the forge solves their contrast.", caught: ["Forge", "Page check"] },
  {
    id: "R5", slug: "sentence-case", says: "Sentence case everywhere. No uppercase labels.", why: "Capitals shout, and spaced-out capitals are a generated-design cliché.", instead: "A smaller or lighter text style.", caught: ["Lint", "Build gate", "Page check"],
    lint: [
      lint(re`\buppercase\b|font-variant(?:-caps)?\s*:[^;{}"'\`]*small-caps|fontVariant(?:Caps)?\s*:\s*["'\`][^"'\`]*small-caps`, [...UI, ...STYLES, "svg"]),
      lint(re`text-transform\s*:\s*["'\`]?\s*uppercase|textTransform\s*:\s*["'\`]\s*uppercase|font-variant(?:-caps)?\s*:[^;{}"'\`]*small-caps|fontVariant(?:Caps)?\s*:\s*["'\`][^"'\`]*small-caps`, SCRIPTS),
    ],
  },
  {
    id: "R6", slug: "no-tracking", says: "No letter-spacing beyond what the text styles set.", why: "Tracking is tuned per size already; extra spacing is how eyebrows get made.", instead: "The text style for that size.", caught: ["Theme", "Lint", "Build gate"],
    lint: [
      lint(re`letter-spacing\s*:(?!\s*${NO_TRACKING}\s*(?:!important\s*)?(?:[;}"'\`\])\n]|$))[^;{}"'\`\n\]]+`, [...UI, ...STYLES, ...SCRIPTS, "svg"], "error", CORE),
      lint(re`(?<![\w$-])letterSpacing\s*:(?!\s*(?:["'\`]\s*)?${NO_TRACKING}\s*["'\`]?\s*(?:[,}\n)]|$))[^,}\n]+`, [...UI, ...SCRIPTS], "error", CORE),
      // The theme defines no tracking utilities, so a tracking- class either adds spacing or does nothing.
      lint(re`(?<![\w-])tracking-[\w\[\].()%/-]+`, [...UI, ...STYLES, ...SCRIPTS], "error", CORE),
    ],
  },
  { id: "R7", slug: "named-styles", says: "Eleven named text styles; no other sizes.", why: "A small scale is what makes pages feel composed.", instead: "The nearest style.", caught: ["Theme", "Lint", "Build gate", "Page check"], lint: [lint(re`\btext-(xs|sm|base|lg|xl|[2-9]xl)\b|\btext-\[[\d.]+(px|rem|em)\]`, UI)] },
  { id: "R8", slug: "one-serif-phrase", says: "At most one serif phrase in a headline, and only at title sizes and up.", why: "It's an accent in the voice; twice is a costume.", instead: "Plain type for everything else.", caught: ["Page check"] },
  {
    id: "R9", slug: "no-dot-separators", says: "Facts are never joined with dots or bars.", why: "A joined string has to be parsed; structure can be scanned.", instead: "The Facts component, or separate lines with their own weight.", caught: ["Lint", "Page check"],
    lint: [
      lint(
        re`(?:\s|&nbsp;)${SEP}(?:\s|&nbsp;)|&(?:middot|bull|#0*183|#0*8226|#0*8729|#0*8901|#x0*b7|#x0*2022|#x0*2219|#x0*22c5);|>\s*(?:&nbsp;\s*)*${SEP}\s*(?:&nbsp;\s*)*<|\{\s*["'\`]\s*${SEP}\s*["'\`]\s*\}|content\s*:\s*["'][^"'\n]*(?:${SEP}|${SEP_ESCAPE})|content-\[[^\]\s]*(?:${SEP}|${SEP_ESCAPE})`,
        [...UI, ...SCRIPTS, ...STYLES, "md"],
      ),
      lint(re`>[^<>{}()=;:]*[^\s<>{}()=;:|]\s\|\s[^\s<>{}()=;:|][^<>{}()=;:]*<`, UI, "warn"),
    ],
  },
  {
    id: "R10", slug: "no-status-dots", says: "No status dots, and no tinted pills with a dot and same-hue text.", why: "It reads as generated, and color alone doesn't say what the state is.", instead: "A word and a shape; only the shape carries color.", caught: ["Lint", "Page check"],
    lint: [
      // Small, round and filled is a dot.
      lint(re`["'\`](?=[^"'\`]*${ROUND})(?=[^"'\`]*(?:${DOT_SIZE}))(?=[^"'\`]*${BG_COLOR})[^"'\`]*["'\`]`, UI),
      // Small and round without a fill of its own may still become one.
      lint(re`["'\`](?=[^"'\`]*${ROUND})(?=[^"'\`]*(?:${DOT_SIZE}))(?![^"'\`]*${BG_COLOR})[^"'\`]*["'\`]`, UI, "warn"),
    ],
  },
  { id: "R11", slug: "mono-on-surfaces", says: "Monospace only inside a surface: keys, code wells, token names on cards.", why: "Loose monospace on the page reads as a terminal, and as generated.", instead: "Geist, with tabular figures for numbers.", caught: ["Page check"] },
  { id: "R12", slug: "tabular-numbers", says: "Numbers that sit in columns or change use tabular figures.", why: "They line up and don't jitter as they change.", instead: "The value style, which sets tabular figures.", caught: ["Theme", "Page check"] },
  { id: "R13", slug: "lines-before-boxes", says: "Hairlines separate; a box only when something must read as an object. Never a box inside a box.", why: "Card soup flattens hierarchy.", instead: "A divider or spacing.", caught: ["Page check", "Critic"] },
  { id: "R14", slug: "motion-laws", says: "Interface motion stays under 300 ms, exits take 70% of the enter, nothing loops while idle.", why: "Motion should explain a change, never make anyone wait.", instead: "The moves and their durations.", caught: ["Theme", "Page check"] },
  { id: "R15", slug: "one-atmosphere", says: "One atmosphere per page, and it dims behind content.", why: "An atmosphere is a place, not a decoration.", instead: "The page's one light, with its quiet zone.", caught: ["Page check"] },
  {
    id: "R17", slug: "raw-colors", says: "Colors come from tokens, never from literal values in markup.", why: "A literal color is a color the system can't check, theme or keep in contrast.", instead: "A color role: bg-surface, text-fg-muted, border-line and so on.", caught: ["Theme", "Lint", "Build gate"],
    lint: [
      // Style sheets: a literal anywhere in a declaration or custom property, but not in a selector,
      // and not in a mask, where black and white only mean opaque and clear.
      lint(re`(?:(?<![\w&]|url\(\s*)${HEX}|${FUNC}|${NAME}(?<!["'][^"'\n;{}]*))(?<=[\w-]\s*:[^;{}]*)(?<!(?:^|[{;\n])\s*(?:-webkit-)?mask(?:-image)?\s*:[^;{}]*)(?=[^{};]*(?:[;}]|$))`, STYLES, "error", CORE),
      // CSS in strings, style attributes and component style blocks.
      lint(re`(?<![\w$-])(?:--[\w-]+|${COLOR_KEY})\s*:\s*[^;{}"'\`\n]*?(?:${HEX}|${FUNC}|${NAME}(?=\s*(?:[;"'\`!]|$)))`, [...UI, ...SCRIPTS, "svg"], "error", CORE),
      // Style objects.
      lint(re`(?<![\w$-])(?:["']--[\w-]+["']|${COLOR_KEY})\s*:\s*["'\`][^"'\`\n]*?(?:${HEX}|${FUNC}|${NAME})`, [...UI, ...SCRIPTS], "error", CORE),
      // Tailwind arbitrary values and properties.
      lint(re`(?:-\[(?:color:)?|(?<![\w\]-])\[[a-z-]+:)[^\]\s"'\`]*?(?:${HEX}|${FUNC}|${BRACKET_NAME})`, [...UI, ...SCRIPTS, ...STYLES], "error", CORE),
      // Colors written into the page from script.
      lint(re`(?:\.style\.[a-z]+\s*=|setProperty\(\s*["'][^"']+["']\s*,)\s*["'\`]\s*(?:${HEX}|${FUNC}|(?:${NAMED})(?=\s*["'\`]))`, [...UI, ...SCRIPTS], "error", CORE),
      // SVG paint attributes.
      lint(re`(?<![\w-])(?:fill|stroke|stop-?color|flood-?color|lighting-?color|color)\s*=\s*\{?\s*["'\`]\s*(?:${HEX}|${FUNC}|(?:${NAMED})(?=\s*["'\`]))`, [...UI, "svg"], "error", CORE),
    ],
  },
  {
    id: "R18", slug: "lens-fonts", says: "Type comes from the project's lens: its display, text and code faces.", why: "Inter, Roboto and system stacks are the default look of generated design.", instead: "The --font-sans, --font-serif and --font-mono tokens.", caught: ["Theme", "Lint", "Build gate"],
    lint: [
      // An @font-face rule has to name its family; everywhere else the family comes from a token.
      lint(re`font-family(?<!@font-face\s*\{[^}]*font-family)\s*:(?!\s*(?:var\(\s*--font-[\w-]+\s*\)|inherit|initial|unset|revert|revert-layer)\s*(?:!important\s*)?(?:[;}"'\`\]\n]|$))[^;{}\n]*`, [...UI, ...STYLES, ...SCRIPTS, "svg"], "error", CORE),
      lint(re`(?<![\w$-])fontFamily\s*:\s*["'\`](?!\s*(?:var\(\s*--font-[\w-]+\s*\)|inherit|initial|unset)\s*["'\`])[^"\`\n]*`, [...UI, ...SCRIPTS], "error", CORE),
      lint(re`(?<![\w-])font-\[(?!\s*(?:family-name:)?var\(--font-)[^\]\s"\`]*\]?`, [...UI, ...STYLES, ...SCRIPTS], "error", CORE),
    ],
  },
  { id: "R16", slug: "key-gap", says: "Keys in a combination keep a visible gap.", why: "Each key should read as its own key.", instead: "The Keys component.", caught: ["Lint"], lint: [lint(re`</kbd>\s*<kbd`, UI, "warn")] },
  {
    id: "R19", slug: "tailwind-through-theme", says: "Tailwind comes through Halation's theme.", why: "Tailwind's own entry brings back its whole palette, type scale and radii, so off-system classes quietly work again.", instead: `@import "@halation/core/tailwind.css", which loads Tailwind with only the system's values.`, caught: ["Lint"],
    lint: [lint(re`@import\s+(?:url\(\s*)?["']tailwindcss(?:/[^"']*)?["']|@tailwind\s+(?:base|components|utilities)\b`, STYLES, "error", CORE)],
  },
  {
    id: "R20", slug: "no-cloaking", says: "Pages look the same to the checker as to people.", why: "A page that spots the checker and shows it something else hides every problem the check would find.", instead: "One page for everyone; fix what the check reports.", caught: ["Lint"],
    lint: [lint(re`navigator\.webdriver|HeadlessChrome|__playwright|__puppeteer|\bcdc_[a-z0-9]{10,}`, [...UI, ...SCRIPTS], "error", CORE)],
  },
  { id: "R21", slug: "named-exceptions", says: "An exception names the rule it breaks.", why: "A blanket exception silences every rule on its line, including the ones nobody meant to allow.", instead: "An exception needs the rule id it's for, like halation-ignore R9, and a reason.", caught: ["Lint"] },
  {
    id: "R22", slug: "no-text-glow", says: "No glow on text.", why: "Glowing text is a generated-design cliché, and it hurts legibility.", instead: "Plain text. Light belongs to surfaces and phenomena. The one bloom text may take is the halation phenomenon's, in dark mode, once per page.", caught: ["Lint", "Build gate", "Page check"],
    lint: [
      lint(re`(?<![\w-])text-shadow\s*:(?!\s*(?:none|inherit|initial|unset|revert|revert-layer)\s*(?:!important\s*)?(?:[;}"'\`\])\n]|$))[^;{}"'\`\n\]]*`, [...UI, ...STYLES, ...SCRIPTS, "svg"], "error", CORE),
      lint(re`(?<![\w$-])textShadow\s*:(?!\s*["'\`]\s*(?:none|inherit|initial|unset)\s*["'\`])[^,}\n]*`, [...UI, ...SCRIPTS], "error", CORE),
      lint(re`(?<![\w-])text-shadow-(?!none(?![\w-]))[\w\[\]/().#%,-]*`, [...UI, ...STYLES, ...SCRIPTS], "error", CORE),
    ],
  },
  { id: "R23", slug: "fits-a-phone", says: "Pages fit a phone: nothing scrolls sideways.", why: "Most visitors arrive on a phone, and a page that scrolls sideways there feels broken.", instead: "Widths that give way: rows that wrap, fluid text styles, a max-width instead of a width.", caught: ["Page check"] },
  { id: "R24", slug: "on-the-grid", says: "Spacing sits on the grid: 2 px steps up to 24, then 4 px steps, or a named space.", why: "Consistent steps are what make a layout feel built rather than nudged.", instead: "The spacing scale (p-3, gap-1.5), a named space like --space-section, or a component metric with its reason.", caught: ["Build gate", "Page check"] },
  { id: "R25", slug: "named-radii", says: "Corners come from the radius scale, a full pill, or nest inside their parent's.", why: "A few radii, used everywhere, are what make shapes feel related.", instead: "The radius scale (rounded-lg), rounded-full, or the parent's radius minus its padding.", caught: ["Build gate", "Page check"] },
  {
    id: "R26", slug: "metrics-have-reasons", says: "A component metric states its reason.", why: "A value off the scale is fine when a component needs it, and the reason is what lets the next person keep it or retire it.", instead: "Declare it in the component's stylesheet as --m-name, with a comment on the same line saying why: --m-cap-x: 9px; /* a one-letter cap stays square at 38 px */. Not in a style attribute or script.", caught: ["Lint"],
    lint: [
      lint(re`(?<![\w-])--m-[\w-]+\s*:[^;{}]*;(?![^\n]*\/\*)`, STYLES, "error"),
      lint(re`["'\`]--m-[\w-]+["'\`]\s*[:,]|--m-[\w-]+\s*:[^;"'\`]*;?\s*["'\`}]`, [...UI, ...SCRIPTS], "error"),
    ],
  },
  { id: "R27", slug: "lock-first", says: "Halation's lock layer comes before any other layer.", why: "The lock holds a few rules in the browser itself, and it only outranks everything when it's declared first.", instead: "Import Halation's styles (or its Tailwind entry) before any stylesheet that declares its own layers.", caught: ["Build gate"] },
]
