import mammoth from 'mammoth';
import type { SourceParser, ExtractedChunk, SourceRecord, ParserContext } from '../types';

const MAX_CHUNK_CHARS = 4000;

/**
 * DOCX parser: converts the document to plain text with mammoth, then splits
 * into reviewable sections on blank-line groups so View Source can point at a
 * "document section" rather than one giant blob.
 */
export const docxParser: SourceParser = {
	sourceType: 'docx',
	async extract(source: SourceRecord, ctx: ParserContext): Promise<ExtractedChunk[]> {
		const path = source.storage_paths[0];
		if (!path) throw new Error('DOCX source has no uploaded file.');

		const { data, error } = await ctx.admin.storage.from('sources').download(path);
		if (error || !data) {
			throw new Error(`Could not read uploaded document: ${error?.message ?? 'not found'}`);
		}

		const buffer = Buffer.from(await data.arrayBuffer());
		const { value } = await mammoth.extractRawText({ buffer });
		const text = value.trim();
		if (text.length === 0) {
			throw new Error('No readable text found in this document.');
		}

		const parts = text
			.split(/\n{2,}/)
			.map((p) => p.replace(/\s+\n/g, '\n').trim())
			.filter(Boolean);

		// Pack paragraphs into size-capped sections.
		const sections: string[] = [];
		let current = '';
		for (const part of parts) {
			if (current && current.length + part.length > MAX_CHUNK_CHARS) {
				sections.push(current);
				current = part;
			} else {
				current = current ? `${current}\n\n${part}` : part;
			}
		}
		if (current) sections.push(current);

		return sections.map((content, i): ExtractedChunk => {
			const firstLine = content.split('\n')[0].slice(0, 60).trim();
			return {
				chunkIndex: i,
				locationLabel: sections.length === 1 ? 'Document' : `Section ${i + 1}: ${firstLine}`,
				content,
				storagePathIndex: 0,
				metadata: { extraction: 'mammoth' }
			};
		});
	}
};
