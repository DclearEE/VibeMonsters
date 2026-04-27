import { z } from 'zod';

export const STAT_BUDGET = 400;
export const HP_FLOOR = 80;
export const BUFF_MULTIPLIER = 1.25;
export const BUFF_CAP = 1.75;
export const DEFEND_REDUCTION = 0.5;
export const DAMAGE_CAP = 45;
export const HEAL_CAP = 35;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const PlayerIdSchema = z.enum(['p1', 'p2']);

export const BuffStatSchema = z.enum(['atk', 'def', 'spd', 'mag']);

export const MoveKindSchema = z.enum(['physical', 'magical', 'heal', 'defend', 'buff']);

export const StatusEffectSchema = z.enum([
	'burn',
	'freeze',
	'poison',
	'confuse',
	'haste',
	'regen',
	'shield'
]);

export const EffectivenessSchema = z.union([
	z.literal(0.75),
	z.literal(1.0),
	z.literal(1.25)
]);

export const StatsSchema = z
	.object({
		hp: z.number().int().min(1),
		atk: z.number().int().min(1),
		def: z.number().int().min(1),
		spd: z.number().int().min(1),
		mag: z.number().int().min(1)
	})
	.refine((s) => s.hp + s.atk + s.def + s.spd + s.mag === STAT_BUDGET, {
		message: `stats must sum to ${STAT_BUDGET}`
	})
	.refine((s) => s.hp >= HP_FLOOR, {
		message: `hp must be >= ${HP_FLOOR}`
	});

export const MoveSchema = z
	.object({
		name: z.string().min(1),
		kind: MoveKindSchema,
		power: z.number().int().min(0).max(100),
		targetStat: BuffStatSchema.nullable().default(null),
		flavor: z.string(),
		description: z.string()
	})
	.refine((m) => m.kind !== 'buff' || m.targetStat !== null, {
		message: 'buff moves must have targetStat',
		path: ['targetStat']
	});

export const MonsterSchema = z.object({
	name: z.string().min(1),
	element: z.string().min(1),
	emoji: z.string().min(1),
	borderColor: z.string().regex(HEX_COLOR_PATTERN, 'borderColor must be #rrggbb'),
	stats: StatsSchema,
	moves: z.array(MoveSchema).min(3).max(4),
	visualDescription: z.string().min(1),
	spriteUrl: z.string().min(1)
});

export const PlayerActionSchema = z.object({
	player: PlayerIdSchema,
	rawInput: z.string(),
	matchedMove: MoveSchema.nullable().default(null)
});

export const TurnResultSchema = z.object({
	narration: z.string().min(1),
	kind: MoveKindSchema,
	damage: z.number().int().min(0).default(0),
	healing: z.number().int().min(0).default(0),
	defended: z.boolean().default(false),
	crit: z.boolean().default(false),
	buffStat: BuffStatSchema.nullable().default(null),
	effectsApplied: z.array(StatusEffectSchema).default([]),
	effectsRemoved: z.array(StatusEffectSchema).default([]),
	attacker: PlayerIdSchema,
	defender: PlayerIdSchema,
	moveUsed: z.string().nullable(),
	effectiveness: EffectivenessSchema,
	wasFreeform: z.boolean()
});

const BuffMapSchema = z.partialRecord(BuffStatSchema, z.number());

export const BattleStateSchema = z.object({
	p1: MonsterSchema,
	p2: MonsterSchema,
	p1Hp: z.number().int().min(0),
	p2Hp: z.number().int().min(0),
	p1Defending: z.boolean().default(false),
	p2Defending: z.boolean().default(false),
	p1Buffs: BuffMapSchema.default({}),
	p2Buffs: BuffMapSchema.default({}),
	p1Effects: z.array(StatusEffectSchema).default([]),
	p2Effects: z.array(StatusEffectSchema).default([]),
	turn: z.number().int().min(0).default(0),
	log: z.array(TurnResultSchema).default([]),
	winner: PlayerIdSchema.nullable().default(null)
});
