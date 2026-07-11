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
		const displayName = String(form.get('display_name') ?? '').trim() || 'Ranger';

		if (!email || password.length < 8) {
			return fail(400, {
				error: 'A valid email and a password of at least 8 characters are required.',
				email,
				displayName
			});
		}

		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: { data: { display_name: displayName } }
		});
		if (error) {
			return fail(400, { error: error.message, email, displayName });
		}

		// With email confirmation enabled there is no session yet.
		if (!data.session) {
			return { confirmationSent: true };
		}
		redirect(303, '/app');
	}
};
