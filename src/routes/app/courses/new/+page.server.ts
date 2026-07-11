import { fail, redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { generateRegionTheme } from '$lib/server/generation';
import { createCourseSchema } from '$lib/server/validation';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const userId = locals.user!.id;
		const form = await request.formData();
		const parsed = createCourseSchema.safeParse({
			title: String(form.get('title') ?? '').trim(),
			subject: String(form.get('subject') ?? '').trim() || undefined
		});
		if (!parsed.success) {
			return fail(400, { error: 'Please give your course a title (max 120 characters).' });
		}

		const theme = await generateRegionTheme(parsed.data.title, parsed.data.subject);

		const { data: course, error: courseError } = await supabaseAdmin
			.from('courses')
			.insert({
				user_id: userId,
				title: parsed.data.title,
				subject: parsed.data.subject ?? null,
				region_name: theme.region_name,
				region_theme_json: theme
			})
			.select('id')
			.single();
		if (courseError || !course) {
			return fail(500, { error: 'Could not create the course. Please try again.' });
		}

		// First course: grant the starter Memosprite.
		const { count } = await supabaseAdmin
			.from('user_creatures')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', userId);
		if ((count ?? 0) === 0) {
			const { data: starter } = await supabaseAdmin
				.from('creatures')
				.select('id')
				.eq('slug', 'sproutome')
				.single();
			if (starter) {
				await supabaseAdmin
					.from('user_creatures')
					.insert({ user_id: userId, creature_id: starter.id, is_active: true });
			}
		}

		redirect(303, `/app/courses/${course.id}`);
	}
};
