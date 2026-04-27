<script lang="ts">
	import { goto } from '$app/navigation';
	import { battle } from '$lib/client/battle-store.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { Monster } from '$lib/shared/types';

	let p1Prompt = $state('');
	let p2Prompt = $state('');
	let summoning = $state(false);
	let error = $state<string | null>(null);

	async function summonOne(prompt: string): Promise<Monster> {
		const res = await fetch('/api/summon', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ prompt })
		});
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { message?: string };
			throw new Error(body.message ?? `summon failed (${res.status})`);
		}
		const data = (await res.json()) as { monster: Monster };
		return data.monster;
	}

	async function startBattle(event: SubmitEvent) {
		event.preventDefault();
		summoning = true;
		error = null;
		try {
			const [p1, p2] = await Promise.all([summonOne(p1Prompt), summonOne(p2Prompt)]);
			battle.init(p1, p2);
			await goto('/battle');
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			summoning = false;
		}
	}
</script>

<main>
	<header>
		<h1>⚔️ VibeMonsters ⚔️</h1>
		<p class="tag">Describe two monsters. They will fight.</p>
	</header>

	<form onsubmit={startBattle}>
		<label>
			<span>Player 1</span>
			<input
				type="text"
				bind:value={p1Prompt}
				placeholder="a grumpy storm cloud that throws lightning"
				disabled={summoning}
				required
				maxlength="500"
			/>
		</label>

		<label>
			<span>Player 2</span>
			<input
				type="text"
				bind:value={p2Prompt}
				placeholder="a cactus that knows karate"
				disabled={summoning}
				required
				maxlength="500"
			/>
		</label>

		<button type="submit" disabled={summoning}>
			{#if summoning}
				<Spinner label="Summoning…" />
			{:else}
				Battle!
			{/if}
		</button>
	</form>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	{#if summoning}
		<p class="hint">Sprites take 5–15s. Stay vibing.</p>
	{/if}
</main>

<style>
	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 2rem 1.25rem;
		color: #f4f4f8;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: clamp(1.75rem, 6vw, 2.5rem);
		margin: 0 0 0.5rem 0;
		letter-spacing: 0.02em;
	}

	.tag {
		opacity: 0.7;
		margin: 0;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	label span {
		font-size: 0.85rem;
		opacity: 0.75;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	input {
		font: inherit;
		padding: 0.75rem 0.9rem;
		border-radius: 8px;
		border: 2px solid #2a2a35;
		background: #15151c;
		color: inherit;
	}

	input:focus {
		outline: none;
		border-color: #7c5cff;
	}

	button {
		font: inherit;
		font-weight: 600;
		padding: 0.9rem 1rem;
		border-radius: 8px;
		border: none;
		background: linear-gradient(135deg, #7c5cff, #ff5cae);
		color: white;
		cursor: pointer;
		margin-top: 0.5rem;
	}

	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.error {
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		background: #401e1e;
		color: #ffb4b4;
		font-size: 0.9rem;
	}

	.hint {
		margin-top: 1rem;
		opacity: 0.6;
		font-style: italic;
		text-align: center;
	}
</style>
