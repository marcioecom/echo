# Design

Visual system for the Echo Support Inbox. Strategic context lives in
PRODUCT.md; this file captures how the product looks. Register: product.
Colors are OKLCH tokens in `packages/ui/src/styles/globals.css`.
The marketing lime scale (primary `#99c965` plus 50–900) lives in
`packages/ui/src/styles/echo-palette.css` and
`packages/ui/src/tokens/echo-palette.ts` for later dashboard reuse.
Do not map it onto app `--primary` until that dedicated pass.

## Theme

- **Color strategy: Restrained.** Pure white surfaces plus a single moss-green
  accent used for the primary action, current selection, and positive state.
  Everything else is a tinted neutral (chroma 0.004-0.01 toward hue 130).
- **Light first.** The dark palette is structured (same hue, inverted ramp)
  but not yet a designed surface; do a dedicated pass before shipping a
  theme toggle.
- **Scene:** an operator at a lit desk, working a queue for hours. The
  interface lowers the heart rate; nothing shouts.

## Color

Brand anchor (seed): `oklch(0.600 0.154 130)` moss green. The shipped
primary is darkened to pass WCAG AA with white text (measured, not guessed):

| Token | Light value | Contrast (measured) |
|---|---|---|
| `background` | `oklch(1 0 0)` pure white | - |
| `foreground` (ink) | `oklch(0.21 0.01 130)` | 17.7:1 on white |
| `primary` | `oklch(0.54 0.15 130)` | 4.83:1 with white text |
| `muted-foreground` | `oklch(0.52 0.01 130)` | 5.49:1 on white |
| `secondary` / `muted` | `oklch(0.96 0.005 130)` | surface tint |
| `accent` (hover/selected) | `oklch(0.94 0.008 130)` | surface tint |
| `border` / `input` | `oklch(0.915 0.006 130)` | - |
| `ring` | = `primary` | - |
| `destructive` | `oklch(0.577 0.245 27.325)` | 4.91:1 with white text |
| `success` | = `primary` family | positive/resolved state |
| `warning` | `oklch(0.72 0.13 90)` | dark text `oklch(0.24 0.03 90)` |
| `sidebar` | `oklch(0.982 0.004 130)` | second neutral layer |

Rules:
- Saturated fills always carry white/near-white text (never dark text on a
  mid-luminance saturated fill). Pale fills (L > 0.85) carry dark text.
- Green is reserved: primary action, selected nav item icon, positive state.
  Never decoration.
- Never gray text on a tinted background; use the tinted ink ramp.

## Typography

- **One family:** Inter (`--font-sans`), already loaded in
  `apps/web/app/styles.css`. Geist Mono (`--font-mono`) for IDs and data.
- **Fixed rem scale** (product, no fluid type): auth page title `text-3xl`
  semibold tracking-tight; app page title `text-lg` semibold tracking-tight;
  section title `text-sm` medium; body `text-sm`; form control text
  `text-base` (16px); metadata/captions `text-xs` (12px); nav items
  `text-sm` (14px).
- Weight roles: Regular body, Medium labels/nav-active, Semibold page titles
  and key identifiers. No Bold except rare emphasis.
- `text-wrap: balance` on page titles, `pretty` on descriptions.
- `font-kerning: normal` and `font-optical-sizing: auto` set on body.
- Tabular numerals for data columns and timestamps (`tabular-nums`).

## Layout

- **App shell** (`apps/web/modules/shell/`): fixed left sidebar 256px
  (`w-64`) + content column. On mobile (< md) the sidebar becomes an overlay
  with a 40% ink backdrop, Escape-to-close, and a sticky top bar with menu
  button.
- Sidebar anatomy: brand mark + Organization name; grouped nav (primary
  section unlabeled, then a small sentence-case group label like "Settings");
  footer with initials avatar, user name, role, ghost icon menu. The account
  menu keeps its language submenu; it is not a separate control.
- Auth layout: a single centered column (`max-w-md`) below `xl`, with the
  brand mark above the form. At `xl` it splits into the marketing panel and a
  form column; the form column keeps the same readable width.
- Content: `px-4 py-6 md:px-8 md:py-8`, settings pages in `max-w-2xl`.
- Page header pattern: `PageHeader` (title + optional description + actions
  slot), `mb-6`.
- Spacing: 4pt base scale via Tailwind; tight groups (gap 2-3), generous
  section separation (space-y 6-8). No arbitrary values.
- Semantic z-index: `--z-dropdown` 10, `--z-sticky` 20, `--z-overlay` 30,
  `--z-modal` 40, `--z-toast` 50, `--z-tooltip` 60 (use `z-(--z-*)`).

## Components

- shadcn-style components in `packages/ui/src/components` (button, input,
  select, popover, label, form, card, sonner). Add new registry components with
  `pnpm dlx shadcn add <component>` from their owning package. Radius base
  `--radius: 0.625rem`; nothing
  larger than 16px on cards/panels.
- Control scale: default button, input, and select are `h-9`; auth and
  onboarding use the same control height. Default button text is `text-sm`,
  input/select text is `text-base`, and auth primary actions keep
  `text-base`; card padding `20px`; form messages `text-sm`.
- Nav item: `rounded-md px-2.5 py-2 text-sm`, muted text; hover/focus
  `bg-sidebar-accent`; active adds `font-medium` + primary-green icon.
- Icons: Hugeicons (`@hugeicons/react` + `core-free-icons`), stroke style,
  size 16-18, strokeWidth 1.8. Never mix icon sets. The one exception is the
  official multicolor Google "G" in `modules/auth/ui/components/google-mark.tsx`
  used on the sign-in button; third-party brand marks keep their official
  colors.
- Language switch: the dashboard keeps the language submenu inside the
  account menu. The landing nav uses a globe + `PT`/`EN` pill that opens a
  radio menu with full native language names, a checkmark on the active
  choice, and `lang` on each item.
- Empty states: dashed-border panel, icon in `bg-primary/10` circle,
  `text-sm` medium title + one calm sentence of muted text that teaches what
  will appear here.
- Every interactive element: default, hover, focus-visible ring
  (`ring-2 ring-*/30`), active, disabled. No hover-only affordances.

## Motion

- State transitions only: 150-200ms, ease-out, transform/opacity/color.
  Sidebar overlay: fade-in backdrop 150ms, slide-in panel 200ms.
- No orchestrated page-load sequences. No decorative animation.
- Global `prefers-reduced-motion` guard in globals.css collapses all
  animation/transition durations to 0.01ms.

## Accessibility

- WCAG 2.2 AA floor; the token table above carries measured contrast.
- Form controls use 16px text so mobile browsers do not zoom on focus and
  low-vision operators can read typed values comfortably.
- `aria-current="page"` on the active nav item; labeled icon buttons
  (`aria-label`) for menu open/close and sign out. The landing language menu
  exposes the current language in its accessible name.
- State is never color-only; pair with icon or label.
- `::selection` uses primary green.

## Known follow-ups

- Dark mode: tokens structured, needs a real design pass (plus
  `next-themes` provider wiring) before a toggle ships.
- Destructive-on-dark filled contrast (2.71:1) is inherited stock; fix in
  the dark pass.
- User-controlled text size (default/large) as an accessibility preference,
  if the fixed 16px control scale is not enough for the team.
