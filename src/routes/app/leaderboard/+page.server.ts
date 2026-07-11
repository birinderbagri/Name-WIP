import type { PageServerLoad } from './$types';

interface LeaderboardRow {
	user_id: string;
	display_name: string;
	xp: number;
	level: number;
	streak_days: number;
}

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;

	// Classes the user belongs to (RLS scopes this to their memberships).
	const { data: memberships } = await locals.supabase
		.from('class_members')
		.select('class_id, classes(id, name, join_code, owner_id)')
		.eq('user_id', userId);

	const classes = (memberships ?? [])
		.map((m) => m.classes as unknown as { id: string; name: string; join_code: string; owner_id: string } | null)
		.filter((c): c is { id: string; name: string; join_code: string; owner_id: string } => c !== null);

	// Leaderboard rows per class, ranked by XP (via the RLS-scoped view).
	const boards: Record<string, LeaderboardRow[]> = {};
	for (const cls of classes) {
		const { data: rows } = await locals.supabase
			.from('class_leaderboard')
			.select('user_id, display_name, xp, level, streak_days')
			.eq('class_id', cls.id)
			.order('xp', { ascending: false })
			.limit(100);
		boards[cls.id] = (rows ?? []) as LeaderboardRow[];
	}

	return { classes, boards, currentUserId: userId };
};
