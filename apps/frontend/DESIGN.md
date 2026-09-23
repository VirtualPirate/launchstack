# Design system

The visual and verbal rules for the web app. This file is the source of truth: when a screen and this document disagree, fix the screen. Precedence: the user's explicit request, then this document, then component defaults.

Colors, fonts and radius tokens live in `src/index.css`. This file does not repeat them. Add a palette section here when the product picks one.

---

## 1. Principles

1. **Lead with what the reader needs.** Plain-language headline and next step first. Technical detail (ids, counts, raw status codes) is supporting texture, never the lede.
2. **One accent, spent well.** Use the `primary` token for the one thing to do on a screen. Everything else is a neutral or a semantic signal (`destructive`). Do not introduce new hues.
3. **State reads at a glance.** Encode status in shape and tint (badge, dashed border, muted text), not only in words.
4. **Quiet by default.** Motion and decoration serve comprehension. If a flourish does not help someone understand or act, cut it.

---

## 2. Shape and spacing

- Controls (buttons, inputs, selects): `rounded-lg`. Cards and surfaces: the `<Card>` default. Empty/error surfaces: `rounded-2xl border-dashed`. Pills and badges: `rounded-full`.
- One separation per surface: a border or a shadow, not both.
- Page content: centered, `mx-auto max-w-3xl` (forms, settings) or `max-w-4xl` (tables), `py-6`.
- Between page sections: `space-y-6`. Lay siblings out with `gap`/`space-*`, not per-child margins.

---

## 3. Motion

- Default transition `~150ms` on color, transform and shadow.
- Loading: skeletons that mirror the final layout (`SkeletonList`), not a "Loading..." line.
- Honor `prefers-reduced-motion`. Never animate essential meaning.
- Visible keyboard focus everywhere (the `Button`/`Input` built-ins, or `focus-visible:ring-3 focus-visible:ring-ring/50`).

---

## 4. Component recipes

Reach for the shared components (`src/components/shared/`) first. Compose primitives only when none fits.

**Page header** — `PageHeader` (`title`, optional `description`, `actions`, `eyebrow`). Every page starts with one. Actions are right-aligned buttons.

**Section label** — `SectionLabel` for a small uppercase mono label above a group.

**Empty / error / loading** — `EmptyState`, `ErrorState` (with `onRetry` when the query can be refetched), `SkeletonList`. Error surfaces carry the `destructive` tint. **Every empty state names one next action**: pass it as `action` (a button or link), and say in the description what the screen is for.

**Feedback** — form errors inline under the form (`text-sm text-destructive`, `role="alert"`). Errors from actions without a form (table buttons, menus) go to `toast.error(extractErrorMessage(err))`.

**Buttons** — via `<Button>`, one hierarchy per screen:
- `default` — the single primary action.
- `outline` / `secondary` — secondary actions.
- `ghost` — tertiary and toolbar actions (row actions in a table).
- `destructive` — removals and deletes.

Only one `default` button per view. If two actions compete, one of them is secondary.

---

## 5. Voice

Words are design material. Write from the reader's side of the screen.

- **Plain over precise-but-technical.** "Sign-in is more reliable," not "hardened the OAuth token refresh path." Name things people recognize.
- **Active voice, sentence case.** A control says what it does: "Save changes," "Create organization," "Send invite." The action keeps its name through the flow (button "Delete" → toast "Deleted").
- **Specific over clever.** "No pending invites — ask a teammate to invite you, or create your own organization" beats "Nothing to see here."
- **Failure gives direction, not apology.** "Couldn't send the invite — that email is already a member." No "Oops," no bare "Something went wrong" when the API gave a reason.
- **Empty screens invite action.** State what this is and the one thing to do next.
- Numbers get plain units: "5 members," "expires in 7 days."
