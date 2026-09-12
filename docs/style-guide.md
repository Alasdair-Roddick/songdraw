# SongDraw Style Guide

Analog film. Warm paper, muted tone, halation instead of hard shadows.
Light-mode-first with a darkroom. Built on shadcn components — restyle via
`className`, don't fork components unless the change is global.

## Principles

- **Warm, never neutral.** Nothing in the palette is a grey. Film isn't, and a
  neutral grey next to these tokens reads as a bug. There is no `#ffffff` and
  no `#000000` anywhere.
- **Depth comes from light, not from geometry.** Surfaces lift with halation —
  a contact shadow, a diffuse lift and a warm bloom. No hard offset shadows, no
  glassmorphism, no blur.
- **Tone over line.** Prefer a change in surface tone to drawing a border.
- **Type does the talking.** Big, heavy, tight, sentence case.
- **One accent.** Burnt amber for the primary action and highlights. Never two
  accent colours on one screen.
- **Mobile first.** Tap targets ≥44px (`h-11`/`h-12` for primary controls).

## Tokens

**Never hardcode a border colour, radius, or shadow again.** These exist so the
whole surface treatment changes in `app/globals.css` rather than across 27
files:

| Token | Use |
|---|---|
| `border-rule` | decorative frames and dividers |
| `border-rule-strong` | anything outlining an **interactive control** |
| `rounded-(--radius-frame)` | card / dialog / frame corners |
| `shadow-(--shadow-lift-lg)` | auth cards, key surfaces |
| `shadow-(--shadow-lift)` | floating chrome — toasts, popovers, sticky bars |
| `shadow-(--shadow-lift-sm)` | small controls |

The two rule tokens are **not interchangeable**. WCAG 1.4.11 requires 3:1 for a
boundary that identifies a control and asks nothing of a decorative divider, so
`--rule` is free to go soft and `--rule-strong` is not. Collapsing them fails
`tests/contrast.test.ts`.

## Color

Always use tokens, never raw hex/oklch in components:

| Token | Use |
|---|---|
| `bg-brand` / `text-brand-foreground` | primary CTA, highlights, selected states |
| `bg-primary` | brand mark tile, solid emphasis |
| `border-rule` / `border-rule-strong` | see above |
| `text-muted-foreground` | secondary text |
| `destructive` | errors, danger zone only |

Contrast is enforced by `tests/contrast.test.ts`, which parses `globals.css`.
If you retune a colour by eye and drop below the line, the build fails. That
test exists because the old palette shipped a focus ring at 1.6:1 that nobody
noticed for months.

## Typography

- **Display / page titles:** `font-display font-extrabold tracking-tight` (hero
  adds `leading-[0.95]`). The face is **Bricolage Grotesque** — variable, with
  optical-size corrections that read as hand-set rather than drawn on a grid.
  **Sentence case, not uppercase.** Highlight one word with
  `bg-brand px-3 text-brand-foreground inline-block -rotate-1` (hero only).
- **Display type is for our words, not the user's.** Song titles, display names
  and emails stay on the sans — they carry casing we don't own.
- **Section eyebrows / labels:** `font-mono text-xs font-semibold
  tracking-widest uppercase text-muted-foreground`. Wide-tracked uppercase mono
  is the darkroom idiom and does a lot of the analog work; use it freely.
- **Meta text** (taglines, descriptions, empty states): `font-mono text-sm
  text-muted-foreground`.
- **Body:** default sans, `font-medium`/`font-bold` for emphasis.
- **Card / dialog titles:** stay on `font-heading` (the sans) — they read as UI,
  not as posters, and often contain names.

## Borders, radius, shadows

- Frames and dividers: `border-2 border-rule`, `divide-y-2 divide-rule`.
- Control outlines: `border-rule-strong`.
- Radius: frames use `rounded-(--radius-frame)` — prints are cut square, the
  softness comes from tone. Inputs `rounded-md`; buttons and search inputs
  `rounded-full`; album art square; people avatars stay circles.
- Shadows: the three `--shadow-lift*` tokens only. Never a literal offset, and
  never `filter: blur()` — a filter on a scroll-snap child creates a containing
  block and can drop snap alignment in Safari.

## Component recipes

- **Primary CTA:** `<Button variant="brand" className="h-12 rounded-full
  text-base">` — amber pill, bold dark text. One per view.
- **Secondary:** `<Button variant="outline" className="rounded-full">`.
- **Card (auth/forms):** `<Card className="rounded-(--radius-frame) border-2
  border-rule shadow-(--shadow-lift-lg)">`.
- **Dialogs:** `rounded-(--radius-frame) border-2 border-rule` on
  `DialogContent`/`AlertDialogContent`.
- **List of items** (search results, tables): one `border-2 border-rule` frame
  with `divide-y-2 divide-rule` rows — not per-item cards. Selected row:
  `bg-brand text-brand-foreground`.
- **Inputs:** base `Input` is already `border-2 border-rule-strong rounded-md`
  with a proper focus ring. Icon inputs: wrap in `relative`, icon absolute
  left, `pl-9`. Passwords: use `PasswordInput`.
- **Brand mark:** `<EqMark />` + `<span className="text-lg font-bold
  tracking-tighter">SongDraw</span>`. Never recreate the bars inline.
- **The drawn track:** `<Cassette />`. The album cover is its J-card and the
  title and artist sit beside it, so **never add a caption block under it** —
  that block and its gap were most of what used to overflow a panel. The cover
  is also the play control; there is no separate play button. Spools turn only
  while audio plays. It replaced a spinning record because the play panel is
  height-constrained and a square hero isn't affordable there. It reads as an
  object through a tonal stack — dark shell, light card, recessed window, dark
  spools — not through extra borders.
- **Danger zone:** `border-2 border-destructive p-4`, no fill.

## Motion

- Micro-interactions only: spring pops on selection
  (`type: "spring", stiffness: 400, damping: 22`), shake on errors
  (`x: [0, -6, 6, -3, 3, 0]`), step slides in multi-step forms.
- **Reduced motion is handled globally** by `MotionConfig reducedMotion="user"`
  in `components/providers.tsx`. You do not need `motion-reduce:` on a
  `motion/react` animation — but you still do on a CSS `animate-*` class.
- No entrance fade-ins on app screens. The marketing landing page is the one
  exception — it reads as a poster — and even there the hero plays once on
  arrival and everything below reveals on scroll with `viewport={{ once: true }}`,
  so nothing stays hidden from a reader who doesn't scroll.
- Ambient motion is CSS-only: the `equalize` keyframes (EQ bars), always with
  `motion-reduce:animate-none`. **No auto-scrolling tickers or carousels** —
  content that moves on its own can't be read at the reader's pace.

## Invariants — do not change

These encode fixed bugs. Changing them reopens the bug.

- **`<body>` is a flex container.** Anything added there becomes a flex item and
  fights the feed's `100svh` scroller. Page-wide overlays belong in a
  pseudo-element in `globals.css`, never as an element in `layout.tsx`.
- **`components/round-feed.tsx` scroller** (`h-[100svh] snap-y snap-mandatory
  overflow-y-scroll overscroll-y-contain`) — untouched.
- **The scroller and every `Shell` panel are both exactly `h-[100svh]`.** One
  room is one snapport, so there is only ever one snap position per room.
  **`svh`, never `dvh`:** `dvh` tracks the iOS toolbar, so it resizes the snap
  area mid-gesture. (The earlier rule here said `min-h-[100dvh]`, never `h-`.
  That was true only while a panel had no scroll region of its own and had to
  grow to avoid clipping — see the next point, which replaces it.)
- **Nothing inside a panel scrolls. The feed's scroller is the only one on the
  screen.** A scroll region inside a panel is worse than the bug it fixes: it
  eats the drag you meant for the feed, and the `overscroll-contain` that stops
  it advancing a room then guarantees you're stuck in it. Content fits instead.
- **The hero is the only elastic zone.** `Cassette` sits in the panel's single
  `flex-1 min-h-0` slot and takes whatever height the state body leaves, so a
  short viewport or a big room shrinks the artwork rather than pushing the
  picker off the bottom. Every other zone is `shrink-0`. Adding a second
  growing block, or an unbounded list, reopens the original bug — which is why
  the member picker goes to three columns past seven others, and the
  submitter's guess list is a wrapping avatar grid rather than a row each.
- The cassette is height-driven with the width constraint folded into `max-h`
  (`h-full w-auto aspect-[8/5] max-h-[calc(min(100vw-3rem,28rem)/1.6)]`), so
  its derived width can never exceed the column and distort the ratio. That
  `3rem` is Shell's `px-6` — change one and change the other.
- Shell's `px-6` also reserves the right-hand gutter `ProgressRail` is fixed
  into. Verified at 320×568, 390×560, 390×664 and 390×844 from 3 to 12 seats:
  every panel equals the viewport, no descendant scrolls, nothing clips, the
  document never scrolls sideways, and the rail clears the content.
- Never add `filter`, `backdrop-filter`, `transform`, `will-change`, `contain`
  or `content-visibility` to the scroller or to `Shell`.
- **A panel's fixed zones are a budget, not just layout.** Every room is the
  same height now, so growing type or padding doesn't change snapping — it eats
  the picker's space instead, and past a point the cassette stops absorbing it.
  Re-measure at 390×664 (the real iOS height with toolbars showing) whenever a
  panel gains a block. `/dev/play` exists for exactly this: it drives the real
  feed with synthetic rounds and a 3–12 seat slider.
- Adding a key to `@theme` needs a dev-server restart; Tailwind caches the
  resolved theme and will silently emit no utility until then.

## Voice

No filler copy ("your way to log in", onboarding explainers). Labels say what
things are; buttons say what they do. Playful is fine, padding is not.
