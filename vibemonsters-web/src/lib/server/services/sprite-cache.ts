import { randomUUID } from 'node:crypto';

interface CachedSprite {
	buffer: Buffer;
	mimeType: string;
}

const MAX_ENTRIES = 64;
const cache = new Map<string, CachedSprite>();

export function storeSprite(buffer: Buffer, mimeType = 'image/png'): string {
	const id = randomUUID();
	cache.set(id, { buffer, mimeType });
	while (cache.size > MAX_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
	return id;
}

export function getSprite(id: string): CachedSprite | undefined {
	return cache.get(id);
}
