import { env } from '../env.ts';
import type { AnthropicClient } from './anthropic.ts';
import { anthropicCli } from './anthropic-cli.ts';
import { anthropicSdk } from './anthropic-sdk.ts';

export const anthropic: AnthropicClient = env.AI_PROVIDER === 'sdk' ? anthropicSdk : anthropicCli;
