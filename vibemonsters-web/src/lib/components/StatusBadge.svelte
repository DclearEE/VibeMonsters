<script lang="ts">
	import type { StatusEffect } from '$lib/shared/types';

	interface Props {
		effect: StatusEffect;
	}
	let { effect }: Props = $props();

	const ICONS: Record<StatusEffect, string> = {
		burn: '🔥',
		freeze: '❄️',
		poison: '🧪',
		confuse: '😵‍💫',
		haste: '⚡',
		regen: '✨',
		shield: '🛡️'
	};

	const LABELS: Record<StatusEffect, string> = {
		burn: 'Burn',
		freeze: 'Freeze',
		poison: 'Poison',
		confuse: 'Confuse',
		haste: 'Haste',
		regen: 'Regen',
		shield: 'Shield'
	};
</script>

<span class="badge" data-effect={effect} title={LABELS[effect]}>{ICONS[effect]}</span>

<style>
	.badge {
		display: inline-grid;
		place-items: center;
		min-width: 1.4rem;
		height: 1.4rem;
		padding: 0 0.35rem;
		border-radius: 999px;
		font-size: 0.85rem;
		line-height: 1;
		background: #1d1d26;
		border: 1px solid #2a2a35;
		animation: pulse 300ms ease-out;
	}

	@keyframes pulse {
		0% { transform: scale(1); }
		50% { transform: scale(1.3); }
		100% { transform: scale(1); }
	}
</style>
