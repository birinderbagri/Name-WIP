import JSZip from 'jszip';
import type { SourceParser, ExtractedChunk, SourceRecord, ParserContext } from '../types';

/**
 * PPTX parser: a .pptx is a zip of slide XML. We read each
 * ppt/slides/slideN.xml in order and pull the text runs (<a:t>) so each slide
 * becomes one chunk with a "Slide N" location label.
 */
export const pptxParser: SourceParser = {
	sourceType: 'pptx',
	async extract(source: SourceRecord, ctx: ParserContext): Promise<ExtractedChunk[]> {
		const path = source.storage_paths[0];
		if (!path) throw new Error('PPTX source has no uploaded file.');

		const { data, error } = await ctx.admin.storage.from('sources').download(path);
		if (error || !data) {
			throw new Error(`Could not read uploaded slides: ${error?.message ?? 'not found'}`);
		}

		const zip = await JSZip.loadAsync(await data.arrayBuffer());

		// Sort slide files numerically (slide1, slide2, … slide10).
		const slideFiles = Object.keys(zip.files)
			.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
			.sort((a, b) => {
				const na = Number(a.match(/slide(\d+)\.xml$/)![1]);
				const nb = Number(b.match(/slide(\d+)\.xml$/)![1]);
				return na - nb;
			});

		if (slideFiles.length === 0) {
			throw new Error('No slides found in this presentation.');
		}

		const chunks: ExtractedChunk[] = [];
		for (let i = 0; i < slideFiles.length; i++) {
			const xml = await zip.files[slideFiles[i]].async('string');
			// Extract text runs; join within a paragraph, break between paragraphs.
			const runs = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) =>
				decodeXmlEntities(m[1])
			);
			const paragraphs = xml
				.split(/<a:p[ >]/)
				.map((p) =>
					[...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
						.map((m) => decodeXmlEntities(m[1]))
						.join('')
				)
				.filter((line) => line.trim().length > 0);

			const content = (paragraphs.length ? paragraphs : runs).join('\n').trim();
			if (content.length === 0) continue; // skip blank/image-only slides

			chunks.push({
				chunkIndex: chunks.length,
				locationLabel: `Slide ${i + 1}`,
				content,
				storagePathIndex: 0,
				metadata: { slide: i + 1 }
			});
		}

		if (chunks.length === 0) {
			throw new Error(
				'No readable text found on these slides. If they are image-only, upload them as photos instead so OCR can read them.'
			);
		}
		return chunks;
	}
};

function decodeXmlEntities(value: string): string {
	return value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}
