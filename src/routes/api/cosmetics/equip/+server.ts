import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { parseBody, RequestValidationError } from '$lib/server/validation';
import type { RequestHandler } from './$types';

const equipSchema = z.object({
	cosmeticItemId: z.string().uuid(),
	equip: z.boolean()
});

/**
 * POST /api/cosmetics/equip — equip or unequip an owned cosmetic. Equipping
 * one item unequips any other in the same category (you wear one outfit at a
 * time). Cosmetic only; no gameplay effect.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;

	let body;
	try {
		body = await parseBody(request, equipSchema);
	} catch (err) {
		if (err instanceof RequestValidationError) return json({ error: err.message }, { status: 400 });
		throw err;
	}

	// Must own it.
	const { data: owned } = await supabaseAdmin
		.from('user_cosmetics')
		.select('cosmetic_item_id, cosmetic_items(category)')
		.eq('user_id', userId)
		.eq('cosmetic_item_id', body.cosmeticItemId)
		.maybeSingle();
	if (!owned) return json({ error: 'You do not own that cosmetic.' }, { status: 404 });

	if (!body.equip) {
		await supabaseAdmin
			.from('user_cosmetics')
			.update({ equipped: false })
			.eq('user_id', userId)
			.eq('cosmetic_item_id', body.cosmeticItemId);
		return json({ ok: true, equipped: false });
	}

	const category = (owned.cosmetic_items as unknown as { category: string } | null)?.category;

	// Unequip others in the same category, then equip this one.
	if (category) {
		const { data: sameCategory } = await supabaseAdmin
			.from('cosmetic_items')
			.select('id')
			.eq('category', category);
		const ids = (sameCategory ?? []).map((c) => c.id);
		if (ids.length) {
			await supabaseAdmin
				.from('user_cosmetics')
				.update({ equipped: false })
				.eq('user_id', userId)
				.in('cosmetic_item_id', ids);
		}
	}

	await supabaseAdmin
		.from('user_cosmetics')
		.update({ equipped: true })
		.eq('user_id', userId)
		.eq('cosmetic_item_id', body.cosmeticItemId);

	return json({ ok: true, equipped: true });
};
