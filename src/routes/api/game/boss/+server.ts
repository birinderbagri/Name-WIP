import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { parseBody, RequestValidationError } from '$lib/server/validation';
import { grantCosmeticBySlug } from '$lib/server/cosmetics';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const bossResultSchema = z.object({
	courseId: z.string().uuid(),
	correct: z.number().int().min(0),
	total: z.number().int().min(1)
});

const BOSS_PASS_RATIO = 0.7;

/**
 * POST /api/game/boss — record a boss trial result. The pass threshold is
 * enforced server-side; a win marks the course completed.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;

	let body;
	try {
		body = await parseBody(request, bossResultSchema);
	} catch (err) {
		if (err instanceof RequestValidationError) return json({ error: err.message }, { status: 400 });
		throw err;
	}

	const { data: course } = await locals.supabase
		.from('courses')
		.select('id')
		.eq('id', body.courseId)
		.eq('user_id', userId)
		.single();
	if (!course) return json({ error: 'Course not found.' }, { status: 404 });

	const won = body.correct >= Math.ceil(body.total * BOSS_PASS_RATIO);
	const masteryPercent = Math.round((body.correct / body.total) * 10000) / 100;

	if (won) {
		const { error } = await supabaseAdmin.from('course_progress').upsert(
			{
				user_id: userId,
				course_id: body.courseId,
				boss_defeated: true,
				completed_at: new Date().toISOString(),
				mastery_percent: masteryPercent
			},
			{ onConflict: 'user_id,course_id' }
		);
		if (error) return json({ error: 'Could not record the victory.' }, { status: 500 });

		// Restoring a region earns a cosmetic (decorative only).
		const cosmeticGranted = await grantCosmeticBySlug(userId, 'petal-cloak');
		return json({ won, cosmeticGranted });
	}

	return json({ won, cosmeticGranted: false });
};
