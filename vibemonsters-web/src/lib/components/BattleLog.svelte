<script lang="ts">
	import type { TurnResult } from '$lib/shared/types';

	interface Props {
		entries: TurnResult[];
		emptyMessage?: string;
	}
	let { entries, emptyMessage = 'Battle begins…' }: Props = $props();

	let scrollEl = $state<HTMLDivElement | undefined>();

	$effect(() => {
		if (scrollEl && entries.length > 0) {
			scrollEl.scrollTop = scrollEl.scrollHeight;
		}
	});
</script>

<div class="log" bind:this={scrollEl}>
	{#if entries.length === 0}
		<p class="dim">{emptyMessage}</p>
	{:else}
		{#each entries as entry, i (i)}
			<p>{entry.narration}</p>
		{/each}
	{/if}
</div>

<style>
	.log {
		max-height: 14rem;
		overflow-y: auto;
		padding: 0.75rem 1rem;
		background: #0e0e14;
		border: 1px solid #2a2a35;
		border-radius: 8px;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	p {
		margin: 0 0 0.55rem 0;
	}

	p:last-child {
		margin-bottom: 0;
	}

	.dim {
		opacity: 0.5;
		font-style: italic;
	}
</style>
