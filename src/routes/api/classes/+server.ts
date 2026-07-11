import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { parseBody, RequestValidationError } from '$lib/server/validation';
import type { RequestHandler } from './$types';

const createSchema = z.object({ action: z.literal('create'), name: z.string().min(1).max(80) });
const joinSchema = z.object({ action: z.literal('join'), joinCode: z.string().min(4).max(12) });
const bodySchema = z.discriminatedUnion('action', [createSchema, joinSchema]);

function makeJoinCode(): string {
	// Unambiguous uppercase code (no O/0/I/1).
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
	return code;
}

/**
 * POST /api/classes — create a class (owner auto-joins) or join one by code.
 * Leaderboards are opt-in and social only; membership never affects study
 * content or difficulty.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;

	let body;
	try {
		body = await parseBody(request, bodySchema);
	} catch (err) {
		if (err instanceof RequestValidationError) return json({ error: err.message }, { status: 400 });
		throw err;
	}

	if (body.action === 'create') {
		// Retry on the small chance of a join-code collision.
		for (let attempt = 0; attempt < 5; attempt++) {
			const joinCode = makeJoinCode();
			const { data: cls, error } = await supabaseAdmin
				.from('classes')
				.insert({ owner_id: userId, name: body.name, join_code: joinCode })
				.select('id, join_code')
				.single();
			if (error) {
				if (error.code === '23505') continue; // unique violation on join_code
				return json({ error: 'Could not create the class.' }, { status: 500 });
			}
			await supabaseAdmin.from('class_members').insert({ class_id: cls.id, user_id: userId });
			return json({ classId: cls.id, joinCode: cls.join_code });
		}
		return json({ error: 'Could not generate a unique code, please retry.' }, { status: 500 });
	}

	// Join.
	const { data: cls } = await supabaseAdmin
		.from('classes')
		.select('id')
		.eq('join_code', body.joinCode.toUpperCase())
		.maybeSingle();
	if (!cls) return json({ error: 'No class found with that code.' }, { status: 404 });

	const { error } = await supabaseAdmin
		.from('class_members')
		.upsert({ class_id: cls.id, user_id: userId }, { onConflict: 'class_id,user_id' });
	if (error) return json({ error: 'Could not join the class.' }, { status: 500 });

	return json({ classId: cls.id });
};
