import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '$env/static/private';

/**
 * The Anthropic client lives server-side only. No route ever forwards the
 * key or raw client to the browser; all model calls happen inside +server.ts
 * handlers.
 */
export const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export const CLAUDE_MODEL = ANTHROPIC_MODEL || 'claude-sonnet-5';

/** Extract the concatenated text blocks from a Claude response. */
export function responseText(message: Anthropic.Message): string {
	return message.content
		.filter((block): block is Anthropic.TextBlock => block.type === 'text')
		.map((block) => block.text)
		.join('');
}

/**
 * Parse a JSON payload out of a model response, tolerating code fences.
 * Throws with a useful message when the model returns malformed output so
 * callers can surface a retryable error state.
 */
export function parseJsonResponse<T>(raw: string): T {
	const trimmed = raw.trim();
	const unfenced = trimmed.startsWith('```')
		? trimmed.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')
		: trimmed;
	try {
		return JSON.parse(unfenced) as T;
	} catch {
		throw new Error('Model returned malformed JSON; the request can be retried.');
	}
}
