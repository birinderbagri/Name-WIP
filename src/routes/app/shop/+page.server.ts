import { getFlags } from '$lib/server/flags';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const [{ data: sections }, { data: items }, flags] = await Promise.all([
		locals.supabase
			.from('cosmetic_shop_sections')
			.select('id, slug, name, category, sort_order, is_coming_soon')
			.order('sort_order'),
		locals.supabase
			.from('cosmetic_items')
			.select('id, section_id, name, description, sprite_key, earnable_from, is_available'),
		getFlags()
	]);

	return {
		sections: sections ?? [],
		items: items ?? [],
		purchasesEnabled: flags.get('cosmetics_shop_purchases')?.enabled ?? false
	};
};
