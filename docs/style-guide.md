# SongDraw Style Guide

Brutalist, light-mode-first, Spotify-inspired energy. Flat surfaces, hard 2px
rules, one loud accent. Built on shadcn components — restyle via `className`,
don't fork components unless the change is global.

## Principles

- **Flat, not soft.** No gradients, no blur blobs, no soft drop shadows, no
  glassmorphism. Depth comes from hard offset shadows only.
- **Type does the talking.** Big, black, tight. Decoration is a border or a
  brand-colored block behind a word — never gradient text.
- **One accent.** Brand yellow for the primary action and highlights. Never
  two accent colors on one screen.
- **Mobile first.** Tap targets ≥44px (`h-11`/`h-12` for primary controls).

## Color

Always use tokens, never raw hex/oklch in components:

| Token | Use |
|---|---|
| `bg-brand` / `text-brand-foreground` | primary CTA, highlights, selected states |
| `bg-primary` (near-black) | brand mark tile, solid emphasis |
| `border-foreground` | all structural borders (always `border-2`) |
| `text-muted-foreground` | secondary text |
| `destructive` | errors, danger zone only |

Brand is defined once in `app/globals.css` (`--brand`). Change it there, never
inline.

## Typography

- **Display / page titles:** `font-black tracking-tight uppercase` (hero:
  `tracking-tighter leading-[0.95]`). Highlight one word with
  `bg-brand px-3 text-brand-foreground inline-block -rotate-1` (hero only).
- **Section eyebrows / labels:** `font-mono text-xs font-semibold
  tracking-widest uppercase text-muted-foreground`.
- **Meta text** (taglines, emails, descriptions, empty states): `font-mono
  text-sm text-muted-foreground`.
- **Body:** default sans, `font-medium`/`font-bold` for emphasis.

## Borders, radius, shadows

- Structural borders and dividers: `border-2 border-foreground`,
  `divide-y-2 divide-foreground` (`sm:divide-x-2` in grids).
- Radius: containers/cards/dialogs `rounded-none`; inputs `rounded-md`;
  buttons and search inputs `rounded-full` (pills); album art square
  (`rounded-none`); people avatars stay circles.
- Shadows: only hard offsets on floating/key surfaces —
  `shadow-[6px_6px_0_0_var(--color-foreground)]` (auth cards),
  `shadow-[4px_4px_0_0_var(--color-foreground)]` (sticky bars). Nothing else.

## Component recipes

- **Primary CTA:** `<Button variant="brand" className="h-12 rounded-full
  text-base">` — yellow pill, bold dark text. One per view.
- **Secondary:** `<Button variant="outline" className="rounded-full">` —
  2px black outline pill, inverts to solid on hover.
- **Card (auth/forms):** `<Card className="rounded-none border-2
  border-foreground shadow-[6px_6px_0_0_var(--color-foreground)] ring-0">`.
- **Dialogs:** `rounded-none border-2 border-foreground` on
  `DialogContent`/`AlertDialogContent`.
- **List of items** (search results, tables): one `border-2 border-foreground`
  frame with `divide-y-2 divide-foreground` rows — not per-item cards.
  Selected row: `bg-brand text-brand-foreground`.
- **Inputs:** base `Input` is already `border-2 border-foreground rounded-md`
  with a brand focus ring. Icon inputs: wrap in `relative`, icon absolute
  left, `pl-9`. Passwords: use `PasswordInput`.
- **Brand mark:** `<EqMark />` + `<span className="text-lg font-bold
  tracking-tighter">SongDraw</span>`. Never recreate the bars inline.
- **Danger zone:** `border-2 border-destructive p-4`, no fill.

## Motion

- Micro-interactions only: spring pops on selection
  (`type: "spring", stiffness: 400, damping: 22`), shake on errors
  (`x: [0, -6, 6, -3, 3, 0]`), step slides in multi-step forms.
- No entrance fade-ins on static pages. Ambient motion is CSS-only:
  `equalize` (EQ bars) and `marquee` keyframes, always with
  `motion-reduce:animate-none`.
- Client pages use `motion/react`; server pages get CSS animations only.

## Voice

No filler copy ("your way to log in", onboarding explainers). Labels say what
things are; buttons say what they do. Playful is fine, padding is not.
