import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { removeBackground } from '@imgly/background-removal-node';
import { generateImage, type ReferenceImage } from '../ai/gemini.ts';
import { storeSprite } from './sprite-cache.ts';

const STYLE_BIBLE_PATH = join(process.cwd(), 'static', 'style-bible.png');

let styleBibleCache: ReferenceImage | null | undefined;

async function loadStyleBible(): Promise<ReferenceImage | null> {
	if (styleBibleCache !== undefined) return styleBibleCache;
	try {
		const data = await readFile(STYLE_BIBLE_PATH);
		styleBibleCache = { mimeType: 'image/png', data };
	} catch {
		styleBibleCache = null;
	}
	return styleBibleCache;
}

function buildSpritePrompt(visualDescription: string, hasReference: boolean): string {
	const styleClause = hasReference
		? 'Match the illustrated style, palette, line weight, and proportions of the reference image exactly.'
		: 'Use a consistent illustrated style with bold outlines and saturated colors.';

	return [
		'Full-body illustrated monster creature.',
		visualDescription,
		'Centered, front-facing, full body visible, readable silhouette.',
		'Plain neutral background, no scene, no props, no text, no border, no ground shadow.',
		styleClause
	].join(' ');
}

export async function generateSprite(visualDescription: string): Promise<string> {
	const reference = await loadStyleBible();
	const prompt = buildSpritePrompt(visualDescription, reference !== null);
	const raw = await generateImage(prompt, reference ? [reference] : []);
	const matted = await matte(raw.data, raw.mimeType);
	const id = storeSprite(matted);
	return `/api/sprites/${id}`;
}

async function matte(input: Buffer, mimeType: string): Promise<Buffer> {
	const blob = new Blob([new Uint8Array(input)], { type: mimeType });
	const out = await removeBackground(blob, {
		model: 'medium',
		output: { format: 'image/png', quality: 0.9 }
	});
	return Buffer.from(await out.arrayBuffer());
}
