import type { z } from 'zod';

export interface AnthropicClient {
	generateStructured<T>(
		prompt: string,
		schema: z.ZodType<T>,
		opts?: { retries?: number }
	): Promise<T>;
}

export function stripFences(s: string): string {
	const trimmed = s.trim();
	if (!trimmed.startsWith('```')) return trimmed;
	const lines = trimmed.split('\n').slice(1);
	if (lines.at(-1)?.trim().startsWith('```')) lines.pop();
	return lines.join('\n');
}

export function buildStructuredPrompt(prompt: string, jsonSchema: unknown): string {
	return (
		`${prompt}\n\n` +
		'Return ONLY valid JSON matching this schema. No markdown fences, no prose, ' +
		`no leading/trailing text:\n${JSON.stringify(jsonSchema, null, 2)}`
	);
}
