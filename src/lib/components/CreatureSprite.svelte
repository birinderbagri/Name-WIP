<script lang="ts">
	import { CREATURE_SPRITES, drawSprite, sproutome } from '$lib/game/sprites';

	interface Props {
		spriteKey: string;
		scale?: number;
	}

	let { spriteKey, scale = 4 }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	const size = $derived(16 * scale);

	$effect(() => {
		const ctx = canvas?.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, size, size);
		ctx.imageSmoothingEnabled = false;
		drawSprite(ctx, CREATURE_SPRITES[spriteKey] ?? sproutome, 0, 0, scale);
	});
</script>

<canvas bind:this={canvas} class="pixel" width={size} height={size} aria-label="Memosprite"></canvas>
