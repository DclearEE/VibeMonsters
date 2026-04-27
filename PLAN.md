# VibeMonsters Web — Build Plan

Port the hotseat CLI to a shareable PWA. v1 goal: open a URL on a laptop or phone, summon two monsters, fight, share a screenshot. Still hotseat — one device, two players. Networked multiplayer is explicitly out of scope for v1.

The existing `vibemonsters.py` CLI stays as-is. This is a parallel web version, not a replacement.

## Tech stack (settled)

- **Runtime:** Bun (latest). Production-ready, ~95% npm compat, SvelteKit-supported. Built-in package manager + test runner.
- **Framework:** SvelteKit. Frontend + server routes in one codebase. `adapter-node` (runs on Bun; API routes need a runtime, static adapter doesn't have one).
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
    │   ├── client/                  # browser-only
    │   │   └── battle-store.svelte.ts
    │   ├── components/              # Svelte components
    │   │   ├── BattleLog.svelte
    │   │   ├── FloatingNumber.svelte
    │   │   ├── HPBar.svelte
    │   │   ├── MonsterPanel.svelte
    │   │   ├── Spinner.svelte
    │   │   └── StatusBadge.svelte
    │   └── server/                  # server-only, never imported by client
    │       ├── ai/
    │       │   ├── anthropic-sdk.ts    # prod adapter (uses ANTHROPIC_API_KEY)
    │       │   ├── anthropic-cli.ts    # dev adapter (shells out to `claude -p`)
    │       │   ├── anthropic.ts        # picks adapter from env, exports unified client
    │       │   ├── index.ts
    │       │   └── gemini.ts
    │       ├── services/
    │       │   ├── monster-service.ts   # summon(prompt) -> Monster
    │       │   ├── sprite-service.ts    # generate(monster) -> spriteUrl
    │       │   ├── sprite-cache.ts      # in-memory PNG cache, served via /api/sprites/<id>
    │       │   └── battle-service.ts    # resolveTurn(state, action) -> TurnResult
    │       ├── prompts/
    │       │   ├── summon.ts
    │       │   └── turn.ts
    │       └── env.ts               # Zod-parsed env, fails loud on missing keys
    └── routes/
        ├── +layout.svelte           # global dark theme + favicon
        ├── +page.svelte             # summon screen
        ├── battle/+page.svelte
        └── api/
            ├── summon/+server.ts        # POST: prompt -> Monster + spriteUrl
            ├── battle/+server.ts        # POST: state + action -> new state
            └── sprites/[id]/+server.ts  # GET: cached PNG, immutable cache headers
```

**Layering discipline (the C#-shaped structure):**
- **Routes** are thin. Parse input with Zod, call a service, shape the response. No business logic.
- **Services** hold game logic. Stateless classes or factory functions. No HTTP concerns.
- **AI clients** are injected into services (factory pattern, not module singletons). Mockable for tests.
- **Schemas** live in `lib/shared/` as the single source of truth. Client and server import the same Zod objects.

## AI provider strategy — CLI for dev, SDK for prod

Mirror what `vibemonsters.py` already does: shell out to the `claude` CLI for local development (free via Claude Code subscription, no API key needed), and use `@anthropic-ai/sdk` with `ANTHROPIC_API_KEY` for production / Docker. Same `summon()` / `resolveTurn()` service interface, two adapters behind it, env-switched.

```ts
// env.ts (Zod)
AI_PROVIDER: z.enum(['cli', 'sdk']).default('cli')

// ai/anthropic.ts
export const anthropic = env.AI_PROVIDER === 'cli' ? cliAdapter : sdkAdapter;
```

Both adapters return the same shape — Zod validates at the boundary, so drift between them surfaces immediately.

**CLI adapter** — `spawn('claude', ['-p', prompt, '--output-format', 'json'])`, parse `.result`, validate with the same Zod schema. Matches the Python flow exactly.

**Why this is worth doing from day one:**
- Free iteration during build-out — no metered calls while tuning prompts.
- Docker forces the SDK path anyway (no `claude` CLI or subscription auth inside the container), so building both upfront makes deploy a one-line env flip.
- Keeps the Python and TS versions feature-parity on the auth model.

**Tradeoffs:**
- CLI adds ~500ms–1s startup per call. Fine for dev, would hurt in a tight battle loop in prod.
- CLI returns free-form text; SDK supports native tool-use / structured output that's stricter. Zod-at-the-boundary covers both, but the SDK path can be tightened later with `tools` for true structured output.

## Step 0 — Project setup (~20 min)

- [x] `bunx sv create vibemonsters-web` (Skeleton, TypeScript, no ESLint/Prettier — Biome instead)
- [x] `bun add zod @anthropic-ai/sdk @google/genai`
- [x] `bun add -d @biomejs/biome @vite-pwa/sveltekit @sveltejs/adapter-node`
- [x] Switch `svelte.config.js` to `adapter-node`
- [x] `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- [x] `biome.json` with strict ruleset
- [x] `.env.example` with `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PUBLIC_API_BASE_URL`
- [x] `src/lib/server/env.ts` — Zod-parsed env, fails loud on missing keys

## Step 1 — Schemas (port from Pydantic) (~20 min)

Mirror `vibemonsters.py` models in Zod. Same invariants, enforced the same way.

> **Note (done):** the bullets below were drafted around an earlier status-effect model. The Python source has since landed on a `MoveKind` system (physical/magical/heal/defend/buff) with 5 stats (hp/atk/def/spd/mag), 400-budget, and active `defending` flag + buff multipliers in state. The Zod port mirrors the Python — see `src/lib/shared/schemas.ts` and `types.ts`. Status effects are deferred (still listed under "Deferred" below).

- [x] `Stats` — hp/atk/def/spd/mag ints, `.refine(sum === 400)`, `.refine(hp >= 80)`
- [x] `Move` — name, kind (MoveKind), power 0–100, targetStat (BuffStat | null, required when kind=buff), flavor, description
- [x] `Monster` — name, element, emoji, borderColor (hex), stats, moves (3–4), visualDescription, spriteUrl
- [x] `PlayerId = z.enum(['p1', 'p2'])`
- [x] `BuffStat = z.enum(['atk', 'def', 'spd', 'mag'])`
- [x] `MoveKind = z.enum(['physical', 'magical', 'heal', 'defend', 'buff'])`
- [x] `Effectiveness` — `z.union([z.literal(0.75), z.literal(1.0), z.literal(1.25)])`
- [x] `PlayerAction`, `TurnResult`, `BattleState` — mirror Pydantic shape (defended/buffStat in TurnResult; pXDefending/pXBuffs in BattleState)
- [x] Export inferred types via `z.infer<typeof Schema>` in `types.ts`
- [x] Constants exported: `STAT_BUDGET`, `HP_FLOOR`, `BUFF_MULTIPLIER`, `BUFF_CAP`, `DEFEND_REDUCTION`, `DAMAGE_CAP`, `HEAL_CAP`

Status effects are **visual + lightweight state** in v1 — the schema tracks them, Claude may apply/remove them in a turn, and they render as emoji badges on the monster panel. Per-turn mechanics (burn ticks for 5, freeze skips a turn) deferred — can evolve later without schema changes.

Zod doubles as the structured-output contract with Claude: convert to JSON Schema at call site (`zod-to-json-schema`), validate the response against the same Zod object on return. Drift impossible.

## Step 2 — Monster generation + sprite (~30 min)

- [x] `monster-service.summon(prompt)` — Claude call, Zod-validated response, same 400-stat-budget and HP-floor constraints from the CLI
- [x] System prompt: port from CLI, swap the `ascii_art` field for a `visualDescription` field that drives the sprite prompt
- [x] `sprite-service.generateSprite(visualDescription)` — Gemini Nano Banana with a fixed prompt template for style lock (centered, front-facing, plain neutral background, no scene/props/text)
- [x] Style-bible reference image: `static/style-bible.png` is loaded once and passed as a reference image on every Gemini call when present.
- [x] Background removal: `@imgly/background-removal-node` (`model: 'medium'`) runs server-side. Chroma-key step dropped — imgly handles the matte directly off Gemini's neutral bg.
- [x] Sprites stored in an in-memory `sprite-cache.ts` (UUID-keyed, 64-entry cap) and served from `GET /api/sprites/<id>` with immutable cache headers. `Monster.spriteUrl` is just that path. Avoided base64 inlining — kept JSON payloads small and prevented sprite blobs from living in Svelte state / SSR / HMR caches.
- [x] Generate both players' sprites in parallel from the home page (`Promise.all([summonOne, summonOne])`)
- [x] `POST /api/summon` — body `{ prompt }`, returns `Monster` with `spriteUrl`

**Why illustrated and not pixel art:** Nano Banana is strong at illustrated/painterly creatures and weak at strict pixel grids. The grid-snap problem is solvable (prompt + tools like `spritefusion-pixel-snapper`) but it's a costume that costs dev time. Project name is VibeMonsters; the brand is vibe. The constraint that *actually* matters for a roster is silhouette discipline (front-facing, full body, plain bg) — the pixel grid isn't.

**Dep add (done):** `@imgly/background-removal-node` (~44 MB resident at `model: 'medium'`, downloaded on first call, cached to disk).

**Memory war stories (worth remembering):** `@huggingface/transformers` running BiRefNet at fp32 (~200 MB+ resident) inside the dev server killed Chromium tabs on a low-RAM laptop because the dev server, VS Code, and the browser shared one memory pool. Tried browser-side `@imgly/background-removal` next — locked the main thread on single-threaded WASM. Landed on `@imgly/background-removal-node` server-side, smaller model, dev server in an external terminal. If the laptop ever can't handle it, the documented next step is fal.ai's Bria RMBG 2.0 (~$0.018/sprite, zero local compute).

## Step 3 — Battle screen (~50 min)

- [x] Two-panel layout: sprite, name, element, HP bar, stat line, active status badges
- [x] Move buttons (3–4 per monster) + freeform input field
- [x] Battle log component, append-only scroll, auto-scroll to latest
- [x] HP bar drain: CSS `transition: width 400ms ease-out`; color threshold (green >60, yellow 30–60, red <30)
- [x] Hit animation: `translateX` shake + brief filter flash on the sprite
- [x] Vertical bob idle animation (1s loop, 4px)
- [x] `Spinner` component used during summon and per-turn resolution
- [x] Global dark theme via `+layout.svelte` (`body { background: #0a0a12; color: #f4f4f8 }`) — fixes light-text-on-default-white-body
- [x] Home-screen prompts use `placeholder` hints instead of pre-filled values, so players just type to overwrite

**Visual feedback layer** — so players don't have to parse narration to understand what happened:

- [x] `FloatingNumber` component — spawns above the target sprite, animates `translateY(-40px)` + fade over 800ms, auto-removes on animation end
  - **Damage:** `-24` in red
  - **Healing:** `+15` in green
  - **Crit:** bigger, yellow, adds a brief screen shake
  - **Blocked (shield):** `🛡️` instead of a number
  - **Miss / 0 damage:** `MISS` in grey
- [x] `StatusBadge` component — small emoji pill rendered below the monster name; pulse on apply, fade on remove, tooltip with label
- [x] After each `turnResult`, UI is driven from structured fields (not narration): damage → red floater + shake + flash, healing → green floater, defended → shield, effects → push/pop badges

Svelte's built-in `{#each}` + transitions handle floaters and badges in ~20 lines each. No Framer Motion.

**Icon strategy:** emojis for v1 (🔥 ❄️ 🧪 🛡️ 😵‍💫 ⚡ ✨). Zero cost, universal, matches the vibe. Upgrade path in deferred: custom 16×16 pixel-art icons that match the sprite style, swapped in behind the same `StatusEffect → icon` lookup table so no calling code changes.

## Step 4 — Turn loop (~30 min)

- [x] `battle-service.resolveTurn(state, action)` — same damage formula as CLI, Claude picks flavor + effectiveness from the bounded enum, Zod-validated return
- [x] `POST /api/battle` — body `{ state, action }`, returns `{ turnResult, nextState }`
- [x] Client holds state in a Svelte runes store (`lib/client/battle-store.svelte.ts`); each action posts, awaits, applies returned state
- [x] Speed stat determines order (same as CLI)
- [x] Win condition → victory panel, "Play again" resets the store

**State model:** server is stateless. Every request includes the full `BattleState`, response returns the new state. No sessions, no DB. Tamper-able, but hotseat v1 so nobody cares. Becomes server-authoritative when multiplayer lands.

## Step 5 — PWA (~20 min)

- [ ] `vite-plugin-pwa` config: auto-update, Workbox precache of app shell
- [ ] `manifest.webmanifest`: name, short_name, theme_color, `display: standalone`, 192/512/maskable icons
- [ ] "New version available" toast via `registerSW` callback
- [ ] Test: `bun run build && bun run preview`, add to home screen on a phone, confirm standalone launch

**Capacitor future-proofing (do now, use later):**
- We're on `adapter-node` for v1 (Docker). When Capacitor lands, generate a static frontend build separately (swap adapter at build time, or maintain two configs) and point it at the hosted API.
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
- [ ] Pre-download `@imgly/background-removal-node` model in the build stage so first-request latency isn't ~30s on a cold container

Target image size < 200MB. `docker run -e ANTHROPIC_API_KEY=... -e GEMINI_API_KEY=... -p 3000:3000 vibemonsters-web` → live.

## Known risks + mitigations

- **Sprite style drift between monsters** → fixed prompt template + style-bible reference image passed on every call. One place to tune. Reroll button if a sprite is bad.
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
- BiRefNet for background removal (via `@huggingface/transformers`) — better edges on translucent / wispy / feathered monsters than imgly's U²-Net. ~200MB+ model, would push the Docker image past the 200MB target. Swap in for v2 if v1 edges look rough on ghostly/ethereal sprites.
- Pixel-art route — if the illustrated style ever feels wrong, the path back is: Nano Banana with a pixel-style prompt (DB16/PICO-8 palette, hard edges, era reference) → `spritefusion-pixel-snapper` (Rust+WASM, MIT) for grid snap + palette quantize. Documented here so the option isn't lost.
- Custom pixel-art status icons (16×16, matching sprite palette) — swap in behind the existing `StatusEffect → icon` lookup table.
- Per-turn status mechanics (burn ticks damage each turn, freeze skips a turn, regen heals each turn, haste re-orders) — v1 is visual-only; wire mechanics when the visual loop feels good.
- Items, 3v3 — still deferred from IDEAS.md; port after v1.

## File cross-reference

- CLI version: `vibemonsters.py` (unchanged, still works, still free via Claude Code auth)
- Web version: lives in this plan's `vibemonsters-web/` directory (to be created)
- Ideas / alternatives considered: `IDEAS.md` (now points here for the settled stack)
