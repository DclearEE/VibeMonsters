import type { z } from 'zod';
import type {
	BattleStateSchema,
	BuffStatSchema,
	EffectivenessSchema,
	MonsterSchema,
	MoveKindSchema,
	MoveSchema,
	PlayerActionSchema,
	PlayerIdSchema,
	StatsSchema,
	StatusEffectSchema,
	TurnResultSchema
} from './schemas.ts';

export type PlayerId = z.infer<typeof PlayerIdSchema>;
export type BuffStat = z.infer<typeof BuffStatSchema>;
export type MoveKind = z.infer<typeof MoveKindSchema>;
export type Effectiveness = z.infer<typeof EffectivenessSchema>;
export type Stats = z.infer<typeof StatsSchema>;
export type Move = z.infer<typeof MoveSchema>;
export type StatusEffect = z.infer<typeof StatusEffectSchema>;
export type Monster = z.infer<typeof MonsterSchema>;
export type PlayerAction = z.infer<typeof PlayerActionSchema>;
export type TurnResult = z.infer<typeof TurnResultSchema>;
export type BattleState = z.infer<typeof BattleStateSchema>;
