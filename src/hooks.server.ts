import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const supabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	// getUser() validates the JWT against Supabase Auth — never trust the
	// cookie session alone for authorization decisions.
	event.locals.safeGetSession = async () => {
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) {
			return { session: null, user: null };
		}
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	const isProtected =
		event.url.pathname.startsWith('/app') || event.url.pathname.startsWith('/api');

	if (isProtected && !user) {
		if (event.url.pathname.startsWith('/api')) {
			return new Response(JSON.stringify({ error: 'Not authenticated' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		redirect(303, '/login');
	}

	return resolve(event);
};

export const handle = sequence(supabase, authGuard);
