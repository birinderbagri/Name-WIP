import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

/**
 * Service-role client. Bypasses RLS — use ONLY inside server routes that have
 * already verified ownership via locals.user, and never leak it to load
 * functions that serialize data for the client.
 */
export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

const SIGNED_URL_TTL_SECONDS = 60 * 10;

/** Short-lived signed URL for a private storage object. */
export async function signedSourceUrl(path: string): Promise<string> {
	const { data, error } = await supabaseAdmin.storage
		.from('sources')
		.createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
	if (error || !data) {
		throw new Error(`Could not sign storage URL: ${error?.message ?? 'unknown error'}`);
	}
	return data.signedUrl;
}
