import { error } from '@sveltejs/kit';
import { getFlags } from '$lib/server/flags';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('id, display_name, xp, level, coins, streak_days')
		.eq('id', locals.user!.id)
		.single();

	if (!profile) error(500, 'Profile missing — try signing out and back in.');

	const flags = await getFlags();

	return {
		profile,
		adFlags: {
			banner: flags.get('ads_banner')?.enabled ?? false,
			rewarded: flags.get('ads_rewarded')?.enabled ?? false,
			interstitial: flags.get('ads_interstitial')?.enabled ?? false
		}
	};
};
