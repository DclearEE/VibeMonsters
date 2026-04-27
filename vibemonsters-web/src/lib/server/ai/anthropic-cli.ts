import { spawn } from 'node:child_process';
import { z } from 'zod';
import type { AnthropicClient } from './anthropic.ts';
import { buildStructuredPrompt, stripFences } from './anthropic.ts';

const ClaudeCliEnvelopeSchema = z.object({ result: z.string() });

function runClaude(prompt: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn('claude', ['-p', prompt, '--output-format', 'json'], { stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		proc.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString('utf8');
		});
		proc.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString('utf8');
		});
		proc.on('error', reject);
		proc.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`claude CLI exited ${code}: ${stderr.trim()}`));
				return;
			}
			resolve(stdout);
		});
	});
}

export const anthropicCli: AnthropicClient = {
	async generateStructured<T>(
		prompt: string,
		schema: z.ZodType<T>,
		opts?: { retries?: number }
	): Promise<T> {
		const retries = opts?.retries ?? 1;
		const jsonSchema = z.toJSONSchema(schema);
		const base = buildStructuredPrompt(prompt, jsonSchema);
		let current = base;
		let lastError: unknown;

		for (let attempt = 0; attempt <= retries; attempt++) {
			const raw = await runClaude(current);
			const envelope = ClaudeCliEnvelopeSchema.parse(JSON.parse(raw));
			const content = stripFences(envelope.result);
			const parsed = schema.safeParse(JSON.parse(content));
			if (parsed.success) return parsed.data;
			lastError = parsed.error;
			current =
				`${base}\n\nYour previous response failed validation:\n${parsed.error.message}\n` +
				`Previous response was:\n${content}\n\nTry again.`;
		}

		throw new Error(`anthropic-cli generateStructured failed: ${String(lastError)}`);
	}
};
