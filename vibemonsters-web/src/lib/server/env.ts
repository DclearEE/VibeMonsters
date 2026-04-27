import { z } from 'zod';
import { env as privateEnv } from '$env/dynamic/private';

const EnvSchema = z
	.object({
		AI_PROVIDER: z.enum(['cli', 'sdk']).default('cli'),
		ANTHROPIC_API_KEY: z.string().optional(),
		GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required')
	})
	.refine((e) => e.AI_PROVIDER !== 'sdk' || (e.ANTHROPIC_API_KEY?.length ?? 0) > 0, {
		message: 'ANTHROPIC_API_KEY is required when AI_PROVIDER=sdk',
		path: ['ANTHROPIC_API_KEY']
	});

const parsed = EnvSchema.safeParse(privateEnv);

if (!parsed.success) {
	const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
	throw new Error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in.`);
}

export const env = parsed.data;
