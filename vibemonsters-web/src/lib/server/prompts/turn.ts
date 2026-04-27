import type { BattleState, BuffStat, Monster, PlayerAction, PlayerId } from '$lib/shared/types';

const STATS: BuffStat[] = ['atk', 'def', 'spd', 'mag'];

function effectiveStat(base: number, buffs: Partial<Record<BuffStat, number>>, stat: BuffStat): number {
	return Math.round(base * (buffs[stat] ?? 1.0));
}

function describeBuffs(buffs: Partial<Record<BuffStat, number>>): string {
	const entries = STATS.filter((s) => buffs[s] !== undefined).map((s) => `${s}: ${buffs[s]}`);
	return entries.length > 0 ? `{${entries.join(', ')}}` : '{}';
}

function describeMoves(monster: Monster): string {
	return monster.moves
		.map((m) => {
			const target = m.targetStat ? `, target_stat ${m.targetStat}` : '';
			return `    - "${m.name}" (${m.kind}, power ${m.power}${target}): ${m.description}`;
		})
		.join('\n');
}

export function buildTurnPrompt(state: BattleState, action: PlayerAction): string {
	const isP1 = action.player === 'p1';
	const attacker = isP1 ? state.p1 : state.p2;
	const defender = isP1 ? state.p2 : state.p1;
	const defenderId: PlayerId = isP1 ? 'p2' : 'p1';
	const attackerBuffs = isP1 ? state.p1Buffs : state.p2Buffs;
	const defenderBuffs = isP1 ? state.p2Buffs : state.p1Buffs;
	const defenderIsDefending = isP1 ? state.p2Defending : state.p1Defending;
	const defenderHpRemaining = isP1 ? state.p2Hp : state.p1Hp;

	const effAtk = effectiveStat(attacker.stats.atk, attackerBuffs, 'atk');
	const effDef = effectiveStat(defender.stats.def, defenderBuffs, 'def');
	const effMag = effectiveStat(attacker.stats.mag, attackerBuffs, 'mag');
	const effAttackerDef = effectiveStat(attacker.stats.def, attackerBuffs, 'def');
	const effAttackerSpd = effectiveStat(attacker.stats.spd, attackerBuffs, 'spd');
	const effDefenderAtk = effectiveStat(defender.stats.atk, defenderBuffs, 'atk');
	const effDefenderSpd = effectiveStat(defender.stats.spd, defenderBuffs, 'spd');
	const effDefenderMag = effectiveStat(defender.stats.mag, defenderBuffs, 'mag');

	const stateNotes: string[] = [];
	if (defenderIsDefending) {
		stateNotes.push(
			`- ${defender.name} is in a DEFENSIVE STANCE — the next incoming hit will be halved.`
		);
	}
	if (Object.keys(attackerBuffs).length > 0) {
		stateNotes.push(`- ${attacker.name} active buffs: ${describeBuffs(attackerBuffs)}`);
	}
	if (Object.keys(defenderBuffs).length > 0) {
		stateNotes.push(`- ${defender.name} active buffs: ${describeBuffs(defenderBuffs)}`);
	}
	const stateBlock = stateNotes.length > 0 ? '\n' + stateNotes.join('\n') : '';

	return `You are adjudicating one turn of a monster battle. Be fair, dramatic, and bounded.

The player does NOT control the monster directly. The player tells you what they WANT their monster to do — you decide what the monster ACTUALLY does, based on its body, element, and abilities. Honor the fantasy when plausible; narrate the gap when not.

ATTACKER: ${attacker.name} (${attacker.element}) ${attacker.emoji}
  stats (effective with buffs): HP ${attacker.stats.hp} / ATK ${effAtk} / DEF ${effAttackerDef} / SPD ${effAttackerSpd} / MAG ${effMag}
  MOVES:
${describeMoves(attacker)}

DEFENDER: ${defender.name} (${defender.element}) ${defender.emoji}
  stats (effective): HP ${defender.stats.hp} / ATK ${effDefenderAtk} / DEF ${effDef} / SPD ${effDefenderSpd} / MAG ${effDefenderMag}
  CURRENT HP: ${defenderHpRemaining} / ${defender.stats.hp}
${stateBlock}

THE PLAYER WANTS THEIR MONSTER TO: "${action.rawInput}"

RESOLUTION RULES:

1. INTERPRET THE ACTION → pick a MoveKind (kind field):
   - If it maps to a listed move, set moveUsed to that exact name and wasFreeform=false. Use that move's kind.
   - If freeform, wasFreeform=true, moveUsed=null, and YOU choose an appropriate kind.

2. DECIDE WHAT ACTUALLY HAPPENS:
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
     damage = 0, healing = 0. Pick buffStat ∈ {atk, def, spd, mag} that fits what the player described.

   Use EFFECTIVE stats (the ones already shown above, which include active buffs).
   variance: integer in [85, 115].
   effectiveness: {0.75, 1.0, 1.25} based on element matchup. Default 1.0.

   For freeform:
   - power = 10-55 based on potency + plausibility
   - impossible actions -> power 5-15, effectiveness 0.75

4. NARRATION: 1-2 vivid sentences. Reference the player's intent, show what happened. Sprinkle 1-3 thematic emojis (⚡ 🔥 💥 ✨ 🌪️ 🌊 🌱 🪨 💀 💖 🛡️ 💫 🌙 ☄️ 🧿 etc.) where they fit. If the opponent is defending, acknowledge the reduced impact. If buffs are active, you can reference them.

   FATALITY RULE: if your chosen damage would be >= defender's CURRENT HP (${defenderHpRemaining}), this is the KILLING BLOW. In that case, write 2-4 cinematic sentences instead: describe the finishing move landing, and how ${defender.name} finally goes down — knocked out cold, petrified, banished, dissolved into ${defender.element} mist, scattered on the wind, unmade — whatever fits ${defender.name}'s body and element. Epic, over-the-top, slow-motion. NOT gross (no blood, organs, gore — elemental/physical dissolution only). 2-4 thematic emojis woven in.

   Otherwise (non-lethal damage), do NOT narrate the defender fainting — just report the hit.

5. attacker must be "${action.player}", defender must be "${defenderId}".
`;
}
