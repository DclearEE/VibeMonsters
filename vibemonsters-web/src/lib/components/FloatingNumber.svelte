<script lang="ts">
	export type FloaterKind = 'damage' | 'heal' | 'crit' | 'block' | 'miss';

	interface Props {
		value: string;
		kind: FloaterKind;
		onend: () => void;
	}
	let { value, kind, onend }: Props = $props();
</script>

<span class="floater" data-kind={kind} onanimationend={onend}>{value}</span>

<style>
	.floater {
		position: absolute;
		left: 50%;
		top: 30%;
		transform: translate(-50%, 0);
		font-weight: 800;
		font-size: 1.5rem;
		pointer-events: none;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
		animation: rise 800ms ease-out forwards;
		z-index: 10;
	}

	.floater[data-kind='damage'] {
		color: #ff5252;
	}
	.floater[data-kind='heal'] {
		color: #4ade80;
	}
	.floater[data-kind='crit'] {
		color: #fde047;
		font-size: 2rem;
	}
	.floater[data-kind='block'] {
		font-size: 1.8rem;
	}
	.floater[data-kind='miss'] {
		color: #888;
		font-style: italic;
		font-size: 1.1rem;
	}

	@keyframes rise {
		0% {
			transform: translate(-50%, 0);
			opacity: 1;
		}
		100% {
			transform: translate(-50%, -40px);
			opacity: 0;
		}
	}
</style>
