import { MonsterSchema } from '$lib/shared/schemas';
import type { Monster } from '$lib/shared/types';
import { anthropic } from '../ai/index.ts';
import { buildSummonPrompt } from '../prompts/summon.ts';
import { generateSprite } from './sprite-service.ts';

const MonsterDraftSchema = MonsterSchema.omit({ spriteUrl: true });

export async function summon(userPrompt: string): Promise<Monster> {
	const draft = await anthropic.generateStructured(buildSummonPrompt(userPrompt), MonsterDraftSchema);
	const spriteUrl = await generateSprite(draft.visualDescription);
	return { ...draft, spriteUrl };
}
