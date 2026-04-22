# VibeMonsters — Build Plan

Power-hour scope. Target: playable hotseat battle in ~60 min. One file, `vibemonsters.py`.

## Step 0 — Setup (~5 min)
- [ ] `uv init` (or venv), install `anthropic pydantic rich`
- [ ] `ANTHROPIC_API_KEY` in env
- [ ] Create `vibemonsters.py` entry point

## Step 1 — Pydantic schemas (~5 min)

Typed end-to-end. No raw dicts crossing function boundaries, no string literals where an `Enum` or `Literal` belongs.

### Domain models
- `Stats(BaseModel)` — `hp: int`, `atk: int`, `def_: int`, `spd: int`
  - `@model_validator` asserts `hp + atk + def_ + spd == 300` and `hp >= 80`
- `Move(BaseModel)` — `name: str`, `power: int = Field(ge=1, le=100)`, `flavor: str`, `description: str`
- `Monster(BaseModel)` — `name: str`, `element: str`, `emoji: str`, `stats: Stats`, `moves: list[Move] = Field(min_length=3, max_length=4)`, `ascii_art: str`

### Runtime types
- `PlayerId = Literal["p1", "p2"]`
- `Effectiveness(float, Enum)` — `RESISTED = 0.75`, `NORMAL = 1.0`, `WEAK = 1.25`
- `PlayerAction(BaseModel)` — `player: PlayerId`, `raw_input: str`, `matched_move: Move | None`
- `TurnResult(BaseModel)` — `narration: str`, `damage: int = Field(ge=0)`, `attacker: PlayerId`, `defender: PlayerId`, `move_used: str | None`, `effectiveness: Effectiveness`, `was_freeform: bool`
- `BattleState(BaseModel)` — `p1: Monster`, `p2: Monster`, `p1_hp: int`, `p2_hp: int`, `turn: int`, `log: list[TurnResult]`, `winner: PlayerId | None = None`

### Invariants enforced by the types
- Stats sum to exactly 300 (no prompt inflation)
- HP stat ≥ 80 (fights last more than one turn)
- Move power 1–100
- 3–4 moves per monster
- Damage is always non-negative
- Effectiveness is bounded by the enum — no freelance multipliers

## Step 2 — Monster generation (~10 min)
- [ ] `summon(prompt: str) -> Monster` — Claude call with Pydantic schema via tool use
- [ ] System prompt includes **2–3 few-shot ASCII monster examples** at target size (~30×15)
- [ ] Stat budget constraint in the prompt (e.g., stats sum to 300) to keep fights balanced
- [ ] HP floor (e.g., 80 minimum) so fights last more than one turn
- [ ] Quick test: summon two monsters, print them, eyeball

## Step 3 — Rendering (~15 min)
- [ ] `render_monster(m, current_hp) -> Panel` — ASCII art + HP bar + stat line
- [ ] HP bar: `█` filled / `░` empty, color-coded (green > 60%, yellow 30–60%, red < 30%)
- [ ] `render_battle(p1, p2, hp1, hp2, log_line)` — two panels side-by-side via `Columns`, log below
- [ ] Each turn = fresh `console.print(...)` — no `Live`, history scrolls
- [ ] Test: render two static monsters at varying HP levels

## Step 4 — Turn loop (~15 min)
- [ ] Speed stat determines turn order (higher SPD goes first)
- [ ] Read player input — move name OR freeform text
- [ ] `resolve_turn(attacker, defender, action) -> TurnResult` — Claude call, Pydantic-structured
- [ ] **Damage formula (enforced in prompt):**
  `damage = round((attacker.atk * move.power / defender.def) * effectiveness * randint(85, 115) / 100)`
  where `effectiveness ∈ {0.75, 1.0, 1.25}` — Claude picks based on vibes but is capped
- [ ] Freeform actions ("try to befriend it") get a fair-dice resolution — 50/50 success, modest damage either way
- [ ] Apply damage, re-render battle screen with new HP + narration line
- [ ] Alternate until HP ≤ 0 on one side

## Step 5 — Win state + polish (~10 min)
- [ ] Victory banner (big ASCII text via Rich)
- [ ] "Play again? (y/n)" prompt
- [ ] Graceful API error handling — retry once, then fail with a clear message

## Nice-to-haves (if time remains)
- Streaming narration for flavor
- Crit flavor ("A CRITICAL HIT!") — Claude just decides
- Reroll button during summon if the ASCII looks bad
- Type advantages — let Claude handle these implicitly, don't hardcode a rules table

## Known risks + mitigations
- **ASCII quality is streaky** → strong few-shot examples, reroll option
- **One-sided fights** → equal stat budget (300) + HP floor (80) + bounded damage formula + capped effectiveness (0.75–1.25x) + random ±15% variance keeps things swingy but fair
- **Turn resolution freelances rules** → narration is free, **numbers are not**: Claude must return damage computed from the formula, validated against a plausible range on our end
- **Cool-prompt bias** → same stat budget regardless of how evocative the summon prompt is; a "legendary dragon god" gets the same 300 points as "small angry bean"

## File layout

```
VibeMonsters/
├── README.md
├── PLAN.md
└── vibemonsters.py   # everything — schemas, prompts, render, loop
```
