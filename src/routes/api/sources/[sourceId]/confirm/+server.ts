import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { confirmSourceSchema, parseBody, RequestValidationError } from '$lib/server/validation';
import type { RequestHandler } from './$types';

/**
 * POST /api/sources/[sourceId]/confirm — save the user's edited chunks and
 * mark the source confirmed. Generation only ever reads confirmed chunks,
 * so user corrections are authoritative over raw OCR.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const userId = locals.user!.id;

	let body;
	try {
		body = await parseBody(request, confirmSourceSchema);
	} catch (err) {
		if (err instanceof RequestValidationError) return json({ error: err.message }, { status: 400 });
		throw err;
	}

	const { data: source } = await supabaseAdmin
		.from('sources')
		.select('id, source_type, status')
		.eq('id', params.sourceId)
		.eq('user_id', userId)
		.single();
	if (!source) return json({ error: 'Source not found.' }, { status: 404 });
	if (!['needs_review', 'confirmed'].includes(source.status)) {
		return json({ error: `Source is not reviewable in status "${source.status}".` }, { status: 409 });
	}

	// Replace chunks wholesale with the user-approved set.
	const { error: deleteError } = await supabaseAdmin
		.from('source_chunks')
		.delete()
		.eq('source_id', source.id);
	if (deleteError) return json({ error: 'Could not save your edits.' }, { status: 500 });

	const { error: insertError } = await supabaseAdmin.from('source_chunks').insert(
		body.chunks.map((c) => ({
			source_id: source.id,
			user_id: userId,
			source_type: source.source_type,
			chunk_index: c.chunkIndex,
			location_label: c.locationLabel,
			content: c.content,
			storage_path_index: c.storagePathIndex ?? null
		}))
	);
	if (insertError) return json({ error: 'Could not save your edits.' }, { status: 500 });

	await supabaseAdmin.from('sources').update({ status: 'confirmed' }).eq('id', source.id);
	return json({ status: 'confirmed' });
};
