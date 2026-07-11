/**
 * 12x12 region map generation. Deterministic from a seed so the same course
 * always produces the same island layout across sessions and devices.
 */

export const MAP_SIZE = 12;

export enum Tile {
	Grass = 0,
	Flowers = 1,
	Path = 2,
	Water = 3,
	Hedge = 4, // blocked
	StudyNode = 5,
	BossNode = 6,
	ReviewNode = 7 // shadow-concept review zone
}

export interface StudyNodePlacement {
	id: string; // "node-x-y"
	x: number;
	y: number;
	kind: 'study' | 'boss' | 'review';
	/** Indexes into the course's question list served to this node. */
	questionIds: string[];
}

export interface RegionMap {
	tiles: Tile[][];
	nodes: StudyNodePlacement[];
	spawn: { x: number; y: number };
}

/** Mulberry32 — tiny deterministic PRNG. */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function isWalkable(tile: Tile): boolean {
	return tile !== Tile.Water && tile !== Tile.Hedge;
}

/**
 * Build the island: water border, hedge clusters, flower speckle, a path
 * spine, study nodes spread across walkable tiles, boss in the far corner,
 * and one review zone when shadow concepts exist.
 */
export function generateRegionMap(params: {
	seed: number;
	questionIds: string[];
	bossQuestionIds: string[];
	reviewQuestionIds: string[];
}): RegionMap {
	const { seed, questionIds, bossQuestionIds, reviewQuestionIds } = params;
	const rand = mulberry32(seed || 1);
	const tiles: Tile[][] = [];

	for (let y = 0; y < MAP_SIZE; y++) {
		const row: Tile[] = [];
		for (let x = 0; x < MAP_SIZE; x++) {
			const isBorder = x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1;
			if (isBorder) {
				row.push(Tile.Water);
			} else {
				const r = rand();
				if (r < 0.08) row.push(Tile.Hedge);
				else if (r < 0.25) row.push(Tile.Flowers);
				else row.push(Tile.Grass);
			}
		}
		tiles.push(row);
	}

	// Path spine from spawn toward the boss corner keeps the island readable.
	const spawn = { x: 2, y: MAP_SIZE - 3 };
	tiles[spawn.y][spawn.x] = Tile.Path;
	for (let x = 2; x < MAP_SIZE - 2; x++) tiles[MAP_SIZE - 3][x] = Tile.Path;
	for (let y = 2; y <= MAP_SIZE - 3; y++) tiles[y][MAP_SIZE - 3] = Tile.Path;

	const nodes: StudyNodePlacement[] = [];
	const taken = new Set<string>([`${spawn.x},${spawn.y}`]);

	const placeNode = (kind: StudyNodePlacement['kind'], ids: string[]): boolean => {
		for (let attempts = 0; attempts < 200; attempts++) {
			const x = 1 + Math.floor(rand() * (MAP_SIZE - 2));
			const y = 1 + Math.floor(rand() * (MAP_SIZE - 2));
			const key = `${x},${y}`;
			if (taken.has(key) || !isWalkable(tiles[y][x])) continue;
			taken.add(key);
			tiles[y][x] =
				kind === 'boss' ? Tile.BossNode : kind === 'review' ? Tile.ReviewNode : Tile.StudyNode;
			nodes.push({ id: `node-${x}-${y}`, x, y, kind, questionIds: ids });
			return true;
		}
		return false;
	};

	// Spread questions across up to 6 study nodes, 2-4 questions each.
	const studyNodeCount = Math.max(1, Math.min(6, Math.ceil(questionIds.length / 3)));
	for (let i = 0; i < studyNodeCount; i++) {
		const slice = questionIds.filter((_, idx) => idx % studyNodeCount === i);
		if (slice.length > 0) placeNode('study', slice);
	}

	// Boss lives in the far corner region; fixed position for drama.
	const bossPos = { x: MAP_SIZE - 3, y: 2 };
	tiles[bossPos.y][bossPos.x] = Tile.BossNode;
	nodes.push({
		id: `node-${bossPos.x}-${bossPos.y}`,
		x: bossPos.x,
		y: bossPos.y,
		kind: 'boss',
		questionIds: bossQuestionIds
	});
	taken.add(`${bossPos.x},${bossPos.y}`);

	if (reviewQuestionIds.length > 0) {
		placeNode('review', reviewQuestionIds);
	}

	return { tiles, nodes, spawn };
}
