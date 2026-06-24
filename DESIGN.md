# Handoff: AstroPage — Student Portal UI

## Overview
AstroPage is a dark-mode student portal that connects to EduPage school management system via a REST API. It provides students with a dashboard, homework management (with AI draft generation), canteen meal ordering, and account/AI settings.

## About the Design Files
The file `AstroPage.dc.html` in this bundle is a **design reference created in HTML** — a high-fidelity interactive prototype showing the intended look, layout, and interactions. It is **not** production code to copy directly.

Your task is to **recreate this design in your existing frontend codebase** (React, Vue, etc.) using its established patterns and libraries — or, if starting fresh, choose the most appropriate framework and implement the designs there. Use the prototype as a visual and behavioral reference; lift the exact values documented below.

## Fidelity
**High-fidelity.** This is a pixel-accurate mockup with final colors, typography, spacing, and interactions. The developer should recreate the UI pixel-perfectly using the codebase's existing libraries and patterns.

---

## Design Tokens

### Colors
```
--bg-main:       #0a0805   /* page background */
--bg-sidebar:    #0e0c09   /* sidebar background */
--bg-card:       #161208   /* card / panel background */
--bg-card-hover: #1c1710   /* card on hover */
--bg-drawer:     #120f0b   /* homework drawer */

--copper:        #B08D57   /* primary accent — buttons, active nav, labels */
--copper-dim:    rgba(176,141,87,0.12)  /* subtle tinted bg */
--copper-border: rgba(176,141,87,0.14) /* default card border */
--copper-border-strong: rgba(176,141,87,0.28) /* focused/active border */

--cream:         #E8DCC7   /* primary text */
--cream-60:      rgba(232,220,199,0.60) /* secondary text */
--cream-35:      rgba(232,220,199,0.35) /* muted text */
--cream-20:      rgba(232,220,199,0.20) /* very muted / placeholders */

/* Status colors */
--status-done-bg:     rgba(50,90,60,0.20)
--status-done-border: rgba(50,90,60,0.35)
--status-done-text:   #88c8a0

--status-overdue-bg:     rgba(90,40,40,0.20)
--status-overdue-border: rgba(90,40,40,0.35)
--status-overdue-text:   #c88888

--status-due-soon-bg:     rgba(110,78,20,0.20)
--status-due-soon-border: rgba(110,78,20,0.35)
--status-due-soon-text:   #d4a85a

--status-pending-bg:     rgba(30,54,84,0.20)
--status-pending-border: rgba(30,54,84,0.35)
--status-pending-text:   #7ab0d4

/* Metric card dots */
--dot-tasks:      #B08D57
--dot-attendance: #4a8c62
--dot-grade:      #4a7a8c
```

### Typography
```
Display / headings:  Cormorant Garamond, serif — weights 400, 500, 600; italic for accents
Body / UI:           Inter, sans-serif — weights 300, 400, 500
Labels / mono:       JetBrains Mono, monospace — weights 400, 500

Page title:        Cormorant Garamond 34px / weight 500 / color #E8DCC7 / tracking -0.01em
Section eyebrow:   JetBrains Mono 9px / weight 400 / UPPERCASE / tracking 0.18em / color rgba(176,141,87,0.5)
Card label/badge:  JetBrains Mono 9px / UPPERCASE / tracking 0.12–0.16em
Card title:        Inter 14px / weight 500 / color #E8DCC7
Card body:         Inter 13px / weight 300–400 / color rgba(232,220,199,0.42)
Metric number:     JetBrains Mono 40px / weight 400 / color #E8DCC7 / tracking -0.02em
Nav item:          Inter 13px / weight 400
Sidebar subdomain: JetBrains Mono 8px / tracking 0.06em / color rgba(232,220,199,0.28)
```

### Spacing
```
Page padding:           36px top, 40px left/right
Card padding:           18–20px
Card gap (grid):        12–14px
Sidebar width:          236px
Section gap:            28–32px
Border radius (cards):  10px
Border radius (inputs): 6px
Border radius (badges): 4px
Border radius (drawer): 0 (full height)
```

### Shadows / Effects
```
Grain overlay: fixed, inset: -50%, opacity 0.055, mix-blend-mode overlay
  SVG feTurbulence fractalNoise baseFrequency 0.9, numOctaves 2
  Animated: grain keyframes, 1.4s steps(6) infinite

Drawer shadow: -24px 0 60px rgba(0,0,0,0.5)
Login card shadow: 0 24px 80px rgba(0,0,0,0.6)
Page vignette (login): radial-gradient, transparent 55% → rgba(0,0,0,0.5) 100%
```

---

## Screens / Views

### Screen 1 — Login (unauthenticated)
**Purpose:** Authenticate via EduPage credentials. No sidebar.

**Layout:**
- Full-screen centered, background `#0a0805`
- Radial gradient glows: violet-amber tinted blobs top-left and bottom-right
- Vignette overlay (darkens edges)
- Single card: `width 340px`, `background #161208`, `border-radius 16px`, `border 1px solid rgba(176,141,87,0.22)`, `padding 36px 32px`

**Card contents (top to bottom):**
1. Eyebrow: `JetBrains Mono 9px UPPERCASE` — "EduPage · Prihlásiť sa"
2. Logo: horizontal rule `1px × 16px` | `Cormorant Garamond 20px UPPERCASE tracking 0.14em` "AstroPage" | horizontal rule
3. `1px` divider `rgba(176,141,87,0.12)`
4. Three fields (Škola / Meno / Heslo): label in `JetBrains Mono 9px UPPERCASE`, input `Cormorant Garamond 17px`
5. Submit button: `background #B08D57`, `color #0a0805`, full-width, `JetBrains Mono 10px UPPERCASE tracking 0.22em`, `border-radius 6px`, `padding 13px`
6. Privacy note: `JetBrains Mono 8px`, centered, `rgba(176,141,87,0.28)`

**States:**
- `idle` — button text "Prihlásiť sa →"
- `submitting` — button text "Prihlasovanie…", disabled
- `error` — red alert panel (background `rgba(100,48,48,0.2)`, border `rgba(100,48,48,0.35)`, text `#c88888`) above button

**API:** `POST /api/v1/auth/login` body `{ username, subdomain, password }` → HttpOnly JWT cookie  
Rate limit: 429 → "Príliš veľa pokusov, skúste za minútu."

---

### Screen 2 — Dashboard (/)
**Purpose:** Overview of the student's day.

**Layout:**
- Sidebar (236px) + scrollable main (`padding 36px 40px`)

**Components:**

**Page header:**
- Eyebrow: current day + date in `JetBrains Mono 9px`
- Title: `Cormorant Garamond 34px` "Dobrý deň, [Meno italic copper]."

**Urgent banner** (visible only when `due_within_24h > 0`):
- `background rgba(120,88,32,0.14)`, `border rgba(140,106,48,0.3)`, `border-radius 8px`, `padding 11px 16px`
- Amber dot (6px) + message text `Inter 13px #d4a85a`
- Right: "Otvoriť →" link `JetBrains Mono 9px`, navigates to Homework

**3 Metric cards** (`display grid, grid-template-columns repeat(3,1fr), gap 14px`):
Each card: `background #161208`, `border rgba(176,141,87,0.14)`, `border-radius 10px`, `padding 20px`
- Colored dot (7px circle) + label `JetBrains Mono 9px UPPERCASE`
- Big number `JetBrains Mono 40px #E8DCC7`
- Sub-label `Inter 11px rgba(232,220,199,0.32)`
- Card 1 (copper dot): Pending tasks — count of non-done homework
- Card 2 (green dot `#4a8c62`): Dochádzka — static 94%
- Card 3 (sky dot `#4a7a8c`): Posledná známka — static B+

**Today's Schedule** — vertical timeline:
- Section header: `JetBrains Mono 9px UPPERCASE` + `1px` divider line
- Per item: flex row — `[dot 9px circle]` + `[card]`
- Card: `background`, `border`, `border-radius 8px`, `padding 11px 14px`
  - Subject `Inter 13px weight 500` + optional badge
  - Room · Teacher `JetBrains Mono 9px rgba(232,220,199,0.3)`
  - Time range right-aligned `JetBrains Mono 10px`

**Schedule item states:**
- `past`: dot `rgba(176,141,87,0.32)`, card bg `rgba(232,220,199,0.03)`, text muted
- `now`: dot `#B08D57`, card bg `rgba(176,141,87,0.12)`, border `rgba(176,141,87,0.32)`, badge "Teraz" — copper bg, dark text
- `cancelled`: dot `rgba(232,220,199,0.15)`, text `rgba(232,220,199,0.28)`, badge "Zrušená" — red tinted bg
- `normal`: dot `rgba(176,141,87,0.32)`, card bg `rgba(232,220,199,0.03)`

**API:** `GET /api/v1/dashboard/summary`
Returns: `{ date, pending_homework, due_within_24h, lessons_total, lessons_cancelled, schedule: [...] }`

---

### Screen 3 — Homework (/homework)
**Purpose:** Browse, filter, and manage homework assignments.

**Layout:**
- Same sidebar + main (`padding 36px 40px`)

**Filter bar** (flex row, gap 8px):
- Search input (decorative, magnifier icon) — `background #161208`, `border rgba(176,141,87,0.14)`, `padding 8px 12px`
- Filter pills: All / Čoskoro / Pending / Oneskorené / Hotové
  - Active: `background rgba(176,141,87,0.12)`, `border rgba(176,141,87,0.32)`, text `#B08D57`
  - Inactive: transparent bg, `border rgba(176,141,87,0.12)`, text `rgba(232,220,199,0.42)`

**Card grid** (`display grid, grid-template-columns 1fr 1fr, gap 12px`):
Each card: `background #161208`, `border rgba(176,141,87,0.14)`, `border-radius 10px`, `padding 18px`, `cursor pointer`
- Hover: `border-color rgba(176,141,87,0.3)`, `background #1c1710`
- Subject: `JetBrains Mono 9px UPPERCASE #B08D57`
- Status badge (top-right): see status colors above
- Title: `Inter 14px weight 500 #E8DCC7`
- Description: `Inter 12px`, 2-line clamp, `rgba(232,220,199,0.42)`
- Footer: calendar icon + due date `JetBrains Mono 9px` | teacher name right-aligned

**Status logic** (computed from `due_date` and `is_done`):
- `done` — `is_done === true`
- `overdue` — diff < 0 hours
- `due-soon` — 0 ≤ diff < 24 hours
- `pending` — diff ≥ 24 hours

**Click** → opens Detail Drawer (see below)

**Loading state:** skeleton pulse cards (same grid, bg `rgba(176,141,87,0.06)` animated pulse)
**Empty state:** dashed border box, centered muted text

**APIs:**
- `GET /api/v1/homework/list` → array
- `POST /api/v1/homework/{id}/done` body `{ done: bool }`

---

### Screen 3b — Homework Detail Drawer
**Purpose:** View homework details, mark as done, generate AI draft.

**Layout:**
- Fixed right panel: `width 460px`, `height 100vh`, `background #120f0b`, `border-left 1px solid rgba(176,141,87,0.18)`
- Slide-in: `transform translateX(0)` open / `translateX(100%)` closed
- `transition: transform 0.32s cubic-bezier(0.2,0.7,0.15,1)`
- Semi-transparent backdrop behind drawer (z-index 49): `background rgba(0,0,0,0.42)`, fade in/out on `opacity`
- Internal padding: `24px 24px 48px`

**Contents:**
1. Header row: [subject label + title + teacher/due] | [close button 28×28px]
2. Status badge
3. `1px` divider
4. **Mark as done button** — full width, dynamic styles:
   - Undone: `bg rgba(176,141,87,0.12)`, `border rgba(176,141,87,0.25)`, `color #B08D57`, text "Označiť ako hotové"
   - Done: `bg rgba(50,90,60,0.18)`, `border rgba(50,90,60,0.35)`, `color #88c8a0`, text "✓ Hotové — kliknúť na zrušenie"
   - Optimistic update: toggle immediately, roll back on API failure
5. **Description section:** `JetBrains Mono 9px` label + `Inter 13px` body text
6. `1px` divider
7. **AI section** (3 states):
   - **Idle:** Button "Nechaj AI vypracovať" with sparkle icon — `bg rgba(176,141,87,0.08)`, `border rgba(176,141,87,0.25)`
   - **Loading:** Spinner (CSS `border-top-color transparent, animation spin 0.8s linear infinite`) + 3 skeleton lines + text "AI generuje návrh…"
   - **Ready:** Emerald success banner + editable `<textarea>` with mono font + note "Nič sa neodovzdáva automaticky."

**API:**
- `POST /api/v1/homework/{id}/done` body `{ done: bool }` → `{ assignment_id, is_done }`
- `POST /api/v1/homework/generate-ai` body `{ assignment_id, force?: bool }` → `{ assignment_id, draft, cached, created_at }`

---

### Screen 4 — Canteen (/canteen)
**Purpose:** View weekly menu and manage meal orders.

**Layout:**
- Same sidebar + main (`padding 36px 40px`)

**Bulk Automation panel** (`background #161208`, `border rgba(176,141,87,0.18)`, `border-radius 10px`, `padding 20px 22px`):
- Header: sparkle icon + "Auto-objednávka" label `JetBrains Mono 9px UPPERCASE #B08D57`
- Grid: `[number input "Počet dní 1–31"]` `[select "Preferované menu" A/B/…]` `[button "Spustiť →"]`
- Button: `bg #B08D57`, `color #0a0805`, `JetBrains Mono 9px`

**Week tabs** (horizontal pill row):
- Active: `bg rgba(176,141,87,0.12)`, `border rgba(176,141,87,0.3)`, `color #B08D57`
- Inactive: transparent, `border rgba(176,141,87,0.12)`, `color rgba(232,220,199,0.3)`
- Tabs: "Tento týždeň", "Budúci týždeň", "Za 2 týždne"

**Day cards grid** (`display grid, grid-template-columns repeat(5,1fr), gap 10px`):
Each card: `background #161208`, `border rgba(176,141,87,0.14)`, `border-radius 10px`, overflow hidden

**Card header:**
- Day name: `JetBrains Mono 9px UPPERCASE rgba(232,220,199,0.4)`
- Date: `Cormorant Garamond 20px #E8DCC7`
- Status badge: "Prihlásený — Menu A/B" (emerald) or "Neprihlásený" (muted)

**Closed day:** centered "Zatvorené" `JetBrains Mono 9px UPPERCASE rgba(232,220,199,0.18)`

**Open day (2 meal options):**
Each option (`padding 9px 10px`, `border-radius 6px`, `cursor pointer`):
- Unselected: `border rgba(176,141,87,0.12)`, transparent bg
- Selected: `border rgba(176,141,87,0.4)`, `bg rgba(176,141,87,0.12)`
- Label: `JetBrains Mono 8px UPPERCASE #B08D57` (Menu A / Menu B)
- Meal name: `Inter 11px weight 500 #E8DCC7`
- Details (weight, allergens): `JetBrains Mono 7px rgba(232,220,199,0.25)`
- Click: optimistic update (toggle selection), roll back on failure

**Toast notification** (fixed bottom-center):
- `background #161208`, `border rgba(176,141,87,0.28)`, `border-radius 8px`, `padding 11px 18px`
- `JetBrains Mono 10px #E8DCC7`
- Auto-dismiss after 3.2s
- `opacity` transition for fade in/out

**APIs:**
- `GET /api/v1/canteen/meals?weeks=3`
- `POST /api/v1/canteen/order` body `{ date, choice: "A"|"B"|null }`
- `POST /api/v1/canteen/bulk-signup` body `{ days_count, preferred_choice }`

---

### Screen 5 — Settings (/settings)
**Purpose:** Customize AI assistant behavior and view account info.

**Layout:**
- Same sidebar + main (`padding 36px 40px`, `max-width 680px`)

**AI Assistant panel** (`background #161208`, `border rgba(176,141,87,0.14)`, `border-radius 12px`, `padding 24px`):
- Header: sun/gear icon + `Cormorant Garamond 18px weight 500` "AI Asistent — Pravidlá"
- Textarea: `Inter 13px`, 4 rows, resizable, full-width
- Note below: "Pokyn pre štúdium je vždy pripojený automaticky…" `Inter 11px rgba(232,220,199,0.28)`
- 3 toggle rows (border-top `rgba(176,141,87,0.1)` between):
  - Title `Inter 13px weight 500 #E8DCC7` + description `Inter 11px rgba(232,220,199,0.38)`
  - Toggle pill: `width 36px height 20px border-radius 10px`
    - ON: `background #B08D57`; knob `left 18px`
    - OFF: `background rgba(232,220,199,0.1)`; knob `left 2px`
    - Knob: `width 16px height 16px border-radius 50% background #fff`
    - Animate with CSS `transition left 0.2s` and `transition background 0.2s`
- Save button + "✓ Uložené" (emerald, appears 2.5s then fades)

**Account panel** (`background #161208`, same border/radius/padding`):
- Header: person icon + `Cormorant Garamond 18px` "Účet"
- Metadata rows (border-top `rgba(176,141,87,0.1)`):
  - Key: `JetBrains Mono 9px UPPERCASE rgba(176,141,87,0.45)` — `min-width 110px`
  - Value: `Inter 13px rgba(232,220,199,0.7)`
- Privacy badge: emerald bg `rgba(50,90,60,0.1)`, border `rgba(50,90,60,0.22)`, shield-check icon + `Inter 11px #88c8a0`

**APIs:**
- `GET /api/v1/settings/ai-prompt`
- `PUT /api/v1/settings/ai-prompt` body `{ custom_ai_prompt: string|null }`

---

## Sidebar (persistent, all authenticated screens)

**Width:** 236px | **Background:** `#0e0c09` | **Border-right:** `1px solid rgba(176,141,87,0.14)`

**Logo section** (`padding 20px`, `border-bottom rgba(176,141,87,0.1)`):
- Centered flex row: `1px×13px` line | `Cormorant Garamond 14px UPPERCASE tracking 0.16em #E8DCC7` "AstroPage" | `1px×13px` line

**User card** (`padding 12px 16px`, `border-bottom rgba(176,141,87,0.1)`):
- Avatar: 32px circle, `bg rgba(176,141,87,0.1)`, `border rgba(176,141,87,0.28)`, initials `JetBrains Mono 10px #B08D57`
- Username: `Inter 12px weight 500 #E8DCC7`
- Subdomain: `JetBrains Mono 8px rgba(232,220,199,0.28)`

**Nav items** (`padding 10px`, flex column, gap 1px):
Each item: `padding 9px 10px`, `border-radius 6px`, `cursor pointer`
- Active: `bg rgba(176,141,87,0.12)`, `box-shadow inset 2px 0 0 #B08D57`, text `#B08D57`
- Inactive: transparent bg, text `rgba(232,220,199,0.52)`
- Icons: 14×14px SVG line-art (stroke matches text color)
- Labels: `Inter 13px`

**Bottom nav** (`border-top rgba(176,141,87,0.1)`, `padding 8px 10px`):
- Settings: same style as main nav items
- Logout: text `rgba(200,120,120,0.45)`, icon `rgba(200,120,120,0.55)`, hover bg `rgba(122,48,48,0.12)`

---

## Interactions & Behavior

| Action | Behavior |
|--------|----------|
| Login submit | POST /auth/login → set HttpOnly JWT → navigate to Dashboard |
| Nav click | Instant screen switch (no route change needed in prototype) |
| Homework card click | Open drawer from right (transform + backdrop fade) |
| Drawer close (X or backdrop) | Slide out, backdrop fades |
| Mark homework done | Optimistic toggle, POST to API, rollback on failure |
| AI generate | Show spinner+skeleton 2.2s → show editable textarea with draft |
| Canteen meal click | Optimistic select (toggle same = deselect), POST order, show toast |
| Bulk signup | POST /canteen/bulk-signup, show toast |
| Settings save | PUT /settings/ai-prompt, flash "✓ Uložené" 2.5s |
| Logout | Clear cookie, return to Login |

---

## Global Error / Loading Patterns

- **Loading (lists):** Skeleton pulse cards — `bg rgba(176,141,87,0.06)`, animated CSS `opacity` 1→0.4→1
- **Error panel:** `bg rgba(90,40,40,0.2)`, `border rgba(90,40,40,0.35)`, `color #c88888`, message + "Skúste znova alebo sa prihláste."
- **Empty state:** dashed `border rgba(176,141,87,0.18)`, centered `JetBrains Mono 9px` muted text
- **Toast** (bottom-center fixed, z-index 200): auto-dismiss 4s, success = emerald text, error = red text
- **Optimistic updates:** Homework done-toggle and canteen orders update instantly; roll back on API failure with toast "Nepodarilo sa uložiť"

---

## Assets
- No external images used — all UI is CSS/SVG
- Grain texture: inline SVG data URI (feTurbulence, see source file)
- Icons: inline SVG line-art, 14×14px viewBox 0 0 16 16, stroke-width 1.3
- Fonts loaded from Google Fonts: Cormorant Garamond, JetBrains Mono, Inter

---

## Files
- `AstroPage.dc.html` — Full interactive prototype (Login + Dashboard + Homework + Canteen + Settings + Drawer + Toast)

---

## Backend API Reference
- Base URL (dev): `http://localhost:8000`
- Auth: HttpOnly JWT cookie (set on login, sent automatically)
- Swagger docs: `http://localhost:8000/docs`
- Frontend dev server: `http://localhost:5173`
