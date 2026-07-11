import { gemini, GEMINI_MODEL_NAME, responseText, parseJsonResponse } from '$lib/server/gemini';
import { generationResultSchema, type GenerationResult } from '$lib/server/validation';

export interface ChunkForGeneration {
	id: string;
	chunkIndex: number;
	locationLabel: string;
	content: string;
}

const GENERATION_SYSTEM_PROMPT = `You are the question writer for Loreleaf Academy, a source-grounded study app.

STRICT GROUNDING RULES — these are a trust feature of the product:
- Write questions ONLY from the provided source chunks. Every fact in every prompt, option, answer, and explanation must be present in the chunks.
- Never use outside knowledge, even to fix apparent mistakes in the source. If the source says it, that is the correct answer.
- Never invent facts to fill gaps. If a chunk is too thin for a question, skip it.
- Each question must cite the single chunk it was written from via "source_chunk_index".
- Explanations must quote or closely paraphrase the source so a learner can verify with one click.

QUALITY RULES:
- Mix question types: multiple_choice, true_false, typing.
- Multiple choice distractors must be plausible but clearly wrong per the source.
- Keep prompts answerable in under 60 seconds.
- Group questions under short topic names (2-4 words) derived from the material.
- Difficulty 1 = recall, 2 = understanding, 3 = application within the source.

Respond with ONLY this JSON, no prose:
{
  "topics": ["..."],
  "questions": [
    {"source_chunk_index": 0, "topic": "...", "difficulty": 1, "question_type": "multiple_choice", "prompt": "...", "options": ["...","...","..."], "correct_index": 0, "explanation": "..."},
    {"source_chunk_index": 0, "topic": "...", "difficulty": 1, "question_type": "true_false", "prompt": "...", "correct_answer": true, "explanation": "..."},
    {"source_chunk_index": 0, "topic": "...", "difficulty": 2, "question_type": "typing", "prompt": "...", "accepted_answers": ["..."], "explanation": "..."}
  ]
}`;

/**
 * Generate 10–20 source-grounded questions from confirmed chunks.
 * The model only ever sees user-confirmed text; results are validated and
 * every question is checked to reference a real chunk before persisting.
 */
export async function generateQuestions(
	chunks: ChunkForGeneration[],
	options: { minQuestions?: number; maxQuestions?: number } = {}
): Promise<GenerationResult> {
	const { minQuestions = 10, maxQuestions = 20 } = options;

	const chunkBlocks = chunks
		.map(
			(c) =>
				`<chunk index="${c.chunkIndex}" location="${c.locationLabel}">\n${c.content}\n</chunk>`
		)
		.join('\n\n');

	const response = await gemini.models.generateContent({
		model: GEMINI_MODEL_NAME,
		contents: [
			{
				role: 'user',
				parts: [
					{
						text: `Source chunks (user-confirmed):\n\n${chunkBlocks}\n\nWrite between ${minQuestions} and ${maxQuestions} questions following every rule.`
					}
				]
			}
		],
		config: {
			systemInstruction: GENERATION_SYSTEM_PROMPT,
			responseMimeType: 'application/json',
			temperature: 0.4,
			maxOutputTokens: 8192
		}
	});

	const result = generationResultSchema.parse(parseJsonResponse(responseText(response)));

	// Hard grounding check: drop anything citing a chunk that doesn't exist,
	// and anything with an out-of-range correct_index.
	const validIndexes = new Set(chunks.map((c) => c.chunkIndex));
	const questions = result.questions.filter((q) => {
		if (!validIndexes.has(q.source_chunk_index)) return false;
		if (q.question_type === 'multiple_choice' && q.correct_index >= q.options.length) return false;
		return true;
	});
	if (questions.length < 5) {
		throw new Error('Generation produced too few grounded questions; please retry.');
	}
	return { topics: result.topics, questions };
}

const REGION_SYSTEM_PROMPT = `You name pixel-art study regions for a botanical-fantasy learning RPG.
Given a course subject/title, invent an evocative, original two-word region name (like "Emberglass Lab" or "Fernlight Archive") plus four themed zone names for: easy questions trail, flashcard grove, short-answer cavern, and final boss core.
Never reference existing game franchises. Respond with ONLY JSON:
{"region_name": "...", "zones": {"trail": "...", "grove": "...", "cavern": "...", "core": "..."}}`;

export interface RegionTheme {
	region_name: string;
	zones: { trail: string; grove: string; cavern: string; core: string };
}

const FALLBACK_THEME: RegionTheme = {
	region_name: 'Fernlight Archive',
	zones: {
		trail: 'Primer Path',
		grove: 'Recall Grove',
		cavern: 'Query Cavern',
		core: 'Archive Core'
	}
};

export async function generateRegionTheme(courseTitle: string, subject?: string | null): Promise<RegionTheme> {
	try {
		const response = await gemini.models.generateContent({
			model: GEMINI_MODEL_NAME,
			contents: [
				{
					role: 'user',
					parts: [{ text: `Course: "${courseTitle}"${subject ? ` (subject: ${subject})` : ''}` }]
				}
			],
			config: {
				systemInstruction: REGION_SYSTEM_PROMPT,
				responseMimeType: 'application/json',
				temperature: 0.9,
				maxOutputTokens: 300
			}
		});
		return parseJsonResponse<RegionTheme>(responseText(response));
	} catch {
		// Theming is flavor, not learning content — a fallback is fine here.
		return FALLBACK_THEME;
	}
}
