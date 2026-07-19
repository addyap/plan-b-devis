## Goal
Make the whole internal app render on the same deep espresso maroon (`#2E1011`) background as planb-concept.com, with light text — matching the main site's dark look.

## Scope
- Internal app UI (dashboard, devis editor, clients, factures, settings, auth page).
- **Not changed**: the generated PDF (stays white/printable) and the public client-facing devis view at `/v/$token` (stays white — clients expect a clean document view). Confirm if you want those switched too.

## Approach
The `.dark` theme in `src/styles.css` already defines the exact maroon palette (`--background: #2E1011`, light foreground, gold primary, brick secondary). Rather than rewriting `:root`, promote dark mode to the app's default so every surface uses those tokens.

### Changes
1. **`src/routes/__root.tsx`** — add `className="dark"` to the `<html>` element in `RootShell` so the whole tree resolves the dark tokens on both SSR and client (no hydration mismatch, no browser API needed).
2. **`src/routes/auth.tsx`** — the login page currently hard-codes `bg-[#FAFAFA]` and `text-[#2E1011]`. Swap to semantic tokens (`bg-background text-foreground`) and adjust the card (`bg-card border-border`) so it inherits the maroon theme.
3. **`src/routes/v.$token.tsx`** — wrap its root in a `not-dark` scope (add a `light` class + explicit `bg-white text-[#1a0808]`) so the public client view stays white regardless of the global dark class. Same for any PDF preview dialog surface that needs to stay light.
4. **Spot check surfaces** for any remaining hard-coded `bg-white` / `text-black` in AppShell, dashboard, editor, factures, clients, settings — replace with `bg-card` / `bg-background` / `text-foreground` so they follow the theme. Only touch presentation; no logic changes.

### Verification
- Load `/dashboard`, `/devis/:id`, `/clients`, `/factures`, `/settings`, `/auth` — background is maroon, text legible, gold buttons still primary, brick accents intact.
- Load `/v/<token>` — still white document view.
- Download a PDF — unchanged.

## Open question
Do you want the **public client devis view** (`/v/$token`) and the **PDF** to also switch to maroon? Default in this plan: keep them white so clients get a clean, printable document. Say the word and I'll flip them too.
