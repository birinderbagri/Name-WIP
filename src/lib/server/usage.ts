import { supabaseAdmin } from '$lib/server/supabase-admin';

// Daily quotas — generous for MVP, tightened later via ops, not code.
export const DAILY_LIMITS = {
	uploads: 20,
	extractions: 30,
	generations: 20
} as const;

type UsageKind = 'uploads' | 'extractions' | 'generations';

const COLUMN: Record<UsageKind, 'uploads_count' | 'extraction_count' | 'generation_count'> = {
	uploads: 'uploads_count',
	extractions: 'extraction_count',
	generations: 'generation_count'
};

export class UsageLimitError extends Error {}

/**
 * Check-and-increment a user's daily usage counter. Throws UsageLimitError
 * (mapped to HTTP 429 by routes) when the quota is exhausted.
 */
export async function consumeUsage(userId: string, kind: UsageKind): Promise<void> {
	const today = new Date().toISOString().slice(0, 10);
	const column = COLUMN[kind];

	const { data: row } = await supabaseAdmin
		.from('usage_limits')
		.select(`id, ${column}`)
		.eq('user_id', userId)
		.eq('usage_date', today)
		.maybeSingle<{ id: string } & Record<typeof column, number>>();

	const current = row?.[column] ?? 0;
	if (current >= DAILY_LIMITS[kind]) {
		throw new UsageLimitError(
			`Daily ${kind} limit reached (${DAILY_LIMITS[kind]}). It resets tomorrow.`
		);
	}

	if (row) {
		await supabaseAdmin
			.from('usage_limits')
			.update({ [column]: current + 1 })
			.eq('id', row.id);
	} else {
		await supabaseAdmin
			.from('usage_limits')
			.insert({ user_id: userId, usage_date: today, [column]: 1 });
	}
}
