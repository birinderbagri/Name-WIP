import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { getFlags } from '$lib/server/flags';
import type { RequestHandler } from './$types';

const MAX_REWARDED_PER_DAY = 5;

/**
 * POST /api/ads/reward — grant the rewarded-ad payout server-side.
 *
 * Hard product rules enforced here:
 * - Rewarded ads grant COINS ONLY (cosmetic/decoration currency).
 * - They can never grant study content, answers, XP, mastery, or any
 *   academic advantage — there is deliberately no code path for that.
 * - Capped per day so ads stay optional flavor, not a grind loop.
 */
export const POST: RequestHandler = async ({ locals }) => {
	const userId = locals.user!.id;

	const flags = await getFlags();
	const rewardedFlag = flags.get('ads_rewarded');
	if (!rewardedFlag?.enabled) {
		return json({ error: 'Rewarded ads are not enabled.' }, { status: 403 });
	}
	const coinsPerView =
		(rewardedFlag.value_json as { coins_per_view?: number } | null)?.coins_per_view ?? 15;

	// Daily cap based on the audit log.
	const startOfDay = new Date();
	startOfDay.setUTCHours(0, 0, 0, 0);
	const { count } = await supabaseAdmin
		.from('ad_events')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', userId)
		.eq('placement', 'rewarded')
		.eq('event_type', 'reward_granted')
		.gte('created_at', startOfDay.toISOString());
	if ((count ?? 0) >= MAX_REWARDED_PER_DAY) {
		return json({ error: 'Daily rewarded-ad limit reached.' }, { status: 429 });
	}

	const { data: profile } = await supabaseAdmin
		.from('profiles')
		.select('coins')
		.eq('id', userId)
		.single();
	if (!profile) return json({ error: 'Profile not found.' }, { status: 404 });

	await supabaseAdmin
		.from('profiles')
		.update({ coins: profile.coins + coinsPerView })
		.eq('id', userId);

	await supabaseAdmin.from('ad_events').insert({
		user_id: userId,
		placement: 'rewarded',
		event_type: 'reward_granted',
		reward_json: { coins: coinsPerView },
		context: 'rewarded_flow'
	});

	return json({ coins: coinsPerView });
};
