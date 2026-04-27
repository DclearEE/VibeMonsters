<script lang="ts">
	interface Props {
		current: number;
		max: number;
	}
	let { current, max }: Props = $props();

	let pct = $derived(max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0);
	let tier = $derived(pct > 60 ? 'high' : pct > 30 ? 'mid' : 'low');
</script>

<div class="hp" data-tier={tier}>
	<div class="bar" style:width="{pct}%"></div>
	<span class="label">{current} / {max}</span>
</div>

<style>
	.hp {
		position: relative;
		height: 18px;
		background: #1d1d26;
		border: 1px solid #2a2a35;
		border-radius: 4px;
		overflow: hidden;
	}

	.bar {
		height: 100%;
		transition: width 400ms ease-out, background-color 400ms ease-out;
	}

	.hp[data-tier='high'] .bar {
		background-color: #4ade80;
	}
	.hp[data-tier='mid'] .bar {
		background-color: #facc15;
	}
	.hp[data-tier='low'] .bar {
		background-color: #ef4444;
	}

	.label {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 11px;
		font-weight: 700;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
		letter-spacing: 0.04em;
	}
</style>
