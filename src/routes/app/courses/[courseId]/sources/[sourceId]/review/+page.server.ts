import { error } from '@sveltejs/kit';
import { signedSourceUrl } from '$lib/server/supabase-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const userId = locals.user!.id;

	const { data: source } = await locals.supabase
		.from('sources')
		.select('id, course_id, title, source_type, status, error_message, storage_paths')
		.eq('id', params.sourceId)
		.eq('course_id', params.courseId)
		.eq('user_id', userId)
		.single();
	if (!source) error(404, 'Source not found.');

	const { data: chunks } = await locals.supabase
		.from('source_chunks')
		.select('id, chunk_index, location_label, content, storage_path_index')
		.eq('source_id', source.id)
		.order('chunk_index');

	// Signed preview URLs so the user can compare extraction against the
	// original photos/PDF while reviewing. Short TTL; regenerated per visit.
	const fileUrls: (string | null)[] = await Promise.all(
		source.storage_paths.map(async (path: string) => {
			try {
				return await signedSourceUrl(path);
			} catch {
				return null;
			}
		})
	);

	return { source, chunks: chunks ?? [], fileUrls };
};
