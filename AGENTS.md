# WEM Management – Agent Guide

Rules for any agent or contributor working on this repository – the internal invoice management app of WEM. Follow them exactly; when a rule conflicts with a generic best practice, the rule wins.

## 1. Scope

An internal tool for a few signed-in users. Czech UI, desktop-first, fully usable from 375 px.

| Route | Purpose |
| --- | --- |
| `/` | Invoice dashboard |
| `/invoice-editor` | New invoice; `?iid=<id>` edits a saved one |
| `/auth`, `/auth-error` | Google sign-in, missing profile |

## 2. Frozen zones

Never restyle or refactor these unless explicitly asked:

- **Everything rendered by `src/features/invoice/components/InvoicePreview.tsx`** – markup, classes (`gray-*`, `rounded-lg`, `shadow-sm` and `text-primary` are allowed *only* here), page split (8 / 18 items), texts.
- `#print-area`, the `body`, `@page` and `@media print` rules in `src/app/globals.css`.
- `src/app/hero.ts` and the HeroUI theme. The PDF captures every stylesheet of the page, and the preview total uses `text-primary` – a theme change restyles every sent invoice.
- `getInvoiceHTML()` in `InvoiceEditor.tsx` (`#print-area` `outerHTML` + all stylesheets → Puppeteer).
- `src/components/common/WEMLogo.tsx` – also rendered in the invoice.
- Firestore schemas in `src/features/firebase/collections.tsx` – only additive changes that need no data migration.

Wrappers *around* `#print-area` (scroll containers, tabs) are fine; nothing inside it may change.

## 3. Colour tokens

Defined with `@theme` in `src/app/globals.css`.

| Token | Value | Use |
| --- | --- | --- |
| `ink` | `#0a0a0a` | Text, primary buttons, active navigation |
| `brand` | `#fdc746` | Small accents only: active nav marker, unsaved indicator dot |
| `brand-strong` | `#fdb817` | Hover state of `brand` only |
| `mist` | `#f5f5f5` | App background |
| `white` | `#ffffff` | Panels, inputs, navbar |

Rules:

- Use tokens (`bg-ink`, `bg-mist`) – never hex literals like `bg-[#0a0a0a]`.
- Greys come from `neutral-*` only. Never `gray-*`, `slate-*`, `zinc-*` outside the invoice preview.
- No `blue-*` and no HeroUI `color="primary"` in the app UI.
- HeroUI semantic colours are reserved for meaning: `success` / `warning` / `danger` for statuses, `danger` for destructive actions and errors.
- `brand` is never text on a light background (contrast 1.6:1).
- Secondary text: `text-neutral-600` (body), `text-neutral-500` (labels, hints).

## 4. Typography

Font: Geist Sans (`src/config/fonts.ts`).

| Role | Classes |
| --- | --- |
| Page title | `text-2xl font-semibold tracking-tight` |
| Panel title | `text-base font-semibold` |
| Body | `text-sm` (HeroUI default) |
| Hint / label | `text-sm text-neutral-500` |
| Stat value | `text-2xl font-semibold tabular-nums` |

- Amounts, dates, counters: `tabular-nums`. Invoice numbers and IDs: `font-mono`.
- Money: `Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" })`. Dates: `toLocaleDateString("cs-CZ")`.
- Sentence case everywhere – no uppercase table headers or buttons.

## 5. Layout

- Every page: navbar (root layout) → `PageShell` → `Panel`s.
- `PageShell` provides the container (`mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 md:py-8`) and the header: title + optional description left, actions right.
- `Panel` is the only surface: `bg-white border border-neutral-200 rounded-lg p-5 md:p-6`, optional title and actions. No shadows on panels.
- Shadows only on overlays (modal, dropdown, toast – HeroUI defaults).
- Spacing: `gap-6` between panels, `gap-4` between fields. Forms: 1 column, `md:grid-cols-2` where fields are short.
- Invoice editor: from `xl` form left + preview right; below `xl` tabs `Údaje` / `Náhled`. Both panels stay mounted (hidden with CSS) so `#print-area` always exists. The preview sits in an `overflow-x-auto` wrapper.

## 6. Components

Shared primitives live in `src/components/common/`:

| Component | Purpose |
| --- | --- |
| `PageShell` | Container + page header (`title`, `description`, `actions`, optional `backHref`) |
| `Panel` | White surface with optional `title` and `actions` |
| `LoadingState` | Centered `Spinner` with a label |
| `EmptyState` | Title, description and optional action for empty lists and errors |

Auth: pages call `useRequireProfile()` (`src/features/auth/`), never re-implement the sign-in / profile redirects.

Buttons – always HeroUI `Button` with `radius="sm"`:

| Kind | Props |
| --- | --- |
| Primary | `className="bg-ink text-white"` – at most one per screen |
| Secondary | `variant="bordered"` |
| Tertiary | `variant="light"` |
| Destructive | `color="danger" variant="flat"` (icon-only: `variant="light"`) |

- Icon-only buttons always have a Czech `aria-label`.
- Navigation uses `next/link` (or `router.push` for row actions). No `href="#"`.
- Icons come from `src/features/invoice/components/Icons.tsx`; add new ones there as inline SVG.

## 7. Interaction

- **Async actions**: the triggering button gets `isLoading` and the action cannot run twice.
- **Feedback**: success → `addToast({ title, color: "success" })`; failure → `addToast({ title, description, color: "danger" })` + `console.error`. Never `alert()` / `confirm()` / `prompt()`.
- **Confirmation**: HeroUI `Modal`, only for deleting persisted data or leaving unsaved changes. Local edits (e.g. removing an unsaved item) need none.
- **Forms**: fully controlled (`value`, not `defaultValue`), immutable updates – never mutate props or state objects. Show what is missing before a save/send instead of failing silently.
- **Unsaved changes**: show the `Neuloženo` chip, warn on `beforeunload` and on in-app back navigation.
- **Lists**: every list has a loading (`Skeleton`/`LoadingState`), empty and error state (`EmptyState` with „Zkusit znovu“).
- **Tables**: row navigation via `onRowAction` so rows work with the keyboard.

## 8. Accessibility and responsiveness

- Never remove focus rings (`outline-none`, `focus:ring-0`).
- Everything operable by keyboard; modals trap focus (HeroUI default).
- Inputs always have a visible `label`.
- Check 375, 768, 1280 and 1536 px. Only the invoice preview may scroll horizontally.
- Navbar collapses into `NavbarMenu` below `sm`.

## 9. Copy (Czech)

- Buttons are verbs: „Uložit“, „Odeslat“, „Tisk“, „Přidat položku“.
- Errors say what happened and what to do: „Faktura nebyla uložena. Zkuste to znovu.“
- No exclamation marks, no emoji, no English placeholders.
- Typography: non-breaking space after one-letter words (`&nbsp;` / `\u00a0`), spaced en dash ` – `, Czech quotes „…“, phones as `+420 775 128 978`.

## 10. Banned patterns

- `gray-*`, `blue-*`, hex colours, `shadow-*` on panels outside the invoice preview
- HeroUI `color="primary"`, `variant="ghost"` buttons
- `InputOtp` for IDs (IČO is a normal `Input`)
- `window.alert` / `confirm`, silent `catch` blocks in UI code
- State mutation (`item.price = …`), `defaultValue` on editor fields
- `dangerouslySetInnerHTML` with unescaped user values
- Uppercase headings / table headers, decorative gradients, blur panels
- New dependencies

## 11. Code style

Match the existing code:

- `"use client"` as the first line of files using hooks or HeroUI.
- Default-exported function components, PascalCase; file name equals component name.
- Props typed with `interface XProps` directly above the component; defaults in destructuring.
- 4-space indentation, double quotes, semicolons.
- Imports via `@/`; order: `react` / `next` → `@heroui/*` → other packages → `@/components` → `@/features`.
- Domain logic stays in `src/features/<domain>/` (`Models.tsx`, `components/`, `server/Repository|Service|Actions.tsx`).
- Comments only for what the code cannot say, one short line.

## 12. Definition of done

1. `npx tsc --noEmit` and `npm run build` pass (`.env.local` with `NEXT_PUBLIC_FIREBASE_*` required); `npx eslint` reports no new problems in touched files.
2. Checked at 375, 768, 1280 and 1536 px; no page-level horizontal scroll.
3. Keyboard pass: every interactive element reachable with a visible focus ring.
4. Flows work: sign-in, dashboard search/sort/open, create → save → reload → send, print.
5. Invoice preview, print output and sent PDF look identical to before; no diff in what `InvoicePreview.tsx` renders.
6. Touched files outside the preview contain no `gray-`, `blue-`, hex colours, `shadow-` on panels or `color="primary"`.
