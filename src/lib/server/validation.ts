import { z } from 'zod';

// ------------------------------------------------------------
// Request schemas — every mutating API route validates its body.
// ------------------------------------------------------------

export const createCourseSchema = z.object({
	title: z.string().min(1).max(120),
	subject: z.string().max(80).optional()
});

export const createPastedSourceSchema = z.object({
	courseId: z.string().uuid(),
	title: z.string().min(1).max(200),
	content: z.string().min(20).max(200_000)
});

export const confirmSourceSchema = z.object({
	chunks: z
		.array(
			z.object({
				chunkIndex: z.number().int().min(0),
				locationLabel: z.string().min(1).max(200),
				content: z.string().min(1).max(50_000),
				storagePathIndex: z.number().int().min(0).nullable().optional()
			})
		)
		.min(1)
		.max(200)
});

export const attemptSchema = z.object({
	questionId: z.string().uuid(),
	courseId: z.string().uuid(),
	isCorrect: z.boolean(),
	answerGiven: z.string().max(2000).optional(),
	focusChain: z.number().int().min(0).max(999),
	inBossBattle: z.boolean().default(false)
});

export const gameSaveSchema = z.object({
	courseId: z.string().uuid(),
	playerX: z.number().int().min(0).max(63),
	playerY: z.number().int().min(0).max(63),
	clearedNodes: z.array(z.string()).max(500)
});

export const adEventSchema = z.object({
	placement: z.enum(['banner', 'rewarded', 'interstitial']),
	eventType: z.enum(['impression', 'click', 'reward_granted', 'dismissed']),
	context: z.string().max(120).optional()
});

// ------------------------------------------------------------
// Model-output schemas — Claude responses are untrusted input and
// get the same validation treatment as user requests.
// ------------------------------------------------------------

export const extractedPageSchema = z.object({
	location_label: z.string().min(1).max(200),
	content: z.string(),
	notes: z.string().optional()
});

export const extractionResultSchema = z.object({
	pages: z.array(extractedPageSchema).min(1).max(100)
});

const questionBase = {
	source_chunk_index: z.number().int().min(0),
	topic: z.string().min(1).max(120),
	difficulty: z.number().int().min(1).max(3),
	prompt: z.string().min(1).max(2000),
	explanation: z.string().min(1).max(2000)
};

export const generatedQuestionSchema = z.discriminatedUnion('question_type', [
	z.object({
		...questionBase,
		question_type: z.literal('multiple_choice'),
		options: z.array(z.string().min(1)).min(3).max(5),
		correct_index: z.number().int().min(0)
	}),
	z.object({
		...questionBase,
		question_type: z.literal('true_false'),
		correct_answer: z.boolean()
	}),
	z.object({
		...questionBase,
		question_type: z.literal('typing'),
		accepted_answers: z.array(z.string().min(1)).min(1).max(10)
	})
]);

export const generationResultSchema = z.object({
	topics: z.array(z.string().min(1).max(120)).min(1).max(20),
	questions: z.array(generatedQuestionSchema).min(5).max(30)
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GenerationResult = z.infer<typeof generationResultSchema>;

/** Parse a request body against a schema, returning a 400-friendly error. */
export async function parseBody<S extends z.ZodTypeAny>(
	request: Request,
	schema: S
): Promise<z.output<S>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw new RequestValidationError('Request body must be JSON.');
	}
	const result = schema.safeParse(raw);
	if (!result.success) {
		throw new RequestValidationError(result.error.issues.map((i) => i.message).join('; '));
	}
	return result.data;
}

export class RequestValidationError extends Error {}
