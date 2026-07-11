import { gemini, GEMINI_MODEL_NAME, NO_THINKING, responseText, parseJsonResponse } from '$lib/server/gemini';
import { extractionResultSchema } from '$lib/server/validation';
import type { SourceParser, ExtractedChunk, SourceRecord, ParserContext } from '../types';

const OCR_SYSTEM_PROMPT = `You are a careful OCR and document-understanding engine for a study app.
You will receive a photo or scan of study material (handwritten notes, a worksheet, a whiteboard, or a textbook page).

Transcribe ALL legible text faithfully. Additionally:
- Describe diagrams, charts, and tables in plain text, including visible labels, in reading order, prefixed with [DIAGRAM], [CHART], or [TABLE].
- Preserve headings, bullet structure, and equations as plain text.
- If a region is illegible, write [illegible] rather than guessing.
- Do NOT add facts, definitions, or corrections that are not visible in the image.

Respond with ONLY this JSON, no prose:
{"pages": [{"location_label": "<short label>", "content": "<full transcription>"}]}
Use a single entry in "pages" for a single image.`;

const MEDIA_TYPES: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp'
};

async function ocrOneImage(
	bytes: ArrayBuffer,
	extension: string,
	photoLabel: string
): Promise<string> {
	const mediaType = MEDIA_TYPES[extension] ?? 'image/jpeg';
	const response = await gemini.models.generateContent({
		model: GEMINI_MODEL_NAME,
		contents: [
			{
				role: 'user',
				parts: [
					{ inlineData: { mimeType: mediaType, data: Buffer.from(bytes).toString('base64') } },
					{ text: `Transcribe this study material. Label it "${photoLabel}".` }
				]
			}
		],
		config: {
			systemInstruction: OCR_SYSTEM_PROMPT,
			responseMimeType: 'application/json',
			temperature: 0.2,
			maxOutputTokens: 4096,
			...NO_THINKING
		}
	});
	const parsed = extractionResultSchema.parse(parseJsonResponse(responseText(response)));
	return parsed.pages.map((p) => p.content).join('\n\n');
}

/**
 * Image parser: downloads each private photo, OCRs it with Gemini vision,
 * and emits one chunk per photo so every generated item can deep-link back
 * to the exact original photo. Multiple photos in one source form a single
 * logical source ("Biology Chapter 3 — 8 pages").
 */
export const imageParser: SourceParser = {
	sourceType: 'image',
	async extract(source: SourceRecord, ctx: ParserContext): Promise<ExtractedChunk[]> {
		if (source.storage_paths.length === 0) {
			throw new Error('Image source has no uploaded files.');
		}
		const chunks: ExtractedChunk[] = [];
		for (let i = 0; i < source.storage_paths.length; i++) {
			const path = source.storage_paths[i];
			const { data, error } = await ctx.admin.storage.from('sources').download(path);
			if (error || !data) {
				throw new Error(`Could not read uploaded photo ${i + 1}: ${error?.message ?? 'not found'}`);
			}
			const extension = path.split('.').pop()?.toLowerCase() ?? 'jpeg';
			const label =
				source.storage_paths.length === 1
					? 'Photo 1'
					: `Photo ${i + 1} of ${source.storage_paths.length}`;
			const content = await ocrOneImage(await data.arrayBuffer(), extension, label);
			chunks.push({
				chunkIndex: i,
				locationLabel: label,
				content,
				storagePathIndex: i,
				metadata: { extraction: 'gemini_vision_ocr' }
			});
		}
		return chunks;
	}
};
