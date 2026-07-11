import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import type { SourceParser, ExtractedChunk, SourceRecord, ParserContext } from '../types';

const MAX_CHUNK_CHARS = 4000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;

/**
 * Webpage import: fetch a public readable page, strip nav/footer junk with
 * Readability, and split the main article by its headings so View Source can
 * jump to a useful "section". Only public http(s) pages; private network
 * hosts are refused to avoid SSRF.
 */
export const webpageParser: SourceParser = {
	sourceType: 'webpage',
	async extract(source: SourceRecord, _ctx: ParserContext): Promise<ExtractedChunk[]> {
		const url = source.origin_url;
		if (!url) throw new Error('Webpage source has no URL.');
		assertPublicUrl(url);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		let html: string;
		try {
			const res = await fetch(url, {
				signal: controller.signal,
				redirect: 'follow',
				headers: { 'user-agent': 'LoreleafAcademy/1.0 (+study-import)' }
			});
			if (!res.ok) throw new Error(`The page returned HTTP ${res.status}.`);
			const contentType = res.headers.get('content-type') ?? '';
			if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
				throw new Error('That URL is not a readable HTML page.');
			}
			const buffer = await res.arrayBuffer();
			if (buffer.byteLength > MAX_HTML_BYTES) throw new Error('That page is too large to import.');
			html = new TextDecoder().decode(buffer);
		} catch (err) {
			if ((err as Error).name === 'AbortError') throw new Error('The page took too long to load.');
			throw err;
		} finally {
			clearTimeout(timeout);
		}

		const { document } = parseHTML(html);
		const article = new Readability(document as unknown as Document).parse();
		const title = article?.title?.trim() || source.title;
		const bodyText = (article?.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
		if (bodyText.length < 40) {
			throw new Error('Could not extract readable content from that page.');
		}

		// Split on blank-line groups into size-capped sections.
		const parts = bodyText
			.split(/\n{2,}/)
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

		return sections.map((content, i): ExtractedChunk => ({
			chunkIndex: i,
			locationLabel:
				sections.length === 1 ? `Article: ${title.slice(0, 60)}` : `${title.slice(0, 40)} — part ${i + 1}`,
			content,
			storagePathIndex: null,
			metadata: { origin_url: url, article_title: title }
		}));
	}
};

/** Reject non-public URLs to avoid server-side request forgery. */
function assertPublicUrl(raw: string): void {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new Error('That is not a valid URL.');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('Only http(s) URLs can be imported.');
	}
	const host = url.hostname.toLowerCase();
	if (
		host === 'localhost' ||
		host === '0.0.0.0' ||
		host.endsWith('.local') ||
		host.endsWith('.internal') ||
		/^127\./.test(host) ||
		/^10\./.test(host) ||
		/^192\.168\./.test(host) ||
		/^169\.254\./.test(host) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
		host.includes(':') // raw IPv6 literals (incl. ::1)
	) {
		throw new Error('That host cannot be imported.');
	}
}
