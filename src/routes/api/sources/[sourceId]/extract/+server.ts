import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { consumeUsage, UsageLimitError } from '$lib/server/usage';
import { getParser } from '$lib/server/ingestion/parsers';
import type { SourceRecord, SourceType } from '$lib/server/ingestion/types';
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';

// Multi-photo OCR runs one Gemini vision call per photo sequentially, which
// can exceed Vercel's default 10s function timeout. 60s is the Hobby-plan
// ceiling; raise it if the account is on a higher tier, or lower it if a
// smaller cap is enforced.
export const config: Config = { maxDuration: 60 };

/**
 * POST /api/sources/[sourceId]/extract — run the parser for this source and
 * store chunks awaiting user review. Kept as its own endpoint (rather than
 * inline in upload) so it can move to a background job queue without any
 * client changes.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const userId = locals.user!.id;

	const { data: source } = await supabaseAdmin
		.from('sources')
		.select('id, user_id, course_id, source_type, title, status, storage_paths, origin_url')
		.eq('id', params.sourceId)
		.eq('user_id', userId)
		.single();
	if (!source) return json({ error: 'Source not found.' }, { status: 404 });

	if (source.status === 'extracting') {
		return json({ status: 'extracting' });
	}
	if (!['uploaded', 'failed'].includes(source.status)) {
		return json({ status: source.status });
	}

	try {
		await consumeUsage(userId, 'extractions');
	} catch (err) {
		if (err instanceof UsageLimitError) return json({ error: err.message }, { status: 429 });
		throw err;
	}

	await supabaseAdmin
		.from('sources')
		.update({ status: 'extracting', error_message: null })
		.eq('id', source.id);

	try {
		const parser = getParser(source.source_type as SourceType);
		const chunks = await parser.extract(source as SourceRecord, { admin: supabaseAdmin });

		// Re-extraction replaces prior unconfirmed chunks.
		await supabaseAdmin.from('source_chunks').delete().eq('source_id', source.id);

		const { error: insertError } = await supabaseAdmin.from('source_chunks').insert(
			chunks.map((c) => ({
				source_id: source.id,
				user_id: userId,
				source_type: source.source_type,
				chunk_index: c.chunkIndex,
				location_label: c.locationLabel,
				content: c.content,
				storage_path_index: c.storagePathIndex,
				bounding_boxes_json: c.boundingBoxes ?? null,
				metadata_json: c.metadata ?? null
			}))
		);
		if (insertError) throw new Error(insertError.message);

		await supabaseAdmin.from('sources').update({ status: 'needs_review' }).eq('id', source.id);
		return json({ status: 'needs_review', chunkCount: chunks.length });
	} catch (err) {
		const message = (err as Error).message;
		await supabaseAdmin
			.from('sources')
			.update({ status: 'failed', error_message: message })
			.eq('id', source.id);
		return json({ error: message, status: 'failed' }, { status: 500 });
	}
};
