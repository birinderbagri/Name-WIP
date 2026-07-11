import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '$env/static/private';

/**
 * The Gemini client lives server-side only. No route ever forwards the key
 * or raw client to the browser; all model calls happen inside +server.ts
 * handlers. Gemini's free tier (via Google AI Studio) covers both the
 * vision OCR and text generation calls this app makes.
 */
export const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export const GEMINI_MODEL_NAME = GEMINI_MODEL || 'gemini-2.5-flash';

/** Extract the response text from a generateContent result. */
export function responseText(response: { text?: string }): string {
	return response.text ?? '';
}

/**
 * Parse a JSON payload out of a model response, tolerating code fences.
 * responseMimeType: 'application/json' already asks Gemini for raw JSON,
 * so fence-stripping here is just a safety net. Throws with a useful
 * message when the model returns malformed output so callers can surface a
 * retryable error state.
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
