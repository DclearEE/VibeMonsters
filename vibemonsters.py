"""VibeMonsters — vibe-coded Pokémon battles in the terminal."""

from __future__ import annotations

import json
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


class Effectiveness(float, Enum):
    RESISTED = 0.75
    NORMAL = 1.0
    WEAK = 1.25


class Stats(BaseModel):
    hp: int = Field(ge=1)
    atk: int = Field(ge=1)
    def_: int = Field(ge=1, alias="def")
    spd: int = Field(ge=1)

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def _budget_and_floor(self) -> Stats:
        total = self.hp + self.atk + self.def_ + self.spd
        if total != 300:
            raise ValueError(f"stats must sum to 300, got {total}")
        if self.hp < 80:
            raise ValueError(f"hp must be >= 80, got {self.hp}")
        return self


class Move(BaseModel):
    name: str
    power: int = Field(ge=1, le=100)
    flavor: str
    description: str


class Monster(BaseModel):
    name: str
    element: str
    emoji: str
    stats: Stats
    moves: list[Move] = Field(min_length=3, max_length=4)
    ascii_art: str


class PlayerAction(BaseModel):
    player: PlayerId
    raw_input: str
    matched_move: Move | None = None


class TurnResult(BaseModel):
    narration: str
    damage: int = Field(ge=0)
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

STRICT CONSTRAINTS:
- stats.hp + stats.atk + stats."def" + stats.spd MUST equal exactly 300
- stats.hp MUST be >= 80 (fights must last more than one turn)
- Every stat >= 1
- Every move's power is 1-100
- Provide 3 or 4 moves
- ascii_art should be roughly 28-32 columns wide, 10-15 rows tall
- emoji: a single emoji that captures the vibe
- element: any word (electric, plant, vibes, cosmic, salt, etc.)

ASCII ART STYLE — match these examples:
{ASCII_EXAMPLES}
Use only ASCII characters and common box-drawing; no fancy unicode art.
"""


def summon(user_prompt: str) -> Monster:
    full = f"{SUMMON_INSTRUCTIONS}\nUSER'S MONSTER DESCRIPTION: {user_prompt}\n"
    return call_claude(full, Monster)


def _hp_bar(current: int, maximum: int, width: int = 14) -> str:
    pct = max(0.0, min(1.0, current / maximum)) if maximum else 0.0
    filled = round(width * pct)
    color = "green" if pct > 0.6 else "yellow" if pct > 0.3 else "red"
    return f"[bold {color}]{'█' * filled}[/bold {color}][dim]{'░' * (width - filled)}[/dim]"


def render_monster(m: Monster, current_hp: int) -> Panel:
    s = m.stats
    body = (
        f"{escape(m.ascii_art)}\n\n"
        f"HP  {_hp_bar(current_hp, s.hp)}  [bold]{current_hp}[/bold]/{s.hp}\n"
        f"[dim]ATK[/dim] {s.atk}   [dim]DEF[/dim] {s.def_}   [dim]SPD[/dim] {s.spd}"
    )
    title = f"{m.emoji} [bold]{escape(m.name)}[/bold] [dim]({escape(m.element)})[/dim]"
    border = "green" if current_hp == s.hp else "yellow" if current_hp > s.hp * 0.3 else "red"
    return Panel(body, title=title, border_style=border, padding=(1, 2))


def render_battle(
    console: Console,
    p1: Monster, p2: Monster,
    hp1: int, hp2: int,
    log_line: str | None = None,
) -> None:
    console.print(
        Columns(
            [render_monster(p1, hp1), render_monster(p2, hp2)],
            equal=True, expand=True,
        )
    )
    if log_line:
        console.print(Panel(escape(log_line), border_style="cyan", padding=(0, 2)))


def _demo(prompts: list[str]) -> None:
    console = Console()
    p1_prompt = prompts[0] if len(prompts) > 0 else "a grumpy storm cloud that throws lightning"
    p2_prompt = prompts[1] if len(prompts) > 1 else "a cactus that knows karate"

    console.print(f"[dim]Summoning P1:[/dim] {p1_prompt!r}")
    p1 = summon(p1_prompt)
    console.print(f"[dim]Summoning P2:[/dim] {p2_prompt!r}")
    p2 = summon(p2_prompt)

    console.print()
    render_battle(
        console, p1, p2,
        hp1=p1.stats.hp, hp2=p2.stats.hp,
        log_line=f"The battle begins! {p1.name} vs. {p2.name}.",
    )


if __name__ == "__main__":
    _demo(sys.argv[1:])
