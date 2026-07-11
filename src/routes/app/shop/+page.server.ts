import { getFlags } from '$lib/server/flags';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;

	const [{ data: sections }, { data: items }, { data: owned }, flags] = await Promise.all([
		locals.supabase
			.from('cosmetic_shop_sections')
			.select('id, slug, name, category, sort_order, is_coming_soon')
			.order('sort_order'),
		locals.supabase
			.from('cosmetic_items')
			.select('id, section_id, name, description, sprite_key, earnable_from, is_available'),
		locals.supabase
			.from('user_cosmetics')
			.select('cosmetic_item_id, equipped, acquired_via')
			.eq('user_id', userId),
		getFlags()
	]);

	const ownedMap = Object.fromEntries(
		(owned ?? []).map((o) => [o.cosmetic_item_id, { equipped: o.equipped, via: o.acquired_via }])
	);

	return {
		sections: sections ?? [],
		items: items ?? [],
		ownedMap,
		purchasesEnabled: flags.get('cosmetics_shop_purchases')?.enabled ?? false
	};
};
