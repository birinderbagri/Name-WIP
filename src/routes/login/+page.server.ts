import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/app');
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(400, { error: 'Invalid email or password.', email });
		}
		redirect(303, '/app');
	}
};
