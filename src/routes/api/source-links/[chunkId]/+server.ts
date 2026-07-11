import { json } from '@sveltejs/kit';
import { supabaseAdmin, signedSourceUrl } from '$lib/server/supabase-admin';
import type { RequestHandler } from './$types';

/**
 * GET /api/source-links/[chunkId] — resolve a View Source deep link.
 * Returns the chunk text, its location label, and (when the chunk came from
 * an uploaded file) a short-lived signed URL to the original private file.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = locals.user!.id;

	const { data: chunk } = await supabaseAdmin
		.from('source_chunks')
		.select('id, content, location_label, storage_path_index, source_type, sources(title, storage_paths)')
		.eq('id', params.chunkId)
		.eq('user_id', userId)
		.single();
	if (!chunk) return json({ error: 'Source location not found.' }, { status: 404 });

	const source = chunk.sources as unknown as { title: string; storage_paths: string[] } | null;

	let fileUrl: string | null = null;
	let fileKind: 'image' | 'pdf' | null = null;
	if (source && chunk.storage_path_index !== null) {
		const path = source.storage_paths[chunk.storage_path_index];
		if (path) {
			try {
				fileUrl = await signedSourceUrl(path);
				fileKind = chunk.source_type === 'pdf' ? 'pdf' : 'image';
			} catch {
				// The text fallback below still lets the learner verify.
			}
		}
	}

	return json({
		locationLabel: chunk.location_label,
		sourceTitle: source?.title ?? 'Source',
		content: chunk.content,
		fileUrl,
		fileKind
	});
};
