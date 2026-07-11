import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { gameSaveSchema, parseBody, RequestValidationError } from '$lib/server/validation';
import type { RequestHandler } from './$types';

/** POST /api/game/save — persist player position and cleared nodes. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;

	let body;
	try {
		body = await parseBody(request, gameSaveSchema);
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

	const { error } = await supabaseAdmin.from('game_saves').upsert(
		{
			user_id: userId,
			course_id: body.courseId,
			player_x: body.playerX,
			player_y: body.playerY,
			cleared_nodes_json: body.clearedNodes
		},
		{ onConflict: 'user_id,course_id' }
	);
	if (error) return json({ error: 'Could not save progress.' }, { status: 500 });

	// Keep course_progress in sync with node clears.
	await supabaseAdmin.from('course_progress').upsert(
		{
			user_id: userId,
			course_id: body.courseId,
			nodes_cleared: body.clearedNodes.length
		},
		{ onConflict: 'user_id,course_id' }
	);

	return json({ ok: true });
};
