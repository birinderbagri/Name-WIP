import { supabaseAdmin } from '$lib/server/supabase-admin';

export interface FeatureFlag {
	key: string;
	enabled: boolean;
	value_json: unknown;
}

/**
 * Server-side feature flag read with a short in-memory cache. Ads and shop
 * purchasing are OFF unless explicitly enabled in the feature_flags table.
 */
const CACHE_TTL_MS = 30_000;
let cache: { flags: Map<string, FeatureFlag>; at: number } | null = null;

export async function getFlags(): Promise<Map<string, FeatureFlag>> {
	if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.flags;
	const { data } = await supabaseAdmin.from('feature_flags').select('key, enabled, value_json');
	const flags = new Map<string, FeatureFlag>((data ?? []).map((f) => [f.key, f]));
	cache = { flags, at: Date.now() };
	return flags;
}

export async function flagEnabled(key: string): Promise<boolean> {
	return (await getFlags()).get(key)?.enabled ?? false;
}
