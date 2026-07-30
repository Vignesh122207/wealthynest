# Graphics Specification + Screenshot Plan

Source assets already exist at `wealthynest-web/public/icons/` (`icon-512.png`,
`icon-maskable-512.png`) and native splash screens are already generated into
`wealthynest-web/android/app/src/main/res/drawable*/splash.png`. Everything below either reuses
those or specifies new graphics that must still be produced (feature graphic, promo graphic,
screenshots — none of these exist yet as Play-ready assets).

## App Icon

| Spec | Requirement |
|---|---|
| Size | 512×512 px |
| Format | 32-bit PNG, with alpha |
| Max file size | 1 MB |
| Shape | Play applies its own mask — supply a full-bleed square, no pre-rounded corners |
| Source | `public/icons/icon-512.png` — confirm this is the final brand mark (copper/brand gradient per `manifest.json`'s `theme_color: #c2703d`), not a placeholder |
| Also produce | Adaptive-icon foreground/background layers already exist in `android/app/src/main/res/mipmap-*` per `ANDROID_APP_ROADMAP.md`'s note that these were regenerated at the correct 108–432px range — reuse those, don't regenerate from the 512px source again |

**Action needed**: confirm `icon-512.png` is pixel-final (not a dev placeholder) before upload — this
is the one asset every single store surface (search results, install button, Play Store home,
notification icon) shows.

## Feature Graphic — REQUIRED, does not exist yet

| Spec | Requirement |
|---|---|
| Size | 1024×500 px exactly |
| Format | PNG or JPEG, no alpha |
| Content | Brand mark + app name + a one-line value prop over your existing dark background color (`#030C17` per `manifest.json`'s `background_color`) with the copper accent (`#c2703d`) as the highlight color — keep it consistent with the in-app look, don't invent a new palette for this one asset |
| Safe zone | Keep all text inside the center ~80%; Play crops edges on some placements (TV banner reuse, cross-promotion tiles) |
| Suggested copy on the graphic itself | "Budget. Invest. Grow. Together." — short enough to read at thumbnail size; do not put the full tagline from the short description on the graphic, it won't be legible below ~200px wide |

## Phone Screenshots

| Spec | Requirement |
|---|---|
| Count | Minimum 2, **use all 8 allowed** — more real screens shown = higher conversion, and you have more than 8 genuinely distinct screens |
| Size | 16:9 or 9:16, min 320px, max 3840px per side (recommend actual device resolution, e.g. 1080×2400) |
| Format | PNG or JPEG, no alpha |
| Source | `playwright/tests/visual/` screenshots are dev-tool captures (correctness baselines, not marketing-grade) — do NOT submit those directly; use them only as a same-state reference to reproduce on a real/emulated device with populated demo data, a captioned frame, and no dev cruft (no visible test IDs, no browser chrome, no empty-state placeholders) |

### Suggested screenshot order (highest-converting screens first — Play shows the first 2–3 above
the fold in search results, so this order is not arbitrary):

1. **Home/Dashboard** (`(dashboard)/home`) — the "smart insight" card + upcoming bills widget makes
   the strongest single first impression: shows the app is already smart, not just a spreadsheet.
2. **Budgets** (`(dashboard)/budgets`) — monthly/yearly split view with a shared-budget "Shared" badge
   visible, showing the family-budgeting differentiator immediately.
3. **Family / Split expenses** (`(dashboard)/family`) — per-member spending chart + the Split-with-family
   settle-up flow. This is the single hardest-to-copy differentiator vs. any US budgeting app; put it
   early, not buried.
4. **Investments** (`(dashboard)/investments`) — portfolio view with NSE live price + XIRR, proves
   this isn't "just" a budgeting toy.
5. **Net worth / Assets** (`(dashboard)/assets`) — the net-worth trend line chart (assets − liabilities
   over time) — the "big picture" screen that closes the "why should I care" loop.
6. **Expenses/Transactions with CSV import** (`(dashboard)/expenses`) — show the import-review table
   mid-flow (bank/UPI statement → editable preview), which answers "is data entry going to be tedious"
   before the user even asks.
7. **Vault** (`(dashboard)/vault`) — the encrypted logins/notes vault is a differentiator most finance
   apps don't have at all; show it after the core money screens so it reads as a bonus, not a distraction
   from the primary pitch.
8. **Security / Sign-in options** (`settings/security`) — PIN + passkey + native fingerprint screen,
   closing on trust/security since this is a financial app and that's the last objection before install.

### Suggested captions (short, benefit-first, matching the actual visible screen — not generic
stock-photo captions)

1. Home — **"Your whole financial picture, one glance."**
2. Budgets — **"Set it once. Share it with your family."**
3. Family — **"Split any expense. Settle up in one tap."**
4. Investments — **"Stocks, mutual funds, gold, FDs, bonds — one portfolio."**
5. Net worth — **"Watch your net worth grow, month over month."**
6. Expenses — **"Import your bank statement. Review before you save."**
7. Vault — **"Your logins and notes, encrypted, right alongside your money."**
8. Security — **"Fingerprint, passkey, or PIN — you choose."**

## Tablet Screenshots

| Spec | Requirement |
|---|---|
| Count | Optional but **recommended** — Play surfaces tablet screenshots specifically on tablet/Chromebook listings, and this app's targetSdk 36 + responsive Tailwind layout already renders correctly at tablet widths (no native tablet-specific layout work needed) |
| Size (7") | 1024×600 min | 
| Size (10") | 1280×800 min, up to 7680×7680 |
| Which screens | Reuse the same 4–6 highest-value screens from the phone set (Home, Budgets, Investments, Net worth) at the wider layout — don't create different content, just re-capture at tablet viewport width |
| Caveat | This is a `server.url` WebView (see `ANDROID_APP_ROADMAP.md`), so tablet screenshots are literally the responsive website at a wider viewport — capture in an actual tablet emulator/device build, not by resizing a phone browser window, so what's shown matches what a tablet installer actually sees |

## Promo Graphic — Optional (legacy field, low priority)

| Spec | Requirement |
|---|---|
| Size | 180×120 px |
| Note | Play deprecated most surfaces that used this graphic years ago; low ROI to invest design time here — reuse a cropped/scaled version of the feature graphic's icon+wordmark lockup rather than commissioning a new design |

## Screen-by-screen marketing review (for anyone designing the actual screenshot frames)

When producing the 8 phone screenshots, use **populated demo data**, not empty states — an empty
Investments screen or a zero-balance Budgets screen reads as "this app has nothing in it" to a
first-time viewer. Seed a demo family account with:
- 2–3 family members with visible avatars
- At least one shared budget past 60% of its threshold (shows the alert UI without looking like
  a failure state)
- A mixed investment portfolio (a couple of NSE stocks, one mutual fund, one gold/FD entry) so the
  portfolio screen shows real variety — don't seed a PPF or NPS entry, there's no "add" form for
  either type today (see `01-store-listing-and-aso.md`'s correction note)
- A net-worth history with at least 4–5 months of (synthetic) data so the trend line actually trends

Do not screenshot the `admin/` or `analytics/` (internal) surfaces, `notifications/` empty state, or
any settings sub-page not in the ordered list above — keep the 8 slots to the highest-conversion
screens only.
