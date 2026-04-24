import { z } from 'zod';
import { env as privateEnv } from '$env/dynamic/private';

const EnvSchema = z.object({
	ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
	GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required')
});

const parsed = EnvSchema.safeParse(privateEnv);

if (!parsed.success) {
	const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
	throw new Error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in.`);
}

export const env = parsed.data;
