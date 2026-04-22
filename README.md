# VibeMonsters

Vibe-coded Pokémon. Two players describe a monster in plain English, Claude generates its stats, body, and moves, and then they fight in a terminal battle screen.

## The loop

1. **Summon.** Each player types a prompt.
   > *"a grumpy storm cloud that throws lightning"*
   > *"a cactus that knows karate"*
2. **Generate.** Claude returns a monster:
   - Stats: HP / ATK / DEF / SPD
   - Element (electric, plant, vibes — whatever)
   - 3–4 moves with flavor text
   - ASCII art body, ~30 cols × 15 rows
3. **Fight.** Turn-based, hotseat:
   - Each turn, the battle screen **re-renders and prints fresh** — output scrolls, full history stays in the terminal backlog
   - Players pick a move *or* type freeform ("try to befriend it")
   - Claude decides what happens, applies damage, narrates

## Stack

- **Python** — standalone CLI app, one `python vibemonsters.py`
- **Pydantic** for structured Claude outputs — no stringly typed anything
- **`claude` CLI** subprocessed with `-p --output-format json` — **no API key needed**, uses your existing Claude Code auth
- **[Rich](https://rich.readthedocs.io/)** for the terminal UI — panels, HP bars, colors
- No framework, no database, no server, no networking, no alt-screen takeover
- Hotseat two-player on a single terminal

## Setup

You'll need Python 3.11+ and the `claude` CLI (you already have it). No Anthropic API key required.

### 1. Install `uv` (one-time, no sudo)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# then open a new terminal, or: source $HOME/.local/bin/env
```

### 2. Create a venv and install deps

```bash
cd ~/source/VibeMonsters
uv venv
uv pip install pydantic rich
```

### 3. Run

```bash
uv run vibemonsters.py
```

## Example battle screen (per-turn render, scrolls)

```
┌── Stormgrump ⚡ ──────────────┐  ┌── KaratusCactus 🌵 ───────────┐
│         .-~~~~~~~-.            │  │       _   _                   │
│      .~~           ~~.         │  │      | |_| |                  │
│    .~    >       <    ~.       │  │      |  o  |                  │
│   /    (o o)   (o o)   \       │  │      | ___ |                  │
│  |        \___/         |      │  │     /|     |\                 │
│   \      ︿︿︿︿︿       /        │  │    ( |  >  | )                │
│     `~.           .~'          │  │     \|_____|/                 │
│          | | | |               │  │        |||                    │
│          ⚡ ⚡ ⚡ ⚡              │  │      __|||__                  │
│   HP ██████░░░  ATK 68  SPD 74 │  │  HP ████████░░  ATK 52 SPD 48 │
└────────────────────────────────┘  └───────────────────────────────┘

> Stormgrump used Thunder Jab! KaratusCactus takes 24 damage.
> What will KaratusCactus do? _
```

## Out of scope (power-hour discipline)

- Networked multiplayer
- Persistence / accounts / leveling
- A web frontend
- Claude Code skill integration
- Sound / animations
