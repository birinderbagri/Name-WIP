import { error, redirect } from '@sveltejs/kit';
import { shadowConceptQuestionIds } from '$lib/server/gamification';
import { dueQuestionIds } from '$lib/server/spaced-repetition';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const userId = locals.user!.id;

	const { data: course } = await locals.supabase
		.from('courses')
		.select('id, title, region_name, region_theme_json')
		.eq('id', params.courseId)
		.eq('user_id', userId)
		.single();
	if (!course) error(404, 'Course not found.');

	const { data: studySets } = await locals.supabase
		.from('study_sets')
		.select('id')
		.eq('course_id', course.id);
	const setIds = (studySets ?? []).map((s) => s.id);

	if (setIds.length === 0) {
		// Nothing to play yet — send them back to add material.
		redirect(303, `/app/courses/${course.id}`);
	}

	const { data: questions } = await locals.supabase
		.from('quiz_questions')
		.select(
			'id, prompt, question_type, answer_json, explanation, topic, location_label, source_id, source_chunk_id, is_boss'
		)
		.in('study_set_id', setIds)
		.order('created_at');

	if (!questions || questions.length === 0) {
		redirect(303, `/app/courses/${course.id}`);
	}

	const [{ data: save }, { data: creature }, { data: progress }, shadowIds, dueIds] = await Promise.all([
		locals.supabase
			.from('game_saves')
			.select('player_x, player_y, cleared_nodes_json, map_seed')
			.eq('user_id', userId)
			.eq('course_id', course.id)
			.maybeSingle(),
		locals.supabase
			.from('user_creatures')
			.select('level, creatures(name, sprite_key)')
			.eq('user_id', userId)
			.eq('is_active', true)
			.maybeSingle(),
		locals.supabase
			.from('course_progress')
			.select('boss_defeated')
			.eq('user_id', userId)
			.eq('course_id', course.id)
			.maybeSingle(),
		shadowConceptQuestionIds(userId, course.id),
		dueQuestionIds(userId, course.id)
	]);

	// Review zone = concepts you most recently missed, plus anything spaced
	// repetition says is due today. Deduped, and only questions in this course.
	const questionIdSet = new Set(questions.map((q) => q.id));
	const reviewQuestionIds = [...new Set([...shadowIds, ...dueIds])].filter((id) =>
		questionIdSet.has(id)
	);

	const creatureInfo = creature?.creatures as unknown as
		| { name: string; sprite_key: string }
		| undefined;

	return {
		course,
		questions,
		save: save ?? null,
		creature: {
			name: creatureInfo?.name ?? 'Sproutome',
			spriteKey: creatureInfo?.sprite_key ?? 'sproutome',
			level: creature?.level ?? 1
		},
		bossDefeated: progress?.boss_defeated ?? false,
		shadowQuestionIds: reviewQuestionIds
	};
};
