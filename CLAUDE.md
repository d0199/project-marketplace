# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build (also type-checks)
npm run lint     # ESLint via next lint
npm run start    # Serve production build
```

No test framework is configured. TypeScript errors surface via `npm run build`.

## Architecture

**Next.js 15 (Pages Router) · TypeScript · Tailwind CSS · No database**

### Data layer

All gym data lives in `data/gyms.json` (16 gyms). At runtime it is loaded into a mutable in-memory store anchored on `global.__gymStore` in `src/lib/ownerStore.ts`. The `global` object is used deliberately — Next.js compiles API routes and page server functions into separate bundles with isolated module registries, so a plain module-level variable would be two separate copies. The global bypasses this and gives one shared array across all server-side code.

`src/lib/statsStore.ts` uses a plain module-level object (not global) to track engagement stats per gym. Stats reset on server restart and are never persisted.

### Server-side rendering

Both the home page (`src/pages/index.tsx`) and the gym profile page (`src/pages/gym/[id].tsx`) use `getServerSideProps` reading from `ownerStore`. This ensures owner edits (saved via API route → ownerStore.update) appear immediately on every page load without a rebuild.

### Search / filtering

All filtering happens client-side in `src/pages/index.tsx` via `useMemo`. `filterGyms` in `src/lib/utils.ts` attaches Haversine distances using the static `POSTCODE_COORDS` map (35 WA postcodes, 6000–6065), sorts by distance, caps at `radiusKm`, then applies amenity intersection (`Array.every`). Results are only shown after a postcode is submitted (`hasSearched` gate).

### Auth / sessions

Owner auth is hardcoded in `src/pages/owner/index.tsx` (`CREDENTIALS` object — two demo accounts). The session is stored in `sessionStorage` as `ownerSession` JSON. All owner-gated pages read this on mount and redirect to `/owner` if absent. The API routes do **not** validate the session — ownership is checked only by comparing `ownerId` fields client-side.

### API routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/owner/gyms` | GET `?ownerId=` | Gyms for one owner |
| `/api/owner/gym/[gymId]` | GET, PUT | Fetch / update a single gym |
| `/api/stats/[gymId]` | GET, POST `{ event }` | Read / record engagement stats |

### Tailwind brand tokens

```
bg-brand-orange          #F97316  (primary CTA background)
bg-brand-orange-dark     #EA580C  (hover state)
bg-brand-orange-light    #FED7AA  (soft tints)
bg-brand-black           #111111  (navbar)
text-brand-orange                 (logo, accent text)
```

### Image carousel

`src/components/ImageCarousel.tsx` — cross-fade carousel with 5 s auto-advance, pause-on-hover, prev/next arrows (visible on group hover), and optional dot indicators. Each `Gym` stores `images: string[]` (up to 6 URLs). Owners manage images in `OwnerGymForm` — first image is the primary shown on cards.

### Gym ownership

- `owner-1`: gym-001, gym-002, gym-004 · credentials `owner@mynextgym.com.au / demo123`
- `owner-2`: gym-003, gym-005, gym-006 · credentials `owner2@mynextgym.com.au / demo456`
- `owner-3`: gym-007 to gym-016 (no portal account)

### Workflow rule

Every code change must be committed to git (user instruction from prior session).

### Git branching

- **`staging`** — push all work here first (`git push origin staging`)
- **`master`** — production branch, connected to Amplify Hosting. **Never push directly to master.** Changes reach master only via merge from staging.
- When asked to "push" or "push staging", always push to the `staging` branch.
