import type { SourceParser, ExtractedChunk, SourceRecord, ParserContext } from '../types';

const MAX_CHUNK_CHARS = 4000;

/**
 * Pasted-notes parser: splits on headings/blank-line groups into
 * reviewable sections so View Source can point at a specific
 * "pasted-note section" rather than one giant blob.
 */
export const pastedTextParser: SourceParser = {
	sourceType: 'pasted_text',
	async extract(_source: SourceRecord, ctx: ParserContext): Promise<ExtractedChunk[]> {
		const raw = ctx.inlineContent?.trim();
		if (!raw) {
			throw new Error('Pasted source has no content.');
		}

		// Split on markdown-style headings or double blank lines, then pack
		// into chunks under the size cap.
		const parts = raw
			.split(/\n(?=#{1,4}\s)|\n{3,}/)
			.map((p) => p.trim())
			.filter(Boolean);

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
			const headingMatch = content.match(/^#{1,4}\s+(.{1,60})/);
			return {
				chunkIndex: i,
				locationLabel: headingMatch ? `Section: ${headingMatch[1].trim()}` : `Section ${i + 1}`,
				content,
				storagePathIndex: null
			};
		});
	}
};
