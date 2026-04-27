import {
	BUFF_CAP,
	BUFF_MULTIPLIER,
	DAMAGE_CAP,
	HEAL_CAP,
	TurnResultSchema
} from '$lib/shared/schemas';
import type { BattleState, BuffStat, PlayerAction, PlayerId, TurnResult } from '$lib/shared/types';
import { anthropic } from '../ai/index.ts';
import { buildTurnPrompt } from '../prompts/turn.ts';

export async function resolveTurn(
	state: BattleState,
	action: PlayerAction
): Promise<TurnResult> {
	const isP1 = action.player === 'p1';
	const defenderId: PlayerId = isP1 ? 'p2' : 'p1';
	const defenderIsDefending = isP1 ? state.p2Defending : state.p1Defending;

	const result = await anthropic.generateStructured(
		buildTurnPrompt(state, action),
		TurnResultSchema
	);

	if (result.damage > DAMAGE_CAP) result.damage = DAMAGE_CAP;
	if (result.healing > HEAL_CAP) result.healing = HEAL_CAP;
	if (result.attacker !== action.player) result.attacker = action.player;
	if (result.defender !== defenderId) result.defender = defenderId;

	if (defenderIsDefending && result.damage > 0) {
		result.damage = Math.max(0, Math.floor(result.damage / 2));
	}

	if (result.kind === 'heal' || result.kind === 'defend' || result.kind === 'buff') {
		result.damage = 0;
	}
	if (result.kind !== 'heal') result.healing = 0;
	if (result.kind !== 'defend') result.defended = false;
	if (result.kind !== 'buff') result.buffStat = null;

	return result;
}

export function applyTurn(state: BattleState, result: TurnResult): BattleState {
	const next: BattleState = {
		...state,
		p1Buffs: { ...state.p1Buffs },
		p2Buffs: { ...state.p2Buffs },
		p1Effects: [...state.p1Effects],
		p2Effects: [...state.p2Effects],
		log: [...state.log, result]
	};

	if (result.defender === 'p1' && next.p1Defending) next.p1Defending = false;
	else if (result.defender === 'p2' && next.p2Defending) next.p2Defending = false;

	if (result.damage > 0) {
		if (result.defender === 'p1') next.p1Hp = Math.max(0, next.p1Hp - result.damage);
		else next.p2Hp = Math.max(0, next.p2Hp - result.damage);
	}

	if (result.healing > 0) {
		if (result.attacker === 'p1') {
			next.p1Hp = Math.min(next.p1.stats.hp, next.p1Hp + result.healing);
		} else {
			next.p2Hp = Math.min(next.p2.stats.hp, next.p2Hp + result.healing);
		}
	}

	if (result.defended) {
		if (result.attacker === 'p1') next.p1Defending = true;
		else next.p2Defending = true;
	}

	if (result.kind === 'buff' && result.buffStat) {
		const buffs = result.attacker === 'p1' ? next.p1Buffs : next.p2Buffs;
		const stat: BuffStat = result.buffStat;
		const current = buffs[stat] ?? 1.0;
		buffs[stat] = Math.min(current * BUFF_MULTIPLIER, BUFF_CAP);
	}

	next.turn += 1;

	if (next.p1Hp === 0) next.winner = 'p2';
	else if (next.p2Hp === 0) next.winner = 'p1';

	return next;
}
