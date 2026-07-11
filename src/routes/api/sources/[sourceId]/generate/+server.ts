import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { consumeUsage, UsageLimitError } from '$lib/server/usage';
import { generateQuestions } from '$lib/server/generation';
import type { RequestHandler } from './$types';

/**
 * POST /api/sources/[sourceId]/generate — generate 10–20 source-grounded
 * questions from the user-confirmed chunks. Every persisted question carries
 * source_id, source_chunk_id, and location_label so View Source always
 * resolves.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const userId = locals.user!.id;

	const { data: source } = await supabaseAdmin
		.from('sources')
		.select('id, course_id, title, status')
		.eq('id', params.sourceId)
		.eq('user_id', userId)
		.single();
	if (!source) return json({ error: 'Source not found.' }, { status: 404 });
	if (source.status !== 'confirmed') {
		return json(
			{ error: 'Confirm the extracted text before generating study content.' },
			{ status: 409 }
		);
	}

	const { data: chunks } = await supabaseAdmin
		.from('source_chunks')
		.select('id, chunk_index, location_label, content')
		.eq('source_id', source.id)
		.order('chunk_index');
	if (!chunks || chunks.length === 0) {
		return json({ error: 'No confirmed content found for this source.' }, { status: 409 });
	}

	try {
		await consumeUsage(userId, 'generations');
	} catch (err) {
		if (err instanceof UsageLimitError) return json({ error: err.message }, { status: 429 });
		throw err;
	}

	await supabaseAdmin.from('sources').update({ status: 'generating' }).eq('id', source.id);

	try {
		const result = await generateQuestions(
			chunks.map((c) => ({
				id: c.id,
				chunkIndex: c.chunk_index,
				locationLabel: c.location_label,
				content: c.content
			}))
		);

		const chunkByIndex = new Map(chunks.map((c) => [c.chunk_index, c]));

		const { data: studySet, error: setError } = await supabaseAdmin
			.from('study_sets')
			.insert({
				course_id: source.course_id,
				source_id: source.id,
				user_id: userId,
				title: source.title,
				topics_json: result.topics
			})
			.select('id')
			.single();
		if (setError || !studySet) throw new Error('Could not create the study set.');

		const rows = result.questions.map((q) => {
			const chunk = chunkByIndex.get(q.source_chunk_index)!;
			const answer_json =
				q.question_type === 'multiple_choice'
					? { options: q.options, correct_index: q.correct_index }
					: q.question_type === 'true_false'
						? { correct_answer: q.correct_answer }
						: { accepted_answers: q.accepted_answers };
			return {
				study_set_id: studySet.id,
				source_id: source.id,
				source_chunk_id: chunk.id,
				user_id: userId,
				location_label: chunk.location_label,
				topic: q.topic,
				question_type: q.question_type,
				difficulty: q.difficulty,
				is_boss: false,
				prompt: q.prompt,
				answer_json,
				explanation: q.explanation
			};
		});

		const { error: questionsError } = await supabaseAdmin.from('quiz_questions').insert(rows);
		if (questionsError) throw new Error('Could not save generated questions.');

		await supabaseAdmin.from('sources').update({ status: 'ready' }).eq('id', source.id);
		return json({ status: 'ready', questionCount: rows.length, topics: result.topics });
	} catch (err) {
		const message = (err as Error).message;
		// Roll back to confirmed so the user can retry generation.
		await supabaseAdmin
			.from('sources')
			.update({ status: 'confirmed', error_message: message })
			.eq('id', source.id);
		return json({ error: message }, { status: 502 });
	}
};
