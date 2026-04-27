import { error } from '@sveltejs/kit';
import { getSprite } from '$lib/server/services/sprite-cache';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = ({ params }) => {
	const sprite = getSprite(params.id);
	if (!sprite) throw error(404, 'sprite not found');
	return new Response(new Uint8Array(sprite.buffer), {
		headers: {
			'content-type': sprite.mimeType,
			'cache-control': 'public, max-age=31536000, immutable'
		}
	});
};
