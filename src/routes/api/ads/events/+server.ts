import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { adEventSchema, parseBody, RequestValidationError } from '$lib/server/validation';
import type { RequestHandler } from './$types';

/** POST /api/ads/events — audit log for ad impressions/clicks/dismissals. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;

	let body;
	try {
		body = await parseBody(request, adEventSchema);
	} catch (err) {
		if (err instanceof RequestValidationError) return json({ error: err.message }, { status: 400 });
		throw err;
	}

	await supabaseAdmin.from('ad_events').insert({
		user_id: userId,
		placement: body.placement,
		event_type: body.eventType,
		context: body.context ?? null
	});

	return json({ ok: true });
};
