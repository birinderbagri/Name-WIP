import { supabaseAdmin } from '$lib/server/supabase-admin';

/**
 * Grant a gameplay-earned cosmetic if the user doesn't already own it.
 * Cosmetics are decorative only — this never touches XP, stats, or study
 * content. Idempotent.
 */
export async function grantCosmeticBySlug(userId: string, slug: string): Promise<boolean> {
	const { data: item } = await supabaseAdmin
		.from('cosmetic_items')
		.select('id, is_available, earnable_from')
		.eq('slug', slug)
		.maybeSingle();
	if (!item || !item.is_available || item.earnable_from !== 'gameplay') return false;

	const { data: owned } = await supabaseAdmin
		.from('user_cosmetics')
		.select('cosmetic_item_id')
		.eq('user_id', userId)
		.eq('cosmetic_item_id', item.id)
		.maybeSingle();
	if (owned) return false;

	const { error } = await supabaseAdmin.from('user_cosmetics').insert({
		user_id: userId,
		cosmetic_item_id: item.id,
		acquired_via: 'gameplay'
	});
	return !error;
}
