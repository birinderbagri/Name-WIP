import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const userId = locals.user!.id;

	const { data: course } = await locals.supabase
		.from('courses')
		.select('id, title, subject, region_name, region_theme_json')
		.eq('id', params.courseId)
		.eq('user_id', userId)
		.single();
	if (!course) error(404, 'Course not found.');

	const { data: sources } = await locals.supabase
		.from('sources')
		.select('id, title, source_type, status, error_message, storage_paths, created_at')
		.eq('course_id', course.id)
		.order('created_at', { ascending: false });

	const { count: questionCount } = await locals.supabase
		.from('quiz_questions')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', userId)
		.in(
			'source_id',
			(sources ?? []).map((s) => s.id)
		);

	return {
		course,
		sources: sources ?? [],
		questionCount: questionCount ?? 0
	};
};
