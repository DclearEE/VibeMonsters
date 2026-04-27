import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { BattleStateSchema, PlayerActionSchema } from '$lib/shared/schemas';
import { applyTurn, resolveTurn } from '$lib/server/services/battle-service';
import type { RequestHandler } from './$types.js';

const RequestSchema = z.object({
	state: BattleStateSchema,
	action: PlayerActionSchema
});

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'invalid JSON body');
	}
	const parsed = RequestSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.message);
	}

	if (parsed.data.state.winner !== null) {
		throw error(400, 'battle is already over');
	}

	try {
		const turnResult = await resolveTurn(parsed.data.state, parsed.data.action);
		const nextState = applyTurn(parsed.data.state, turnResult);
		return json({ turnResult, nextState });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		throw error(500, `turn resolution failed: ${message}`);
	}
};
