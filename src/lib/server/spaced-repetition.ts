import { supabaseAdmin } from '$lib/server/supabase-admin';

/**
 * SM-2-lite spaced repetition. Each answered question gets a schedule row
 * that moves its next-due date forward on success and resets it on a miss.
 * This is a study-quality feature — it never grants XP or gameplay advantage,
 * it only decides when a concept resurfaces.
 */

function addDays(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

interface ScheduleState {
	ease: number;
	interval_days: number;
	repetitions: number;
}

export function nextSchedule(prev: ScheduleState | null, isCorrect: boolean): ScheduleState & { due_on: string } {
	const ease = prev?.ease ?? 2.5;
	const repetitions = prev?.repetitions ?? 0;
	const interval = prev?.interval_days ?? 0;

	if (!isCorrect) {
		// Lapse: relearn tomorrow, ease nudged down (floor 1.3).
		return {
			ease: Math.max(1.3, ease - 0.2),
			interval_days: 1,
			repetitions: 0,
			due_on: addDays(1)
		};
	}

	const nextReps = repetitions + 1;
	let nextInterval: number;
	if (nextReps === 1) nextInterval = 1;
	else if (nextReps === 2) nextInterval = 6;
	else nextInterval = Math.round(interval * ease);

	return {
		ease: Math.min(3.0, ease + 0.1),
		interval_days: nextInterval,
		repetitions: nextReps,
		due_on: addDays(nextInterval)
	};
}

/** Upsert the schedule for a question after an attempt. */
export async function recordReview(params: {
	userId: string;
	questionId: string;
	courseId: string;
	isCorrect: boolean;
}): Promise<void> {
	const { userId, questionId, courseId, isCorrect } = params;

	const { data: prev } = await supabaseAdmin
		.from('review_schedule')
		.select('id, ease, interval_days, repetitions')
		.eq('user_id', userId)
		.eq('question_id', questionId)
		.maybeSingle();

	const next = nextSchedule(prev, isCorrect);

	await supabaseAdmin.from('review_schedule').upsert(
		{
			user_id: userId,
			question_id: questionId,
			course_id: courseId,
			ease: next.ease,
			interval_days: next.interval_days,
			repetitions: next.repetitions,
			due_on: next.due_on,
			last_reviewed_at: new Date().toISOString()
		},
		{ onConflict: 'user_id,question_id' }
	);
}

/** Question ids due for review today (or overdue) for a course. */
export async function dueQuestionIds(userId: string, courseId: string): Promise<string[]> {
	const today = new Date().toISOString().slice(0, 10);
	const { data } = await supabaseAdmin
		.from('review_schedule')
		.select('question_id')
		.eq('user_id', userId)
		.eq('course_id', courseId)
		.lte('due_on', today)
		.gt('repetitions', 0); // already learned once; now resurfacing
	return (data ?? []).map((r) => r.question_id);
}
