import { extractText, getDocumentProxy } from 'unpdf';
import type { SourceParser, ExtractedChunk, SourceRecord, ParserContext } from '../types';

/**
 * PDF parser: extracts text per page so location labels ("Page 3") let
 * View Source deep-link straight to the right page.
 */
export const pdfParser: SourceParser = {
	sourceType: 'pdf',
	async extract(source: SourceRecord, ctx: ParserContext): Promise<ExtractedChunk[]> {
		const path = source.storage_paths[0];
		if (!path) {
			throw new Error('PDF source has no uploaded file.');
		}
		const { data, error } = await ctx.admin.storage.from('sources').download(path);
		if (error || !data) {
			throw new Error(`Could not read uploaded PDF: ${error?.message ?? 'not found'}`);
		}

		const pdf = await getDocumentProxy(new Uint8Array(await data.arrayBuffer()));
		const { text } = await extractText(pdf, { mergePages: false });
		const pages: string[] = Array.isArray(text) ? text : [text];

		const chunks: ExtractedChunk[] = [];
		pages.forEach((pageText, i) => {
			const cleaned = pageText.replace(/\s+\n/g, '\n').trim();
			if (cleaned.length === 0) return; // skip blank pages
			chunks.push({
				chunkIndex: chunks.length,
				locationLabel: `Page ${i + 1}`,
				content: cleaned,
				storagePathIndex: 0,
				metadata: { pdf_page: i + 1 }
			});
		});
		if (chunks.length === 0) {
			throw new Error(
				'No selectable text found in this PDF. If it is a scanned document, upload the pages as photos instead so OCR can read them.'
			);
		}
		return chunks;
	}
};
