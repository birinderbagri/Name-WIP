import type { SourceParser, SourceType } from '../types';
import { imageParser } from './image';
import { pdfParser } from './pdf';
import { pastedTextParser } from './pasted-text';
import { docxParser } from './docx';
import { pptxParser } from './pptx';
import { webpageParser } from './webpage';

/**
 * Parser registry. Each input format is one self-contained module; adding a
 * format is a single line here and nothing else in the pipeline changes.
 */
const parsers = new Map<SourceType, SourceParser>([
	[imageParser.sourceType, imageParser],
	[pdfParser.sourceType, pdfParser],
	[pastedTextParser.sourceType, pastedTextParser],
	[docxParser.sourceType, docxParser],
	[pptxParser.sourceType, pptxParser],
	[webpageParser.sourceType, webpageParser]
]);

export function getParser(sourceType: SourceType): SourceParser {
	const parser = parsers.get(sourceType);
	if (!parser) {
		throw new Error(`Import format "${sourceType}" is not enabled yet.`);
	}
	return parser;
}

export const SUPPORTED_SOURCE_TYPES = [...parsers.keys()];
