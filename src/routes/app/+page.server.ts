import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;

	const [{ data: courses }, { data: activeCreature }, { data: progress }] = await Promise.all([
		locals.supabase
			.from('courses')
			.select('id, title, subject, region_name, created_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('user_creatures')
			.select('level, mastery_xp, creatures(name, sprite_key, description)')
			.eq('user_id', userId)
			.eq('is_active', true)
			.maybeSingle(),
		locals.supabase
			.from('course_progress')
			.select('course_id, nodes_cleared, boss_defeated, mastery_percent')
			.eq('user_id', userId)
	]);

	return {
		courses: courses ?? [],
		activeCreature,
		progressByCourse: Object.fromEntries((progress ?? []).map((p) => [p.course_id, p]))
	};
};
