# UI Standards — mynextgym.com.au

Reference document for consistent UI across admin panel, owner portal, and public pages.

## Tailwind Class Tokens

### Inputs
```
// Standard text input
w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange

// Textarea (add rows as needed)
w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none

// Select dropdown
px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange

// Search input (in filter bars)
flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange

// Checkbox
w-4 h-4 accent-brand-orange

// Date input
px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange
```

### Labels
```
block text-sm font-medium text-gray-700 mb-1
```

### Section Headers (forms)
```
text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3
```

### Page Titles
```
text-2xl font-bold text-gray-900
```

### Breadcrumbs
```
nav: text-sm text-gray-500 mb-6
link: hover:text-brand-orange
separator: " / " (text)
current: text-gray-800 font-medium
```

---

## Buttons

### Primary (CTA)
```
px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50
```

### Secondary
```
px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors
```

### Destructive
```
px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50
```

### Approve (green)
```
px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium disabled:opacity-50
```

### Reject (red)
```
px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg font-medium disabled:opacity-50
```

### Text / Tertiary
```
text-sm text-gray-400 hover:text-gray-600
```

### Disabled state
Always use `disabled:opacity-50`.

---

## Badges

### Status badges
```
inline-flex px-2 py-0.5 rounded-full text-xs font-medium

pending:   bg-yellow-100 text-yellow-800
approved:  bg-green-100  text-green-800
rejected:  bg-red-100    text-red-800
```

### Entity type badges
```
text-xs font-semibold px-2 py-0.5 rounded-full

Gym:  bg-brand-orange/10 text-brand-orange  (or omit — gym is default)
PT:   bg-purple-100 text-purple-700
```

### Plan badges
```
text-xs font-semibold px-2 py-0.5 rounded-full

free:     bg-gray-100    text-gray-600
paid:     bg-green-100   text-green-700
featured: bg-amber-100   text-amber-800
```

### Flag badges (admin tables)
```
inline-flex px-2 py-0.5 rounded-full text-xs font-medium

featured: bg-amber-100  text-amber-800
test:     bg-purple-100 text-purple-700
paid:     bg-green-100  text-green-700
```

### Active toggle (admin tables)
```
px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer

active:   bg-green-100 text-green-700 hover:bg-green-200
inactive: bg-gray-100  text-gray-500  hover:bg-gray-200
```

---

## Toasts

All toast notifications use the same fixed position and base classes:
```
fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white
```

Colors by type:
```
success: bg-green-600
error:   bg-red-600
info:    bg-blue-600
warning: bg-amber-500
```

Auto-dismiss after 3 seconds (success/info) or 5 seconds (error/warning).
Never use `animate-pulse` on toasts.

---

## Tables (admin)

### Container
```
overflow-x-auto rounded-lg border border-gray-200 bg-white
```

### Table element
```
w-full text-sm
```

### Header row
```
bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide
th: px-4 py-3 font-medium
```

### Body rows
```
border-b border-gray-100 hover:bg-gray-50
td: px-4 py-3
```

### ID columns
```
text-xs text-gray-400 font-mono
```

### Action links (table rows)
```
text-sm font-medium
view:   text-blue-600 hover:underline
edit:   text-brand-orange hover:underline
delete: text-red-500 hover:underline
```

Separate action links with `ml-3`.

---

## Filter Bars (admin)

### Layout
```
flex items-center gap-3 mb-4 flex-wrap
```

### Clear button
Resets all filters to "all" (shows everything):
```
text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap
```

### Reset button
Resets to sensible defaults (e.g., active items, pending, last 30 days):
```
text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap
```

### Result count
```
text-sm text-gray-400
```

---

## Slide-over Panels (admin edit)

### Overlay
```
fixed inset-0 z-40 bg-black/30 flex justify-end
```
Click overlay to close.

### Panel
```
w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl
```

### Panel header (sticky)
```
sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10
title: text-lg font-bold text-gray-900
```

### Panel content
```
p-6 space-y-6
```

### Panel header buttons (right side)
```
flex gap-2
Delete: px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50
Cancel: px-3 py-1.5 text-gray-500 border rounded-lg text-sm hover:bg-gray-50
Save:   px-4 py-1.5 bg-brand-orange text-white rounded-lg text-sm font-medium
```

---

## Modals (centered)

### Overlay
```
fixed inset-0 z-50 flex items-center justify-center bg-black/50
```

### Modal container
```
bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4
```
Use `max-w-md` for wider modals, `max-w-lg` for complex forms.

### Modal title
```
text-base font-semibold text-gray-900 mb-4
```

### Modal footer buttons
```
flex gap-3 justify-end mt-5
cancel: px-4 py-2 text-sm text-gray-600 hover:text-gray-900
primary: px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg
```

---

## Empty States

### Standard empty state (tables, lists)
```
text-center py-12
title:    text-gray-400 text-sm
subtitle: text-gray-300 text-sm mt-1
```

### Loading state
```
text-center py-12 text-gray-400 text-sm
"Loading..."
```

---

## Cards

### Billing/listing cards
```
bg-white border border-gray-200 rounded-2xl overflow-hidden
header: flex items-center justify-between px-5 py-4
```

### Content cards (sidebar, sections)
```
bg-white rounded-xl border border-gray-100 shadow-sm p-5
```

### Alert/info boxes
```
info:    bg-blue-50 border border-blue-200 rounded-lg px-4 py-3
warning: bg-amber-50 border border-amber-200 rounded-lg px-4 py-3
success: bg-green-50 border border-green-200 rounded-lg px-4 py-3
error:   bg-red-50 border border-red-200 rounded-lg px-4 py-3
```

---

## Color Semantics

| Purpose | Background | Text |
|---|---|---|
| Primary CTA | `bg-brand-orange` | `text-white` |
| Gym entity | — (default, no badge needed) | — |
| PT entity | `bg-purple-100` | `text-purple-700` |
| Success/Approve | `bg-green-600` (btn) / `bg-green-100` (badge) | `text-white` / `text-green-700` |
| Error/Reject | `bg-red-600` (btn) / `bg-red-100` (badge) | `text-white` / `text-red-700` |
| Pending/Warning | `bg-amber-50` (box) / `bg-yellow-100` (badge) | `text-amber-800` / `text-yellow-800` |
| Info | `bg-blue-50` (box) / `bg-blue-100` (badge) | `text-blue-800` / `text-blue-700` |
| Featured | `bg-amber-100` | `text-amber-800` |
| Super admin | `bg-purple-600` | `text-white` |

---

## Confirmation Patterns

- **Destructive actions** (delete, unclaim, clear data): Use centered modal with typed confirmation word.
- **Approve/reject**: Inline on the card, no separate modal needed.
- **Feature flag changes**: Staged draft/confirm banner pattern.
- Never use `alert()` or `confirm()` — always use styled UI modals.

---

## Responsive Rules

- Form grids: `grid grid-cols-1 sm:grid-cols-2 gap-4`
- Full-width fields: `sm:col-span-2`
- Filter bars: `flex-wrap` to stack on mobile
- Tables: `overflow-x-auto` wrapper for horizontal scroll
- Modals: `mx-4` for mobile padding

---

## Owner Portal Specifics

### Edit pages (gym/PT)
- Max width: `max-w-2xl`
- Plan banner above form
- "View Page" link in header (top right, opens new tab)
- Breadcrumb: Dashboard / Billing / Edit {name}

### Billing page
- Gym rows and PT rows use identical card structure
- PT rows get purple "PT" badge next to name
- Edit + View links in card header (Edit goes to `/owner/[type]/[id]`, View opens profile in new tab)

### Claim pages
- Max width: `max-w-xl`
- Search results are inline cards with "Claim" button
- Success state shows confirmation text + "Claim another" link

---

## Anti-patterns (avoid)

- Don't use `animate-pulse` on toasts
- Don't use `alert()` or `window.confirm()` for confirmations
- Don't mix `border` and `border border-gray-200` — always use `border border-gray-200`
- Don't use different heading levels for the same role (e.g., `text-lg` in one form, `text-sm uppercase` in another)
- Don't inline long class strings — extract to variables (`inputCls`, `labelCls`) in form components
- Don't duplicate random-word confirmation generators — use a shared utility
