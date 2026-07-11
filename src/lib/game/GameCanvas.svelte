<script lang="ts">
	import { Tile, isWalkable, MAP_SIZE, type RegionMap, type StudyNodePlacement } from './map';
	import {
		TILE_SIZE,
		drawSprite,
		rangerDown,
		rangerUp,
		rangerLeft,
		rangerRight,
		type PixelSprite
	} from './sprites';

	interface Props {
		map: RegionMap;
		clearedNodes: string[];
		bossUnlocked: boolean;
		startX: number;
		startY: number;
		/** Fired when the player steps onto an uncleared node. */
		onNodeEnter: (node: StudyNodePlacement) => void;
		onMove?: (x: number, y: number) => void;
		/** Battle open = ignore movement input. */
		inputLocked?: boolean;
	}

	let {
		map,
		clearedNodes,
		bossUnlocked,
		startX,
		startY,
		onNodeEnter,
		onMove,
		inputLocked = false
	}: Props = $props();

	const SCALE = 3;
	const CANVAS_PX = MAP_SIZE * TILE_SIZE * SCALE;

	let canvas: HTMLCanvasElement | undefined = $state();
	let playerX = $state(startX);
	let playerY = $state(startY);
	let facing: PixelSprite = $state(rangerDown);
	let bossLockedFlash = $state(0);

	const TERRAIN_COLORS: Record<number, string> = {
		[Tile.Grass]: '#8fbf68',
		[Tile.Flowers]: '#8fbf68',
		[Tile.Path]: '#e3c99a',
		[Tile.Water]: '#7db7d9',
		[Tile.Hedge]: '#4e7a3a',
		[Tile.StudyNode]: '#8fbf68',
		[Tile.BossNode]: '#8fbf68',
		[Tile.ReviewNode]: '#8fbf68'
	};

	function tileRand(x: number, y: number, salt: number): number {
		// Deterministic per-tile decoration jitter.
		const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
		return n - Math.floor(n);
	}

	function px(ctx: CanvasRenderingContext2D, tx: number, ty: number, col: number, row: number, w: number, h: number, color: string) {
		ctx.fillStyle = color;
		ctx.fillRect(
			(tx * TILE_SIZE + col) * SCALE,
			(ty * TILE_SIZE + row) * SCALE,
			w * SCALE,
			h * SCALE
		);
	}

	function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number) {
		px(ctx, x, y, 0, 0, TILE_SIZE, TILE_SIZE, TERRAIN_COLORS[tile]);

		if (tile === Tile.Grass || tile === Tile.Flowers || tile === Tile.StudyNode || tile === Tile.BossNode || tile === Tile.ReviewNode) {
			// grass speckle
			for (let i = 0; i < 4; i++) {
				const gx = Math.floor(tileRand(x, y, i) * 14) + 1;
				const gy = Math.floor(tileRand(x, y, i + 10) * 14) + 1;
				px(ctx, x, y, gx, gy, 1, 2, '#79b04f');
			}
		}
		if (tile === Tile.Flowers) {
			for (let i = 0; i < 3; i++) {
				const fx = Math.floor(tileRand(x, y, i + 20) * 12) + 2;
				const fy = Math.floor(tileRand(x, y, i + 30) * 12) + 2;
				px(ctx, x, y, fx, fy, 2, 2, i % 2 === 0 ? '#e9a6c0' : '#f7ecdf');
				px(ctx, x, y, fx, fy, 1, 1, '#d9a441');
			}
		}
		if (tile === Tile.Water) {
			for (let i = 0; i < 3; i++) {
				const wx = Math.floor(tileRand(x, y, i + 40) * 10) + 2;
				const wy = Math.floor(tileRand(x, y, i + 50) * 12) + 2;
				px(ctx, x, y, wx, wy, 4, 1, '#a8d2ea');
			}
		}
		if (tile === Tile.Hedge) {
			px(ctx, x, y, 1, 1, 14, 14, '#4e7a3a');
			for (let i = 0; i < 5; i++) {
				const hx = Math.floor(tileRand(x, y, i + 60) * 12) + 1;
				const hy = Math.floor(tileRand(x, y, i + 70) * 12) + 1;
				px(ctx, x, y, hx, hy, 3, 2, '#35502a');
			}
			px(ctx, x, y, 3, 2, 2, 2, '#e9a6c0');
			px(ctx, x, y, 10, 8, 2, 2, '#e9a6c0');
		}
		if (tile === Tile.Path) {
			for (let i = 0; i < 4; i++) {
				const sx = Math.floor(tileRand(x, y, i + 80) * 12) + 1;
				const sy = Math.floor(tileRand(x, y, i + 90) * 12) + 1;
				px(ctx, x, y, sx, sy, 2, 1, '#cfae7c');
			}
		}
	}

	function drawNodeMarker(ctx: CanvasRenderingContext2D, node: StudyNodePlacement) {
		const cleared = clearedNodes.includes(node.id);
		const { x, y } = node;
		if (node.kind === 'boss') {
			// Boss gate: stone arch with a banner; grey when locked.
			const stone = bossUnlocked ? '#8a7f96' : '#9a948f';
			px(ctx, x, y, 2, 4, 3, 10, stone);
			px(ctx, x, y, 11, 4, 3, 10, stone);
			px(ctx, x, y, 2, 2, 12, 3, stone);
			px(ctx, x, y, 6, 5, 4, 6, bossUnlocked ? (cleared ? '#79b04f' : '#c96d92') : '#6b5a52');
			if (!bossUnlocked) px(ctx, x, y, 7, 7, 2, 3, '#3a2e2a'); // padlock
			if (cleared) px(ctx, x, y, 6, 1, 4, 2, '#d9a441'); // crown when defeated
		} else if (node.kind === 'review') {
			// Shadow concept wisp
			px(ctx, x, y, 5, 5, 6, 6, cleared ? '#a8bfd9' : '#5d5470');
			px(ctx, x, y, 6, 4, 4, 1, cleared ? '#a8bfd9' : '#5d5470');
			px(ctx, x, y, 6, 7, 1, 1, '#f7ecdf');
			px(ctx, x, y, 9, 7, 1, 1, '#f7ecdf');
		} else {
			// Study sparkle: glowing tome on a stump
			px(ctx, x, y, 4, 9, 8, 4, '#b0653f');
			px(ctx, x, y, 5, 5, 6, 4, cleared ? '#bcd9ae' : '#f7ecdf');
			px(ctx, x, y, 7, 5, 1, 4, '#c96d92');
			if (!cleared) {
				px(ctx, x, y, 3, 3, 1, 1, '#d9a441');
				px(ctx, x, y, 12, 6, 1, 1, '#d9a441');
				px(ctx, x, y, 11, 2, 1, 1, '#e9a6c0');
			}
		}
	}

	function render() {
		const ctx = canvas?.getContext('2d');
		if (!ctx) return;
		ctx.imageSmoothingEnabled = false;
		for (let y = 0; y < MAP_SIZE; y++) {
			for (let x = 0; x < MAP_SIZE; x++) {
				drawTile(ctx, map.tiles[y][x], x, y);
			}
		}
		for (const node of map.nodes) drawNodeMarker(ctx, node);
		drawSprite(ctx, facing, playerX * TILE_SIZE * SCALE, playerY * TILE_SIZE * SCALE, SCALE);

		if (bossLockedFlash > 0) {
			ctx.fillStyle = 'rgba(58, 46, 42, 0.75)';
			ctx.fillRect(0, CANVAS_PX - 34, CANVAS_PX, 34);
			ctx.fillStyle = '#f7ecdf';
			ctx.font = `${7 * SCALE}px "Pixelify Sans", monospace`;
			ctx.fillText('The gate is sealed. Clear every study node first!', 12, CANVAS_PX - 12);
		}
	}

	function tryMove(dx: number, dy: number) {
		if (inputLocked) return;
		facing = dy > 0 ? rangerDown : dy < 0 ? rangerUp : dx < 0 ? rangerLeft : rangerRight;
		const nx = playerX + dx;
		const ny = playerY + dy;
		if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE) return;

		const tile = map.tiles[ny][nx];
		const node = map.nodes.find((n) => n.x === nx && n.y === ny);
		if (node?.kind === 'boss' && !bossUnlocked && !clearedNodes.includes(node.id)) {
			bossLockedFlash = 3;
			render();
			setTimeout(() => {
				bossLockedFlash = 0;
				render();
			}, 1600);
			return;
		}
		if (!isWalkable(tile) && !node) return;

		playerX = nx;
		playerY = ny;
		onMove?.(nx, ny);
		render();

		if (node && !clearedNodes.includes(node.id)) {
			onNodeEnter(node);
		}
	}

	function onKeydown(event: KeyboardEvent) {
		const keyMap: Record<string, [number, number]> = {
			ArrowUp: [0, -1],
			ArrowDown: [0, 1],
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			w: [0, -1],
			s: [0, 1],
			a: [-1, 0],
			d: [1, 0]
		};
		const move = keyMap[event.key];
		if (move) {
			event.preventDefault();
			tryMove(move[0], move[1]);
		}
	}

	$effect(() => {
		// re-render when cleared nodes or lock state change
		void clearedNodes;
		void bossUnlocked;
		render();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="game-wrap">
	<canvas
		bind:this={canvas}
		class="pixel"
		width={CANVAS_PX}
		height={CANVAS_PX}
		aria-label="Region map. Use arrow keys or the on-screen buttons to move."
	></canvas>

	<div class="dpad" aria-hidden="false">
		<button class="dpad-btn up" onclick={() => tryMove(0, -1)} aria-label="Move up">▲</button>
		<button class="dpad-btn left" onclick={() => tryMove(-1, 0)} aria-label="Move left">◀</button>
		<button class="dpad-btn right" onclick={() => tryMove(1, 0)} aria-label="Move right">▶</button>
		<button class="dpad-btn down" onclick={() => tryMove(0, 1)} aria-label="Move down">▼</button>
	</div>
</div>

<style>
	.game-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	canvas {
		width: min(100%, 576px);
		height: auto;
		border: 4px solid var(--ink);
		border-radius: 4px;
		box-shadow: var(--shadow-chunk);
		background: #7db7d9;
	}

	.dpad {
		display: grid;
		grid-template-columns: repeat(3, 56px);
		grid-template-rows: repeat(2, 48px);
		gap: 4px;
	}

	.dpad-btn {
		font-family: var(--font-pixel);
		font-size: 1.1rem;
		background: var(--cream-deep);
		border: 3px solid var(--ink);
		border-radius: 4px;
		cursor: pointer;
		touch-action: manipulation;
	}

	.dpad-btn:active {
		background: var(--pink);
	}

	.up { grid-column: 2; grid-row: 1; }
	.left { grid-column: 1; grid-row: 2; }
	.down { grid-column: 2; grid-row: 2; }
	.right { grid-column: 3; grid-row: 2; }

	@media (min-width: 900px) {
		.dpad { display: none; }
	}
	@media (hover: none) {
		.dpad { display: grid; }
	}
</style>
