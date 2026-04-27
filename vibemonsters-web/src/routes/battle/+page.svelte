<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import BattleLog from '$lib/components/BattleLog.svelte';
	import type { FloaterKind } from '$lib/components/FloatingNumber.svelte';
	import MonsterPanel, { type Floater } from '$lib/components/MonsterPanel.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { battle } from '$lib/client/battle-store.svelte';
	import { BattleStateSchema, TurnResultSchema } from '$lib/shared/schemas';
	import type { Move, PlayerId, TurnResult } from '$lib/shared/types';
	import { z } from 'zod';

	const ResponseSchema = z.object({
		turnResult: TurnResultSchema,
		nextState: BattleStateSchema
	});

	onMount(() => {
		if (!battle.state) {
			void goto('/');
		}
	});

	let firstPlayer = $derived<PlayerId>(
		battle.state ? (battle.state.p1.stats.spd >= battle.state.p2.stats.spd ? 'p1' : 'p2') : 'p1'
	);
	let currentPlayer = $derived<PlayerId>(
		battle.state && battle.state.turn % 2 === 1
			? firstPlayer === 'p1'
				? 'p2'
				: 'p1'
			: firstPlayer
	);

	let activeMonster = $derived(
		battle.state ? (currentPlayer === 'p1' ? battle.state.p1 : battle.state.p2) : null
	);

	let rawInput = $state('');
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	let p1Floaters = $state<Floater[]>([]);
	let p2Floaters = $state<Floater[]>([]);
	let p1Hit = $state(false);
	let p2Hit = $state(false);
	let shake = $state(false);
	let nextFloaterId = 0;

	function spawnFloater(target: PlayerId, value: string, kind: FloaterKind) {
		const f: Floater = { id: nextFloaterId++, value, kind };
		if (target === 'p1') p1Floaters = [...p1Floaters, f];
		else p2Floaters = [...p2Floaters, f];
	}

	function removeFloater(target: PlayerId, id: number) {
		if (target === 'p1') p1Floaters = p1Floaters.filter((f) => f.id !== id);
		else p2Floaters = p2Floaters.filter((f) => f.id !== id);
	}

	function flashHit(target: PlayerId) {
		if (target === 'p1') {
			p1Hit = true;
			setTimeout(() => (p1Hit = false), 300);
		} else {
			p2Hit = true;
			setTimeout(() => (p2Hit = false), 300);
		}
	}

	function applyTurnResult(result: TurnResult) {
		if (result.damage > 0) {
			const kind: FloaterKind = result.crit ? 'crit' : 'damage';
			spawnFloater(result.defender, `-${result.damage}`, kind);
			flashHit(result.defender);
			if (result.crit) {
				shake = true;
				setTimeout(() => (shake = false), 300);
			}
		} else if (result.defended && result.kind !== 'defend') {
			spawnFloater(result.defender, '🛡️', 'block');
		} else if (result.kind !== 'heal' && result.kind !== 'defend' && result.kind !== 'buff') {
			spawnFloater(result.defender, 'MISS', 'miss');
		}
		if (result.healing > 0) {
			spawnFloater(result.attacker, `+${result.healing}`, 'heal');
		}
	}

	async function performAction(input: string) {
		if (!battle.state || battle.state.winner !== null || submitting) return;
		submitting = true;
		errorMessage = null;
		try {
			const action = { player: currentPlayer, rawInput: input, matchedMove: null };
			const res = await fetch('/api/battle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ state: battle.state, action })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.message ?? `turn failed (${res.status})`);
			}
			const parsed = ResponseSchema.parse(await res.json());
			applyTurnResult(parsed.turnResult);
			battle.state = parsed.nextState;
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : String(e);
		} finally {
			submitting = false;
			rawInput = '';
		}
	}

	function handleMove(move: Move) {
		void performAction(move.name);
	}

	function handleFreeform(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = rawInput.trim();
		if (trimmed.length > 0) void performAction(trimmed);
	}

	function newBattle() {
		battle.reset();
		void goto('/');
	}
</script>

{#if battle.state}
	{@const s = battle.state}
	<main class:shake>
		<div class="arena">
			<MonsterPanel
				monster={s.p1}
				currentHp={s.p1Hp}
				defending={s.p1Defending}
				active={currentPlayer === 'p1'}
				hit={p1Hit}
				effects={s.p1Effects}
				floaters={p1Floaters}
				onFloaterEnd={(id) => removeFloater('p1', id)}
			/>
			<div class="vs">VS</div>
			<MonsterPanel
				monster={s.p2}
				currentHp={s.p2Hp}
				defending={s.p2Defending}
				active={currentPlayer === 'p2'}
				hit={p2Hit}
				effects={s.p2Effects}
				floaters={p2Floaters}
				onFloaterEnd={(id) => removeFloater('p2', id)}
			/>
		</div>

		<BattleLog
			entries={s.log}
			emptyMessage="{s.p1.name} vs. {s.p2.name}. Fastest attacks first."
		/>

		{#if s.winner !== null}
			<div class="victory">
				🏆 <b>{s.winner === 'p1' ? s.p1.name : s.p2.name}</b> wins! 🏆
				<button onclick={newBattle}>Play again</button>
			</div>
		{:else if activeMonster}
			<div class="controls">
				<div class="turn-label">
					<span>{activeMonster.emoji} {activeMonster.name}'s turn</span>
					{#if submitting}<Spinner size={14} label="resolving…" />{/if}
				</div>
				{#if errorMessage}
					<div class="error">{errorMessage}</div>
				{/if}

				<div class="moves">
					{#each activeMonster.moves as move (move.name)}
						<button
							class="move"
							data-kind={move.kind}
							disabled={submitting}
							onclick={() => handleMove(move)}
							title={move.description}
						>
							<span class="move-name">{move.name}</span>
							<span class="move-meta">{move.kind}{move.power > 0 ? ` · ${move.power}` : ''}</span>
						</button>
					{/each}
				</div>

				<form class="freeform" onsubmit={handleFreeform}>
					<input
						type="text"
						placeholder="…or describe an action"
						bind:value={rawInput}
						disabled={submitting}
						maxlength="200"
					/>
					<button type="submit" disabled={submitting || rawInput.trim().length === 0}>Go</button>
				</form>
			</div>
		{/if}
	</main>
{/if}

<style>
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 1.25rem 1rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: #f4f4f8;
	}

	main.shake {
		animation: screen-shake 300ms ease-in-out;
	}

	@keyframes screen-shake {
		0%, 100% { transform: translate(0, 0); }
		25% { transform: translate(-4px, 2px); }
		50% { transform: translate(3px, -2px); }
		75% { transform: translate(-2px, 1px); }
	}

	.arena {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.75rem;
	}

	.vs {
		font-weight: 800;
		font-size: 1.2rem;
		opacity: 0.5;
		letter-spacing: 0.1em;
	}

	@media (max-width: 640px) {
		.arena {
			grid-template-columns: 1fr;
		}
		.vs {
			text-align: center;
		}
	}

	.victory {
		padding: 1rem 1.25rem;
		border-radius: 10px;
		background: linear-gradient(135deg, #ffd166, #ff5cae);
		color: #0f0f14;
		font-size: 1.1rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.victory b {
		font-size: 1.3rem;
	}

	.victory button {
		font: inherit;
		font-weight: 600;
		padding: 0.6rem 1.4rem;
		border-radius: 8px;
		border: none;
		background: #15151c;
		color: #f4f4f8;
		cursor: pointer;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.turn-label {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.error {
		padding: 0.55rem 0.85rem;
		border-radius: 8px;
		background: #3a1a1a;
		border: 1px solid #6b2a2a;
		color: #ffb4b4;
		font-size: 0.85rem;
	}

	.moves {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.move {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.7rem 0.85rem;
		border-radius: 8px;
		border: 1px solid #2a2a35;
		background: #15151c;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: transform 120ms ease-out, border-color 120ms ease-out;
	}

	.move:hover:not(:disabled) {
		transform: translateY(-1px);
		border-color: #7c5cff;
	}

	.move:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.move-name {
		font-weight: 600;
	}

	.move-meta {
		font-size: 0.72rem;
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.move[data-kind='physical'] { border-left: 4px solid #ff8a5c; }
	.move[data-kind='magical']  { border-left: 4px solid #7c5cff; }
	.move[data-kind='heal']     { border-left: 4px solid #4ade80; }
	.move[data-kind='defend']   { border-left: 4px solid #94a3b8; }
	.move[data-kind='buff']     { border-left: 4px solid #fde047; }

	.freeform {
		display: flex;
		gap: 0.5rem;
	}

	.freeform input {
		flex: 1;
		font: inherit;
		padding: 0.65rem 0.85rem;
		border-radius: 8px;
		border: 1px solid #2a2a35;
		background: #15151c;
		color: inherit;
	}

	.freeform input:focus {
		outline: none;
		border-color: #7c5cff;
	}

	.freeform button {
		font: inherit;
		font-weight: 600;
		padding: 0.65rem 1.1rem;
		border-radius: 8px;
		border: none;
		background: #7c5cff;
		color: white;
		cursor: pointer;
	}

	.freeform button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
