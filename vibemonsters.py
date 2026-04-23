"""VibeMonsters — vibe-coded Pokémon battles in the terminal."""

from __future__ import annotations

import json
import random
import subprocess
import sys
from enum import Enum
from typing import Literal, TypeVar

from pydantic import BaseModel, Field, ValidationError, model_validator
from rich.columns import Columns
from rich.console import Console
from rich.markup import escape
from rich.panel import Panel


PlayerId = Literal["p1", "p2"]
HEX_COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"
STAT_BUDGET = 400
HP_FLOOR = 80
BUFF_MULTIPLIER = 1.25
DEFEND_REDUCTION = 0.5

BuffStat = Literal["atk", "def", "spd", "mag"]


class Effectiveness(float, Enum):
    RESISTED = 0.75
    NORMAL = 1.0
    WEAK = 1.25


class MoveKind(str, Enum):
    PHYSICAL = "physical"  # damage scaling with ATK
    MAGICAL = "magical"    # damage scaling with MAG
    HEAL = "heal"          # restores HP to self, scales with MAG
    DEFEND = "defend"      # halves the next incoming hit
    BUFF = "buff"          # raises one of own stats 25% for the rest of the battle


class Stats(BaseModel):
    hp: int = Field(ge=1)
    atk: int = Field(ge=1)
    def_: int = Field(ge=1, alias="def")
    spd: int = Field(ge=1)
    mag: int = Field(ge=1)

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def _budget_and_floor(self) -> Stats:
        total = self.hp + self.atk + self.def_ + self.spd + self.mag
        if total != STAT_BUDGET:
            raise ValueError(f"stats must sum to {STAT_BUDGET}, got {total}")
        if self.hp < HP_FLOOR:
            raise ValueError(f"hp must be >= {HP_FLOOR}, got {self.hp}")
        return self


class Move(BaseModel):
    name: str
    kind: MoveKind
    power: int = Field(ge=0, le=100)
    target_stat: BuffStat | None = None  # required for BUFF, ignored otherwise
    flavor: str
    description: str

    @model_validator(mode="after")
    def _buff_has_stat(self) -> Move:
        if self.kind == MoveKind.BUFF and self.target_stat is None:
            raise ValueError("buff moves must have target_stat")
        return self


class Monster(BaseModel):
    name: str
    element: str
    emoji: str
    border_color: str = Field(pattern=HEX_COLOR_PATTERN)
    stats: Stats
    moves: list[Move] = Field(min_length=3, max_length=4)
    ascii_art: str


class PlayerAction(BaseModel):
    player: PlayerId
    raw_input: str
    matched_move: Move | None = None


class TurnResult(BaseModel):
    narration: str
    kind: MoveKind
    damage: int = Field(ge=0, default=0)          # applied to defender (physical/magical only)
    healing: int = Field(ge=0, default=0)         # applied to attacker (heal only)
    defended: bool = False                        # attacker goes into defensive stance (defend only)
    buff_stat: BuffStat | None = None             # which stat got buffed (buff only)
    attacker: PlayerId
    defender: PlayerId
    move_used: str | None
    effectiveness: Effectiveness
    was_freeform: bool


class BattleState(BaseModel):
    p1: Monster
    p2: Monster
    p1_hp: int
    p2_hp: int
    p1_defending: bool = False
    p2_defending: bool = False
    p1_buffs: dict[str, float] = Field(default_factory=dict)
    p2_buffs: dict[str, float] = Field(default_factory=dict)
    turn: int = 0
    log: list[TurnResult] = Field(default_factory=list)
    winner: PlayerId | None = None


TModel = TypeVar("TModel", bound=BaseModel)


def _strip_fences(s: str) -> str:
    s = s.strip()
    if not s.startswith("```"):
        return s
    lines = s.split("\n")[1:]
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines)


def call_claude(prompt: str, response_model: type[TModel], retries: int = 1) -> TModel:
    """Subprocess `claude -p`, extract .result, parse JSON, validate via Pydantic.

    Retries once with the validation error appended so Claude can self-correct.
    """
    schema = response_model.model_json_schema()
    base = (
        f"{prompt}\n\n"
        "Return ONLY valid JSON matching this schema. No markdown fences, no prose, "
        f"no leading/trailing text:\n{json.dumps(schema, indent=2)}"
    )
    current_prompt = base
    last_error: Exception | None = None

    for _ in range(retries + 1):
        proc = subprocess.run(
            ["claude", "-p", current_prompt, "--output-format", "json"],
            capture_output=True,
            text=True,
            check=True,
        )
        outer = json.loads(proc.stdout)
        content = _strip_fences(outer["result"])
        try:
            return response_model.model_validate_json(content)
        except ValidationError as e:
            last_error = e
            current_prompt = (
                f"{base}\n\nYour previous response failed validation:\n{e}\n"
                f"Previous response was:\n{content}\n\nTry again."
            )

    raise RuntimeError(f"call_claude failed after retries: {last_error}")


ASCII_EXAMPLES = """\
Example — "a cheeky fire spirit":
         ___
        /   \\
       | >_< |
        \\_v_/
       __|_|__
      /   |   \\
     ~   ( )   ~
      \\__|__/
         |
        /|\\
       ~ | ~
        ~~~

Example — "a grumpy rock golem":
      _________
     /         \\
    |  x     x  |
    |     _     |
    |   (___)   |
    |___________|
       ||   ||
      /||   ||\\
     /_||___||_\\
     |||     |||
     ###     ###
"""


SUMMON_INSTRUCTIONS = f"""\
You are generating a monster for a vibe-coded Pokémon-style battle game.

STATS (5, budget = 400):
  hp   — health (must be >= 80 so fights last)
  atk  — physical power (drives physical moves)
  def  — defends both physical AND magical damage
  spd  — turn order
  mag  — magical power (drives magical moves, heals, psychic stuff)

  stats.hp + stats.atk + stats."def" + stats.spd + stats.mag MUST equal exactly 400.
  Every stat >= 1. Specialize the monster — glass cannons, tanks, mages, supports all valid.

MOVESET (3 or 4 moves). Each move has a kind:
  - "physical"  damage, scales with ATK.   power 20-100.   E.g. "Bite", "Slam", "Karate Chop"
  - "magical"   damage, scales with MAG.   power 20-100.   E.g. "Zap", "Mind Blast", "Hex"
  - "heal"      restores HP to self, scales with MAG.   power 30-70.   E.g. "Regrow", "Meditate"
  - "defend"    halves next incoming hit.   power 0.   E.g. "Brace", "Shell Up"
  - "buff"      raises one own stat 25% for the rest of battle.   power 0.   target_stat one of {{atk, def, spd, mag}}.   E.g. "Power Up" (atk), "Fleet Foot" (spd)

GIVE A VARIED MOVESET. A good monster has a mix — e.g. two attacks + one utility (heal/defend/buff). Don't make four identical physical punches.

STAT-MOVE ALIGNMENT: moves should match the monster's stats. A high-MAG monster should have magical/heal moves. A high-ATK monster should have physical moves. Mismatches are allowed but should be rare.

OTHER FIELDS:
- ascii_art: roughly 28-32 columns wide, 10-15 rows tall. ASCII + common box-drawing only, no fancy unicode art.
- emoji: a single emoji that captures the vibe
- element: any word (electric, plant, vibes, cosmic, salt, etc.)
- border_color: a hex color (format "#rrggbb", six hex digits) that captures this monster's vibe.
    Pick ANY color — be specific and flavorful. Examples:
      lava mouse -> "#ff3b00"   psychic broom -> "#b19cd9"   toxic slime -> "#7fff00"
      cosmic void -> "#2d1b69"  rusty robot  -> "#8b4513"    ice dragon  -> "#7fdbff"
      sunny golem -> "#ffd166"  mint ghost   -> "#a8e6cf"    shadow wolf -> "#36454f"
    Colors should feel distinctive — resist defaulting to pure red/green/blue.

ASCII ART STYLE — match these examples:
{ASCII_EXAMPLES}
"""


def summon(user_prompt: str) -> Monster:
    full = f"{SUMMON_INSTRUCTIONS}\nUSER'S MONSTER DESCRIPTION: {user_prompt}\n"
    return call_claude(full, Monster)


def _hp_bar(current: int, maximum: int, width: int = 14) -> str:
    pct = max(0.0, min(1.0, current / maximum)) if maximum else 0.0
    filled = round(width * pct)
    color = "green" if pct > 0.6 else "yellow" if pct > 0.3 else "red"
    return f"[bold {color}]{'█' * filled}[/bold {color}][dim]{'░' * (width - filled)}[/dim]"


def _stat_badge(label: str, base: int, mult: float) -> str:
    if mult != 1.0:
        effective = round(base * mult)
        return f"[dim]{label}[/dim] [bold cyan]{effective}[/bold cyan][dim]↑[/dim]"
    return f"[dim]{label}[/dim] {base}"


def render_monster(
    m: Monster,
    current_hp: int,
    buffs: dict[str, float] | None = None,
    defending: bool = False,
) -> Panel:
    s = m.stats
    buffs = buffs or {}
    stat_line = "   ".join([
        _stat_badge("ATK", s.atk, buffs.get("atk", 1.0)),
        _stat_badge("DEF", s.def_, buffs.get("def", 1.0)),
        _stat_badge("SPD", s.spd, buffs.get("spd", 1.0)),
        _stat_badge("MAG", s.mag, buffs.get("mag", 1.0)),
    ])
    status_line = "  [cyan]🛡️  defending[/cyan]" if defending else ""
    body = (
        f"{escape(m.ascii_art)}\n\n"
        f"HP  {_hp_bar(current_hp, s.hp)}  [bold]{current_hp}[/bold]/{s.hp}{status_line}\n"
        f"{stat_line}"
    )
    title = f"{m.emoji} [bold]{escape(m.name)}[/bold] [dim]({escape(m.element)})[/dim]"
    return Panel(body, title=title, border_style=m.border_color, padding=(1, 2))


def render_battle(
    console: Console,
    p1: Monster, p2: Monster,
    hp1: int, hp2: int,
    log_line: str | None = None,
    p1_buffs: dict[str, float] | None = None,
    p2_buffs: dict[str, float] | None = None,
    p1_defending: bool = False,
    p2_defending: bool = False,
) -> None:
    console.print(
        Columns(
            [
                render_monster(p1, hp1, p1_buffs, p1_defending),
                render_monster(p2, hp2, p2_buffs, p2_defending),
            ],
            equal=True, expand=True,
        )
    )
    if log_line:
        console.print(Panel(escape(log_line), border_style="cyan", padding=(0, 2)))


DAMAGE_CAP = 45
HEAL_CAP = 35


def _effective_stat(base: int, buffs: dict[str, float], stat: str) -> int:
    return round(base * buffs.get(stat, 1.0))


def resolve_turn(state: BattleState, action: PlayerAction) -> TurnResult:
    attacker = state.p1 if action.player == "p1" else state.p2
    defender = state.p2 if action.player == "p1" else state.p1
    defender_id: PlayerId = "p2" if action.player == "p1" else "p1"
    attacker_buffs = state.p1_buffs if action.player == "p1" else state.p2_buffs
    defender_buffs = state.p2_buffs if action.player == "p1" else state.p1_buffs
    defender_is_defending = state.p2_defending if action.player == "p1" else state.p1_defending

    eff_atk = _effective_stat(attacker.stats.atk, attacker_buffs, "atk")
    eff_mag = _effective_stat(attacker.stats.mag, attacker_buffs, "mag")
    eff_def = _effective_stat(defender.stats.def_, defender_buffs, "def")

    moves_list = "\n".join(
        f'    - "{m.name}" ({m.kind.value}, power {m.power}'
        + (f", target_stat {m.target_stat}" if m.target_stat else "")
        + f"): {m.description}"
        for m in attacker.moves
    )

    state_notes = []
    if defender_is_defending:
        state_notes.append(f"- {defender.name} is in a DEFENSIVE STANCE — the next incoming hit will be halved.")
    if attacker_buffs:
        state_notes.append(f"- {attacker.name} active buffs: {dict(attacker_buffs)}")
    if defender_buffs:
        state_notes.append(f"- {defender.name} active buffs: {dict(defender_buffs)}")
    state_block = ("\n" + "\n".join(state_notes)) if state_notes else ""

    prompt = f"""You are adjudicating one turn of a monster battle. Be fair, dramatic, and bounded.

The player does NOT control the monster directly. The player tells you what they WANT their monster to do — you decide what the monster ACTUALLY does, based on its body, element, and abilities. Honor the fantasy when plausible; narrate the gap when not.

ATTACKER: {attacker.name} ({attacker.element}) {attacker.emoji}
  stats (effective with buffs): HP {attacker.stats.hp} / ATK {eff_atk} / DEF {_effective_stat(attacker.stats.def_, attacker_buffs, 'def')} / SPD {_effective_stat(attacker.stats.spd, attacker_buffs, 'spd')} / MAG {eff_mag}
  MOVES:
{moves_list}

DEFENDER: {defender.name} ({defender.element}) {defender.emoji}
  stats (effective): HP {defender.stats.hp} / ATK {_effective_stat(defender.stats.atk, defender_buffs, 'atk')} / DEF {eff_def} / SPD {_effective_stat(defender.stats.spd, defender_buffs, 'spd')} / MAG {_effective_stat(defender.stats.mag, defender_buffs, 'mag')}
{state_block}

THE PLAYER WANTS THEIR MONSTER TO: "{action.raw_input}"

RESOLUTION RULES:

1. INTERPRET THE ACTION → pick a MoveKind (kind field):
   - If it maps to a listed move, set move_used to that exact name and was_freeform=false. Use that move's kind.
   - If freeform, was_freeform=true, move_used=null, and YOU choose an appropriate kind.

2. DECIDE WHAT ACTUALLY HAPPENS (same agency rule as before):
   - Fits the monster -> it works normally
   - Stretch -> monster improvises something related
   - Impossible for this body -> monster tries and fails/substitutes weakly
   - Clever + on-theme -> lean in, small power bump

3. APPLY THE FORMULA for the chosen kind:

   physical attack:
     damage = round(attacker_ATK * power / (defender_DEF * 2) * effectiveness * variance / 100)
     healing = 0

   magical attack:
     damage = round(attacker_MAG * power / (defender_DEF * 2) * effectiveness * variance / 100)
     healing = 0

   heal (targets attacker):
     healing = round(attacker_MAG * power / 200 * variance / 100)
     damage = 0

   defend:
     damage = 0, healing = 0, defended = true. Next incoming hit against this monster will be halved.

   buff:
     damage = 0, healing = 0. Pick buff_stat ∈ {{atk, def, spd, mag}} that fits what the player described.

   Use EFFECTIVE stats (the ones already shown above, which include active buffs).
   variance: integer in [85, 115].
   effectiveness: {{0.75, 1.0, 1.25}} based on element matchup. Default 1.0.

   For freeform:
   - power = 10-55 based on potency + plausibility
   - impossible actions -> power 5-15, effectiveness 0.75

4. NARRATION: 1-2 vivid sentences. Reference the player's intent, show what happened. Sprinkle 1-3 thematic emojis (⚡ 🔥 💥 ✨ 🌪️ 🌊 🌱 🪨 💀 💖 🛡️ 💫 🌙 ☄️ 🧿 etc.) where they fit. If the opponent is defending, acknowledge the reduced impact. If buffs are active, you can reference them. Never narrate the defender fainting — just report the damage.

5. attacker must be "{action.player}", defender must be "{defender_id}".
"""
    result = call_claude(prompt, TurnResult)
    # Safety rails — enforce caps + self-consistency
    if result.damage > DAMAGE_CAP:
        result.damage = DAMAGE_CAP
    if result.healing > HEAL_CAP:
        result.healing = HEAL_CAP
    if result.attacker != action.player:
        result.attacker = action.player
    if result.defender != defender_id:
        result.defender = defender_id
    # If defender was defending, halve damage (defender flag cleared in run_battle)
    if defender_is_defending and result.damage > 0:
        result.damage = max(0, result.damage // 2)
    # Kind-specific zero-out for consistency
    if result.kind in (MoveKind.HEAL, MoveKind.DEFEND, MoveKind.BUFF):
        result.damage = 0
    if result.kind != MoveKind.HEAL:
        result.healing = 0
    if result.kind != MoveKind.DEFEND:
        result.defended = False
    if result.kind != MoveKind.BUFF:
        result.buff_stat = None
    return result


def _current_player(state: BattleState, first: PlayerId) -> PlayerId:
    other: PlayerId = "p2" if first == "p1" else "p1"
    return first if state.turn % 2 == 0 else other


def run_battle(console: Console, p1: Monster, p2: Monster) -> Monster:
    state = BattleState(p1=p1, p2=p2, p1_hp=p1.stats.hp, p2_hp=p2.stats.hp)
    first: PlayerId = "p1" if p1.stats.spd >= p2.stats.spd else "p2"

    while state.winner is None:
        console.print()
        render_battle(
            console, p1, p2, state.p1_hp, state.p2_hp,
            log_line=state.log[-1].narration if state.log else f"Battle start! {p1.name} vs. {p2.name}. Fastest attacks first.",
            p1_buffs=state.p1_buffs, p2_buffs=state.p2_buffs,
            p1_defending=state.p1_defending, p2_defending=state.p2_defending,
        )

        current = _current_player(state, first)
        attacker = p1 if current == "p1" else p2
        move_names = ", ".join(m.name for m in attacker.moves)
        console.print(
            f"\n[bold]{attacker.emoji} {attacker.name}[/bold]'s turn — "
            f"[dim]{move_names}[/dim], or freeform:"
        )
        try:
            raw = console.input("[bold cyan]> [/bold cyan]").strip()
        except EOFError:
            raw = ""
            auto_move = random.choice(attacker.moves)
            console.print(f"[dim][auto-play] {auto_move.name}[/dim]")
            raw = auto_move.name
        if not raw:
            raw = random.choice(attacker.moves).name

        action = PlayerAction(player=current, raw_input=raw)
        try:
            with console.status(
                f"[dim]{attacker.emoji} {attacker.name} is doing its thing...[/dim]",
                spinner="dots",
            ):
                result = resolve_turn(state, action)
        except Exception as e:
            console.print(f"[red]Turn resolution failed: {e}[/red] (retrying with first move)")
            action = PlayerAction(player=current, raw_input=attacker.moves[0].name)
            with console.status("[dim]Retrying...[/dim]", spinner="dots"):
                result = resolve_turn(state, action)

        # Clear defender's defending flag if they were defending (it "used up" this turn)
        if result.defender == "p1" and state.p1_defending:
            state.p1_defending = False
        elif result.defender == "p2" and state.p2_defending:
            state.p2_defending = False

        # Apply damage to defender
        if result.damage > 0:
            if result.defender == "p1":
                state.p1_hp = max(0, state.p1_hp - result.damage)
            else:
                state.p2_hp = max(0, state.p2_hp - result.damage)

        # Apply healing to attacker (capped at max HP)
        if result.healing > 0:
            if result.attacker == "p1":
                state.p1_hp = min(p1.stats.hp, state.p1_hp + result.healing)
            else:
                state.p2_hp = min(p2.stats.hp, state.p2_hp + result.healing)

        # Apply defend stance to attacker
        if result.defended:
            if result.attacker == "p1":
                state.p1_defending = True
            else:
                state.p2_defending = True

        # Apply buff to attacker (stack-capped so nothing runs away)
        if result.kind == MoveKind.BUFF and result.buff_stat:
            buffs = state.p1_buffs if result.attacker == "p1" else state.p2_buffs
            current = buffs.get(result.buff_stat, 1.0)
            buffs[result.buff_stat] = min(current * BUFF_MULTIPLIER, 1.75)

        state.log.append(result)
        state.turn += 1

        if state.p1_hp == 0:
            state.winner = "p2"
        elif state.p2_hp == 0:
            state.winner = "p1"

    # Final render shows the KO narration...
    console.print()
    render_battle(
        console, p1, p2, state.p1_hp, state.p2_hp,
        log_line=state.log[-1].narration,
        p1_buffs=state.p1_buffs, p2_buffs=state.p2_buffs,
        p1_defending=state.p1_defending, p2_defending=state.p2_defending,
    )
    # ...then the victory banner below it.
    winner = p1 if state.winner == "p1" else p2
    console.print(
        Panel(
            f"🏆  [bold yellow]{escape(winner.name)}[/bold yellow] is victorious!  🏆",
            border_style="yellow",
            padding=(1, 2),
        )
    )
    return winner


def _prompt_for_monster(console: Console, player_label: str, default: str) -> str:
    try:
        raw = console.input(
            f"[bold]{player_label}[/bold], describe your monster "
            f"[dim](enter for default: {default!r})[/dim]\n[bold cyan]> [/bold cyan]"
        ).strip()
    except EOFError:
        raw = ""
    return raw or default


def _demo(prompts: list[str]) -> None:
    console = Console()
    console.print(
        Panel(
            "[bold]Describe two monsters. They will fight.[/bold]\n"
            "[dim]Stats are auto-balanced to a 300-point budget. Good luck.[/dim]",
            title="⚔️  VibeMonsters  ⚔️",
            border_style="magenta",
            padding=(1, 2),
        )
    )

    if len(prompts) >= 2:
        p1_prompt, p2_prompt = prompts[0], prompts[1]
    else:
        p1_prompt = _prompt_for_monster(console, "Player 1", "a grumpy storm cloud that throws lightning")
        p2_prompt = _prompt_for_monster(console, "Player 2", "a cactus that knows karate")

    console.print()
    with console.status(
        f"[bold magenta]Summoning Player 1:[/bold magenta] [italic]{p1_prompt}[/italic]",
        spinner="dots",
    ):
        p1 = summon(p1_prompt)
    console.print(f"[green]✓[/green] [bold]{p1.emoji} {p1.name}[/bold] appears!")
    with console.status(
        f"[bold magenta]Summoning Player 2:[/bold magenta] [italic]{p2_prompt}[/italic]",
        spinner="dots",
    ):
        p2 = summon(p2_prompt)
    console.print(f"[green]✓[/green] [bold]{p2.emoji} {p2.name}[/bold] appears!")

    run_battle(console, p1, p2)


if __name__ == "__main__":
    _demo(sys.argv[1:])
