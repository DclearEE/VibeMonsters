<script lang="ts">
	import type { Monster, StatusEffect } from '$lib/shared/types';
	import { fade } from 'svelte/transition';
	import FloatingNumber, { type FloaterKind } from './FloatingNumber.svelte';
	import HPBar from './HPBar.svelte';
	import StatusBadge from './StatusBadge.svelte';

	export interface Floater {
		id: number;
		value: string;
		kind: FloaterKind;
	}

	interface Props {
		monster: Monster;
		currentHp: number;
		hit?: boolean;
		defending?: boolean;
		active?: boolean;
		effects?: StatusEffect[];
		floaters?: Floater[];
		onFloaterEnd?: (id: number) => void;
	}
	let {
		monster,
		currentHp,
		hit = false,
		defending = false,
		active = false,
		effects = [],
		floaters = [],
		onFloaterEnd
	}: Props = $props();
</script>

<div
	class="panel"
	class:hit
	class:active
	style:--border={monster.borderColor}
>
	<div class="header">
		<span class="emoji">{monster.emoji}</span>
		<span class="name">{monster.name}</span>
		<span class="element">{monster.element}</span>
	</div>

	{#if effects.length > 0}
		<div class="badges">
			{#each effects as effect (effect)}
				<span out:fade={{ duration: 200 }}>
					<StatusBadge {effect} />
				</span>
			{/each}
		</div>
	{/if}

	<div class="sprite-wrap">
		<img class="sprite" src={monster.spriteUrl} alt={monster.name} />
		{#if defending}
			<span class="shield" title="Defending">🛡️</span>
		{/if}
		{#each floaters as f (f.id)}
			<FloatingNumber value={f.value} kind={f.kind} onend={() => onFloaterEnd?.(f.id)} />
		{/each}
	</div>

	<HPBar current={currentHp} max={monster.stats.hp} />

	<div class="stats">
		<span><b>ATK</b> {monster.stats.atk}</span>
		<span><b>DEF</b> {monster.stats.def}</span>
		<span><b>SPD</b> {monster.stats.spd}</span>
		<span><b>MAG</b> {monster.stats.mag}</span>
	</div>
</div>

<style>
	.panel {
		--border: #444;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.9rem;
		border-radius: 12px;
		border: 2px solid var(--border);
		background: #15151c;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.02), 0 12px 32px rgba(0, 0, 0, 0.35);
		transition: transform 200ms ease-out, box-shadow 200ms ease-out;
	}

	.panel.active {
		box-shadow: 0 0 0 2px var(--border), 0 12px 32px rgba(0, 0, 0, 0.45);
		transform: translateY(-2px);
	}

	.header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 1rem;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		min-height: 1.4rem;
	}

	.emoji {
		font-size: 1.4rem;
		line-height: 1;
	}

	.name {
		font-weight: 700;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.element {
		font-size: 0.75rem;
		opacity: 0.6;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.sprite-wrap {
		position: relative;
		aspect-ratio: 1 / 1;
		display: grid;
		place-items: center;
		background: radial-gradient(ellipse at center, color-mix(in srgb, var(--border) 18%, transparent), transparent 70%);
		border-radius: 8px;
		overflow: hidden;
	}

	.sprite {
		width: 80%;
		height: 80%;
		object-fit: contain;
		animation: bob 1s ease-in-out infinite;
	}

	.shield {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		font-size: 1.4rem;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.25rem;
		font-size: 0.78rem;
		opacity: 0.85;
	}

	.stats b {
		opacity: 0.6;
		font-weight: 600;
		margin-right: 0.25rem;
	}

	@keyframes bob {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-4px); }
	}

	.panel.hit {
		animation: shake 300ms ease-in-out;
	}

	.panel.hit .sprite {
		animation: bob 1s ease-in-out infinite, flash 120ms ease-out;
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		20% { transform: translateX(-6px); }
		40% { transform: translateX(6px); }
		60% { transform: translateX(-4px); }
		80% { transform: translateX(4px); }
	}

	@keyframes flash {
		0% { filter: brightness(2.5) sepia(1) saturate(8) hue-rotate(-50deg); }
		100% { filter: none; }
	}
</style>
