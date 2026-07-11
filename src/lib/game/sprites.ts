/**
 * Original pixel art, authored as ASCII grids ('.' = transparent).
 * Botanical-fantasy palette: pinks, creams, greens. All art here is
 * hand-authored for Loreleaf Academy and deliberately distinct from any
 * existing franchise.
 */

export const TILE_SIZE = 16;

export type Palette = Record<string, string>;

export interface PixelSprite {
	palette: Palette;
	rows: string[];
}

// --- Knowledge Ranger (player), one frame per facing ---
const rangerPalette: Palette = {
	h: '#4e7a3a', // hood
	H: '#79b04f', // hood highlight
	f: '#f3d8c0', // face
	e: '#3a2e2a', // eyes / outline
	c: '#e9a6c0', // cloak
	C: '#c96d92', // cloak shade
	b: '#b0653f', // satchel
	s: '#f7ecdf' // page peeking from satchel
};

export const rangerDown: PixelSprite = {
	palette: rangerPalette,
	rows: [
		'................',
		'.....hhhhhh.....',
		'....hHHHHHHh....',
		'...hHHhhhhHHh...',
		'...hHffffffHh...',
		'...hhfeffefhh...',
		'....hffffffh....',
		'.....ffffff.....',
		'....cccccccc....',
		'...cccccccccc...',
		'...ccCCCCCCcc...',
		'...ccCCCCCCcc...',
		'..bscCCCCCCcc...',
		'..bbcCCCCCCc....',
		'....CC....CC....',
		'....ee....ee....'
	]
};

export const rangerUp: PixelSprite = {
	palette: rangerPalette,
	rows: [
		'................',
		'.....hhhhhh.....',
		'....hHHHHHHh....',
		'...hHHHHHHHHh...',
		'...hHHHHHHHHh...',
		'...hhHHHHHHhh...',
		'....hHHHHHHh....',
		'.....hhhhhh.....',
		'....ccccccccc...',
		'...cccccccccc...',
		'...ccCCCCCCcc...',
		'...ccCCCCCCcc...',
		'...ccCCCCCCsb..',
		'....cCCCCCCbb..',
		'....CC....CC....',
		'....ee....ee....'
	]
};

export const rangerLeft: PixelSprite = {
	palette: rangerPalette,
	rows: [
		'................',
		'.....hhhhhh.....',
		'....hHHHHHHh....',
		'...hHHhhhhHh....',
		'...hHfffffHh....',
		'...hhfeff.hh....',
		'....hfffffh.....',
		'.....fffff......',
		'....ccccccc.....',
		'...ccccccccc....',
		'...ccCCCCCcc....',
		'..bsccCCCCcc....',
		'..bbccCCCCcc....',
		'....ccCCCCc.....',
		'....CC..CC......',
		'....ee..ee......'
	]
};

export const rangerRight: PixelSprite = {
	palette: rangerPalette,
	rows: rangerLeft.rows.map((row) => [...row].reverse().join(''))
};

// --- Sproutome: seedling notebook starter Memosprite ---
export const sproutome: PixelSprite = {
	palette: {
		g: '#79b04f', // sprout
		G: '#4e7a3a', // sprout shade
		p: '#e9a6c0', // blossom
		n: '#f7ecdf', // notebook pages
		N: '#efdcc3', // page shade
		o: '#3a2e2a', // outline/eyes
		r: '#b0653f' // notebook spine
	},
	rows: [
		'................',
		'......pg........',
		'.....pGgg.......',
		'......Gg........',
		'...ggGGg........',
		'....gGg.........',
		'.....Gg.........',
		'..oooooooooo....',
		'.onnnnnnnnnno...',
		'.rnnonnnnonnn...',
		'.rnnnnnnnnnnn...',
		'.rnnonnnnonnn...',
		'.rnnnoooonnnn...',
		'.rnNNNNNNNNNn...',
		'.onnnnnnnnnno...',
		'..oooooooooo....'
	]
};

// --- Bloomtome: evolved form ---
export const bloomtome: PixelSprite = {
	palette: { ...sproutome.palette, P: '#c96d92' },
	rows: [
		'.....p..p.......',
		'....pPppPp......',
		'.....pggp.......',
		'...ggGGgg.......',
		'..pgGGGgp.......',
		'....gGg.........',
		'.....Gg.........',
		'..oooooooooo....',
		'.onnnnnnnnnno...',
		'.rnnonnnnonnn...',
		'.rnnnnnnnnnnn...',
		'.rnnonnnnonnn...',
		'.rnnnoooonnnn...',
		'.rnNNNNNNNNNn...',
		'.onnnnnnnnnno...',
		'..oooooooooo....'
	]
};

export const CREATURE_SPRITES: Record<string, PixelSprite> = {
	sproutome,
	bloomtome,
	// Catalog creatures reuse the seedling silhouette recolored until each
	// gets bespoke art post-MVP.
	mossvial: { ...sproutome, palette: { ...sproutome.palette, n: '#d9ecd0', N: '#bcd9ae' } },
	sumgolem: { ...sproutome, palette: { ...sproutome.palette, n: '#e0dbe8', N: '#c8c0d6' } },
	scrollfox: { ...sproutome, palette: { ...sproutome.palette, n: '#f5e3c0', N: '#e6cd9a' } },
	inkmoth: { ...sproutome, palette: { ...sproutome.palette, n: '#d8dce8', N: '#bfc5d8' } }
};

/** Draw an ASCII pixel sprite onto a canvas context at whole-pixel scale. */
export function drawSprite(
	ctx: CanvasRenderingContext2D,
	sprite: PixelSprite,
	x: number,
	y: number,
	scale: number
): void {
	for (let row = 0; row < sprite.rows.length; row++) {
		const line = sprite.rows[row];
		for (let col = 0; col < line.length; col++) {
			const color = sprite.palette[line[col]];
			if (!color) continue;
			ctx.fillStyle = color;
			ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
		}
	}
}
