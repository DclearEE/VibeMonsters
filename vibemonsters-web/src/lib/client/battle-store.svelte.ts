import type { BattleState, Monster } from '$lib/shared/types';

class BattleStore {
	state = $state<BattleState | null>(null);

	init(p1: Monster, p2: Monster): void {
		this.state = {
			p1,
			p2,
			p1Hp: p1.stats.hp,
			p2Hp: p2.stats.hp,
			p1Defending: false,
			p2Defending: false,
			p1Buffs: {},
			p2Buffs: {},
			p1Effects: [],
			p2Effects: [],
			turn: 0,
			log: [],
			winner: null
		};
	}

	reset(): void {
		this.state = null;
	}
}

export const battle = new BattleStore();
