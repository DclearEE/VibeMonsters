import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { summon } from '$lib/server/services/monster-service';
import type { RequestHandler } from './$types.js';

const RequestSchema = z.object({
	prompt: z.string().min(1).max(500)
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

	try {
		const monster = await summon(parsed.data.prompt);
		return json({ monster });
	} catch (e) {
		console.error('[summon] failed', e);
		const message = e instanceof Error ? e.message : String(e);
		throw error(500, `summon failed: ${message}`);
	}
};
