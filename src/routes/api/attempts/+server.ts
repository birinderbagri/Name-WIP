import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { applyAttempt } from '$lib/server/gamification';
import { attemptSchema, parseBody, RequestValidationError } from '$lib/server/validation';
import type { RequestHandler } from './$types';

/**
 * POST /api/attempts — record an answer and apply XP/coins/streak/creature
 * mastery. The server re-checks ownership; the client's correctness claim is
 * accepted for MVP simplicity but XP amounts are computed entirely here.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;

	let body;
	try {
		body = await parseBody(request, attemptSchema);
	} catch (err) {
		if (err instanceof RequestValidationError) return json({ error: err.message }, { status: 400 });
		throw err;
	}

	// The question must belong to this user and course.
	const { data: question } = await supabaseAdmin
		.from('quiz_questions')
		.select('id, study_sets(course_id)')
		.eq('id', body.questionId)
		.eq('user_id', userId)
		.single();
	const questionCourse = (question?.study_sets as unknown as { course_id: string } | null)?.course_id;
	if (!question || questionCourse !== body.courseId) {
		return json({ error: 'Question not found for this course.' }, { status: 404 });
	}

	try {
		const outcome = await applyAttempt({
			userId,
			questionId: body.questionId,
			courseId: body.courseId,
			isCorrect: body.isCorrect,
			answerGiven: body.answerGiven,
			focusChain: body.focusChain,
			inBossBattle: body.inBossBattle
		});
		return json(outcome);
	} catch (err) {
		return json({ error: (err as Error).message }, { status: 500 });
	}
};
