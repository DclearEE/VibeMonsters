# VibeMonsters Web — Build Plan

Port the hotseat CLI to a shareable PWA. v1 goal: open a URL on a laptop or phone, summon two monsters, fight, share a screenshot. Still hotseat — one device, two players. Networked multiplayer is explicitly out of scope for v1.

The existing `vibemonsters.py` CLI stays as-is. This is a parallel web version, not a replacement.

## Tech stack (settled)

- **Runtime:** Bun (latest). Production-ready, ~95% npm compat, SvelteKit-supported. Built-in package manager + test runner.
- **Framework:** SvelteKit. Frontend + server routes in one codebase. Static adapter for PWA + future Capacitor.
- **Language:** TypeScript, `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. No `any` — ever. `unknown` + Zod parse at boundaries.
- **Validation:** Zod — runtime + inferred static types from a single definition. Same mental model as Pydantic.
- **Lint/format:** Biome — one tool, fast, replaces ESLint+Prettier.
- **AI — text:** `@anthropic-ai/sdk`, Claude for monster generation + battle resolution.
- **AI — sprites:** Google Gemini 2.5 Flash Image ("Nano Banana"). Host-pays free tier for v1.
- **PWA:** `vite-plugin-pwa` (Workbox service worker, manifest, offline shell).
- **Hosting target:** Docker container. One image, runs anywhere.

## Out of scope for v1

- Networked multiplayer (deferred — PartyKit or Durable Objects later)
- Capacitor native builds (stack stays compatible, we just don't ship it)
- Sprite animation frames (static sprite + CSS transforms only)
- Accounts, persistence, monster gallery
- BYOK UI (single host key; rate-limit if needed)

## Architecture

```
vibemonsters-web/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── bun.lockb
├── biome.json
├── tsconfig.json                    # strict + noUncheckedIndexedAccess
├── svelte.config.js                 # adapter-static
├── vite.config.ts                   # + vite-plugin-pwa
├── static/
│   ├── icons/                       # 192, 512, maskable
│   └── manifest.webmanifest
└── src/
    ├── app.html
    ├── lib/
    │   ├── shared/                  # usable from client AND server
    │   │   ├── schemas.ts           # Zod: Monster, Move, Stats, BattleState, TurnResult
    │   │   └── types.ts             # z.infer exports
    │   └── server/                  # server-only, never imported by client
    │       ├── ai/
    │       │   ├── anthropic.ts
    │       │   └── gemini.ts
    │       ├── services/
    │       │   ├── monster-service.ts   # summon(prompt) -> Monster
    │       │   ├── sprite-service.ts    # generate(monster) -> data URL
    │       │   └── battle-service.ts    # resolveTurn(state, action) -> TurnResult
    │       ├── prompts/
    │       │   ├── summon.ts
    │       │   └── resolve-turn.ts
    │       └── env.ts               # Zod-parsed env, fails loud on missing keys
    └── routes/
        ├── +layout.svelte
        ├── +page.svelte             # summon screen
        ├── battle/+page.svelte
        └── api/
            ├── health/+server.ts    # GET 200 for container health checks
            ├── summon/+server.ts    # POST: prompt -> Monster + spriteUrl
            └── battle/+server.ts    # POST: state + action -> new state
```

**Layering discipline (the C#-shaped structure):**
- **Routes** are thin. Parse input with Zod, call a service, shape the response. No business logic.
- **Services** hold game logic. Stateless classes or factory functions. No HTTP concerns.
- **AI clients** are injected into services (factory pattern, not module singletons). Mockable for tests.
- **Schemas** live in `lib/shared/` as the single source of truth. Client and server import the same Zod objects.

## Step 0 — Project setup (~20 min)

- [ ] `bun create svelte@latest vibemonsters-web` (Skeleton, TypeScript, no ESLint/Prettier — Biome instead)
- [ ] `bun add zod @anthropic-ai/sdk @google/genai`
- [ ] `bun add -d @biomejs/biome vite-plugin-pwa @sveltejs/adapter-static`
- [ ] Switch `svelte.config.js` to `adapter-static`
- [ ] `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- [ ] `biome.json` with strict ruleset; wire `bun run check`
- [ ] `.env.example` with `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`
- [ ] `src/lib/server/env.ts` — Zod-parsed env, fails loud on missing keys

## Step 1 — Schemas (port from Pydantic) (~20 min)

Mirror `vibemonsters.py` models in Zod. Same invariants, enforced the same way.

- [ ] `Stats` — hp/atk/def/spd ints, `.refine(sum === 300)`, `.refine(hp >= 80)`
- [ ] `Move` — name, `z.number().int().min(1).max(100)` power, flavor, description
- [ ] `Monster` — name, element, emoji, stats, moves (3–4), `spriteUrl: z.string()`
- [ ] `PlayerId = z.enum(['p1', 'p2'])`
- [ ] `Effectiveness` — `z.enum([0.75, 1.0, 1.25])` or a `z.literal` union
- [ ] `StatusEffect` — `z.enum(['burn', 'freeze', 'poison', 'shield', 'confusion', 'haste', 'regen'])` + a lookup table mapping each to `{ emoji, kind: 'buff' | 'debuff', label }`
- [ ] `PlayerAction`, `TurnResult`, `BattleState`
  - `TurnResult` adds: `damage: number` (to defender), `healing: number` (to attacker or defender — Claude specifies which), `effectsApplied: { target: PlayerId, effect: StatusEffect }[]`, `effectsRemoved: same shape`, `blocked: boolean` (shield absorbs the hit)
  - `BattleState` adds: `p1Effects: StatusEffect[]`, `p2Effects: StatusEffect[]` — active status icons shown on each panel
- [ ] Export inferred types via `z.infer<typeof Schema>`

Status effects are **visual + lightweight state** in v1 — the schema tracks them, Claude may apply/remove them in a turn, and they render as emoji badges on the monster panel. Per-turn mechanics (burn ticks for 5, freeze skips a turn) deferred — can evolve later without schema changes.

Zod doubles as the structured-output contract with Claude: convert to JSON Schema at call site (`zod-to-json-schema`), validate the response against the same Zod object on return. Drift impossible.

## Step 2 — Monster generation + sprite (~30 min)

- [ ] `monster-service.summon(prompt)` — Claude call, Zod-validated response, same 300-stat-budget and HP-floor constraints from the CLI
- [ ] System prompt: port from CLI, swap the `ascii_art` field for a `visual_description` field that drives the sprite prompt
- [ ] `sprite-service.generate(monster)` — Gemini Nano Banana with a **fixed prompt template** for style lock:
  > "32x32 pixel art, limited 8-color palette, flat shading, centered on transparent background, Gen 1 Pokémon silhouette energy, {visual_description}"
- [ ] Return sprite as a base64 data URL inline (no blob storage in v1)
- [ ] Generate both players' sprites in parallel
- [ ] `POST /api/summon` — body `{ prompt }`, returns `Monster` with `spriteUrl`

## Step 3 — Battle screen (~50 min)

- [ ] Two-panel layout: sprite, name, element, HP bar, stat line, active status badges
- [ ] Move buttons (3–4 per monster) + freeform input field
- [ ] Battle log component, append-only scroll, auto-scroll to latest
- [ ] HP bar drain: CSS `transition: width 400ms ease-out`; color threshold (green >60, yellow 30–60, red <30)
- [ ] Hit animation: Svelte transition combining `translateX` shake + 120ms red filter flash
- [ ] Vertical bob idle animation (1s loop, 4px)

**Visual feedback layer** — so players don't have to parse narration to understand what happened:

- [ ] `FloatingNumber` component — spawns above the target sprite, animates `translateY(-40px)` + fade over 800ms, auto-removes on animation end
  - **Damage:** `-24` in red
  - **Healing:** `+15` in green
  - **Crit:** bigger, yellow, adds a brief screen shake
  - **Blocked (shield):** `🛡️` instead of a number
  - **Miss / 0 damage:** `MISS` in grey
- [ ] `StatusBadge` component — small emoji pill (one per active effect) rendered below the monster name
  - Pulse animation on apply (scale 1 → 1.3 → 1 over 300ms)
  - Fade-out on remove
  - Tooltip on hover shows the effect label (e.g. "Burn")
- [ ] After each `turnResult` returns, drive the UI from structured fields — not the narration string:
  - `damage > 0` → spawn red `-N` floater on defender + shake + flash
  - `healing > 0` → spawn green `+N` floater on the healed target
  - `blocked` → shield floater, no HP change
  - `effectsApplied` → push to `pXEffects`, trigger pulse
  - `effectsRemoved` → remove from `pXEffects`, trigger fade

Svelte's built-in `{#each}` + transitions handle floaters and badges in ~20 lines each. No Framer Motion.

**Icon strategy:** emojis for v1 (🔥 ❄️ 🧪 🛡️ 😵‍💫 ⚡ ✨). Zero cost, universal, matches the vibe. Upgrade path in deferred: custom 16×16 pixel-art icons that match the sprite style, swapped in behind the same `StatusEffect → icon` lookup table so no calling code changes.

## Step 4 — Turn loop (~30 min)

- [ ] `battle-service.resolveTurn(state, action)` — same damage formula as CLI, Claude picks flavor + effectiveness from the bounded enum, Zod-validated return
- [ ] `POST /api/battle` — body `{ state, action }`, returns `{ turnResult, nextState }`
- [ ] Client holds state in a Svelte store; each action posts, awaits, applies returned state
- [ ] Speed stat determines order (same as CLI)
- [ ] Win condition → victory panel, "Play again" resets the store

**State model:** server is stateless. Every request includes the full `BattleState`, response returns the new state. No sessions, no DB. Tamper-able, but hotseat v1 so nobody cares. Becomes server-authoritative when multiplayer lands.

## Step 5 — PWA (~20 min)

- [ ] `vite-plugin-pwa` config: auto-update, Workbox precache of app shell
- [ ] `manifest.webmanifest`: name, short_name, theme_color, `display: standalone`, 192/512/maskable icons
- [ ] "New version available" toast via `registerSW` callback
- [ ] Test: `bun run build && bun run preview`, add to home screen on a phone, confirm standalone launch

**Capacitor future-proofing (do now, use later):**
- `adapter-static` build output is Capacitor-wrappable as-is.
- Single `PUBLIC_API_BASE_URL` env; client uses it for all API calls so a native build can point at a hosted API instead of same-origin.
- No browser-only APIs without a feature check.
- No service-worker logic that assumes same-origin requests.

## Step 6 — Docker (~20 min)

- [ ] Multi-stage Dockerfile: `oven/bun:1-slim` for both build and runtime
- [ ] Build stage: `bun install --frozen-lockfile`, `bun run build`
- [ ] Runtime stage: copy `build/`, `package.json`, `node_modules/`, run with `bun ./build/index.js`
- [ ] `docker-compose.yml` for local — env from `.env`, port 3000
- [ ] `.dockerignore`: no `node_modules`, no `.svelte-kit`, no `.env`
- [ ] `/api/health` returns 200 for container health checks

Target image size < 200MB. `docker run -e ANTHROPIC_API_KEY=... -e GEMINI_API_KEY=... -p 3000:3000 vibemonsters-web` → live.

## Known risks + mitigations

- **Sprite style drift between monsters** → fixed prompt template with explicit palette/size/framing. One place to tune. Reroll button if a sprite is bad.
- **Sprite generation latency** (5–15s) → "summoning..." screen with flavor text; generate both sprites in parallel; tolerate the wait as part of the ritual.
- **Nano Banana free-tier / rate limits** → per-IP rate limit middleware; clear error ("too many summons, try again in a minute").
- **Host API key exposure** → only referenced in `lib/server/`; CI check that the client bundle never contains the env var name.
- **Zod + Claude structured-output drift** → single source of truth (the Zod schema), converted to JSON Schema at call, validated on return. Any drift surfaces immediately.
- **State tampering** → acknowledged, out of scope for hotseat v1. Server-authoritative state when multiplayer lands.
- **PWA caching stale app shell on deploy** → auto-update strategy + visible "new version available" toast.

## Deferred (leave the door open, don't build now)

- Capacitor native builds — architecture already compatible.
- Networked multiplayer — PartyKit or Cloudflare Durable Objects, server-authoritative `BattleState`.
- Monster gallery / persistence — SQLite (Turso) or Postgres sidecar.
- BYOK UI — settings page + `localStorage` + browser-direct Anthropic calls via `anthropic-dangerous-direct-browser-access`. Gemini still needs a proxy.
- Sprite animation frames — only if static+CSS feels thin after ship.
- Custom pixel-art status icons (16×16, matching sprite palette) — swap in behind the existing `StatusEffect → icon` lookup table.
- Per-turn status mechanics (burn ticks damage each turn, freeze skips a turn, regen heals each turn, haste re-orders) — v1 is visual-only; wire mechanics when the visual loop feels good.
- Items, 3v3 — still deferred from IDEAS.md; port after v1.

## File cross-reference

- CLI version: `vibemonsters.py` (unchanged, still works, still free via Claude Code auth)
- Web version: lives in this plan's `vibemonsters-web/` directory (to be created)
- Ideas / alternatives considered: `IDEAS.md` (now points here for the settled stack)
