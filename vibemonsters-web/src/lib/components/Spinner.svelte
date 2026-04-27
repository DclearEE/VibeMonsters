<script lang="ts">
	interface Props {
		size?: number;
		label?: string;
	}
	let { size = 18, label }: Props = $props();
</script>

<span class="wrap" role="status" aria-label={label ?? 'loading'}>
	<span class="ring" style:--size="{size}px"></span>
	{#if label}<span class="label">{label}</span>{/if}
</span>

<style>
	.wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ring {
		display: inline-block;
		width: var(--size);
		height: var(--size);
		border: 2px solid rgba(255, 255, 255, 0.18);
		border-top-color: #f4f4f8;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	.label {
		font-size: 0.85rem;
		opacity: 0.8;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
