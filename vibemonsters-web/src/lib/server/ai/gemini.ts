import { GoogleGenAI } from '@google/genai';
import { env } from '../env.ts';

const MODEL = 'gemini-2.5-flash-image';
const MAX_ATTEMPTS = 3;

let cached: GoogleGenAI | null = null;
function client(): GoogleGenAI {
	cached ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
	return cached;
}

export interface ReferenceImage {
	mimeType: string;
	data: Buffer;
}

export interface GeneratedImage {
	mimeType: string;
	data: Buffer;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function attemptGenerate(
	parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
): Promise<GeneratedImage> {
	const response = await client().models.generateContent({
		model: MODEL,
		contents: [{ role: 'user', parts }]
	});

	const candidates = response.candidates ?? [];
	for (const candidate of candidates) {
		const candidateParts = candidate.content?.parts ?? [];
		for (const part of candidateParts) {
			const inline = part.inlineData;
			if (inline?.data && inline.mimeType?.startsWith('image/')) {
				return { mimeType: inline.mimeType, data: Buffer.from(inline.data, 'base64') };
			}
		}
	}

	throw new Error('Gemini returned no image data');
}

export async function generateImage(
	prompt: string,
	references: ReferenceImage[] = []
): Promise<GeneratedImage> {
	const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
		{ text: prompt },
		...references.map((r) => ({
			inlineData: { mimeType: r.mimeType, data: r.data.toString('base64') }
		}))
	];

	let lastError: unknown;
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			return await attemptGenerate(parts);
		} catch (e) {
			lastError = e;
			const msg = e instanceof Error ? e.message : String(e);
			// Don't retry on auth / quota / bad-request errors — only transient ones.
			if (/40[0134]|invalid|api key|prepayment|quota/i.test(msg)) break;
			if (attempt < MAX_ATTEMPTS) await sleep(400 * attempt);
		}
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
