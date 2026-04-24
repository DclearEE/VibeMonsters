# Ideas / Future Directions

Captured from a post-hackathon chat. Not a plan — a menu.

## In-terminal additions (low lift, high fun)

Things that stretch the current version without leaving the CLI:

- **Status effects** — burn / freeze / confusion as small fields on `BattleState`. Claude already loves narrating them; it's the highest fun-per-line-of-code add.
- **Best-of-three with draft bans** — each player summons two monsters, one is banned by the opponent before battle. Adds meta without new infra.
- **Monster save/gallery** — dump each `Monster` as JSON to `~/.vibemonsters/`. `vibemonsters --gallery` lists them, `--rematch <a> <b>` replays. Persistent collection, no accounts.

Other candidates: crit chance, items mid-battle, team 3v3, monster evolution after wins, replay mode.

## Going beyond the terminal

Goal: shareable with non-dev friends. They get a URL + a room code, no install.

### The big visual unlock: pixel art, not ASCII

Pixel sprites are the actual Pokémon DNA and a massive perceived-quality upgrade for basically no gameplay-logic change. `ascii_art` field becomes `sprite_url`; everything else ports.

Sprite generation options:
- **Retro Diffusion API** — tuned for pixel art
- **fal.ai pixel-art Flux** — fast, good quality
- **Scrappy alternative** — pre-draw ~8 archetype sprites, have Claude pick the closest match at summon and color-tint it. Ships in a weekend, proves the idea before paying an image-gen bill.

Tradeoffs:
- Cost model changes — lose the "free via Claude Code auth" trick. Every summon = a few cents + 5–15s of image gen, plus Claude API calls for battle narration.
- AI pixel art is hit-or-miss. A "regenerate" button + few-shot reference sprites in the prompt help.
- You rewrite the Python → TS (Pydantic → Zod, `resolve_turn` → an API route). Mechanical work, not design work.

### Do you need a game engine?

**Probably not at first.** Gen 1 Pokémon battles are: two static sprites, a bob, a shake-on-hit, an HP bar drain, and a text box. ~200 lines of React + Framer Motion (or CSS keyframes).

Reach for **Phaser.js** only when you want particle systems, attack animations, screen flashes, sprite sheets with frames. Not day one.

## Tech stack — settled

After a follow-up research pass, the stack for the web version is locked in. See `PLAN.md` for the full build plan.

**Stack:** SvelteKit (fullstack, server routes) + Bun + TypeScript (strict) + Zod + Biome. AI via `@anthropic-ai/sdk` for battle logic and Gemini 2.5 Flash Image ("Nano Banana") for sprites. PWA via `vite-plugin-pwa`, `adapter-static` so Capacitor can wrap the build later. Docker for hosting.

**Why not the earlier options, for the record:**
- **Next.js** — heavy, React-only, Vercel-flavored; we'd use ~5% of it for a two-player game.
- **Vite + React + PartyKit** (the original recommendation here) — fine, but SvelteKit's built-in transitions and server routes collapse a lot of this into one thing. PartyKit still wins if/when networked multiplayer ships.
- **NestJS backend** — tried the "C#-flavored TS backend" angle. Verdict: cosplays ASP.NET without the payoff. Skip.
- **Separate Python/FastAPI backend** — adds a deploy and breaks shared types with the frontend. Not worth it for a game this size.

**What stays true from the original research:**
- Pixel art over ASCII is the big visual unlock.
- "Static sprite + CSS transforms" gets 90% of Gen 1 Pokémon feel. No Phaser/game engine for v1.
- Claude-as-referee pattern ports directly; structured output stays central.

## If/when porting to web

Rough file structure — keep CLI version intact:

```
VibeMonsters/
  vibemonsters.py          # CLI stays
  vibemonsters-web/        # SvelteKit fullstack (see PLAN.md)
```

Core loop stays identical. Claude is still the referee. The work is UI + sprite gen + (eventually) realtime sync.

## Open question

Does the pixel-art upgrade require actual animation frames or is "static sprite + CSS transforms on hit" enough? Test with one pre-drawn sprite before committing to anything bigger.
