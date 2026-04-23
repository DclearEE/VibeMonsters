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

## Tech stack — why NOT Next.js

Next.js is the LLM-default because models were trained on a billion Next tutorials and Vercel markets it aggressively. For a two-player browser game you use maybe 5% of the framework.

**Recommended for VibeMonsters web version: Vite + React + [PartyKit](https://www.partykit.io/).**
- Same React skills transfer from the Python logic port.
- No Next.js ceremony — static bundle + one tiny realtime server.
- PartyKit is Cloudflare-backed and built for exactly this (shared rooms via short code, WebSocket "just works").

Other honest alternatives:
- **SvelteKit + PartyKit** — smaller, reactive state + built-in transitions = bobs/shakes almost free. DX is lovely.
- **Plain HTML + Phaser + 50-line Go or Bun server** — the most honest version if it's primarily a game. No framework tax.
- **Cloudflare Worker + static HTML** — for something this small, the whole thing could be one file at the edge.

## If/when porting to web

Rough file structure — keep CLI version intact:

```
VibeMonsters/
  vibemonsters.py          # CLI stays
  web/
    src/                   # Vite + React
    server/                # PartyKit room logic
    shared/                # Zod schemas (port of Pydantic models)
```

Core loop stays identical. Claude is still the referee. The work is UI + realtime sync + sprite gen.

## Open question

Does the pixel-art upgrade require actual animation frames or is "static sprite + CSS transforms on hit" enough? Test with one pre-drawn sprite before committing to anything bigger.
