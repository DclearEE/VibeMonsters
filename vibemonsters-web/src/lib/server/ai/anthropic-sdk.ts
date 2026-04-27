import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../env.ts';
import type { AnthropicClient } from './anthropic.ts';
import { buildStructuredPrompt, stripFences } from './anthropic.ts';

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 4096;

function makeClient(): Anthropic {
	if (!env.ANTHROPIC_API_KEY) {
		throw new Error('ANTHROPIC_API_KEY is required for the SDK adapter');
	}
	return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

export const anthropicSdk: AnthropicClient = {
	async generateStructured<T>(
		prompt: string,
		schema: z.ZodType<T>,
		opts?: { retries?: number }
	): Promise<T> {
		const retries = opts?.retries ?? 1;
		const client = makeClient();
		const jsonSchema = z.toJSONSchema(schema);
		const base = buildStructuredPrompt(prompt, jsonSchema);
		let current = base;
		let lastError: unknown;

		for (let attempt = 0; attempt <= retries; attempt++) {
			const response = await client.messages.create({
				model: MODEL,
				max_tokens: MAX_TOKENS,
				messages: [{ role: 'user', content: current }]
			});
			const text = response.content
				.filter((block): block is Anthropic.TextBlock => block.type === 'text')
				.map((block) => block.text)
				.join('');
			const content = stripFences(text);
			const parsed = schema.safeParse(JSON.parse(content));
			if (parsed.success) return parsed.data;
			lastError = parsed.error;
			current =
				`${base}\n\nYour previous response failed validation:\n${parsed.error.message}\n` +
				`Previous response was:\n${content}\n\nTry again.`;
		}

		throw new Error(`anthropic-sdk generateStructured failed: ${String(lastError)}`);
	}
};
