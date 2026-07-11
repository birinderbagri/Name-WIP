import type { SourceParser, SourceType } from '../types';
import { imageParser } from './image';
import { pdfParser } from './pdf';
import { pastedTextParser } from './pasted-text';

/**
 * Parser registry. Post-MVP formats (docx, pptx, webpage) get their own
 * module here; until then requesting them yields a clear error instead of
 * a silent fallback.
 */
const parsers = new Map<SourceType, SourceParser>([
	[imageParser.sourceType, imageParser],
	[pdfParser.sourceType, pdfParser],
	[pastedTextParser.sourceType, pastedTextParser]
]);

export function getParser(sourceType: SourceType): SourceParser {
	const parser = parsers.get(sourceType);
	if (!parser) {
		throw new Error(`Import format "${sourceType}" is not enabled yet.`);
	}
	return parser;
}

export const SUPPORTED_SOURCE_TYPES = [...parsers.keys()];
