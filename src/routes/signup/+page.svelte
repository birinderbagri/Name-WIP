<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Join — Loreleaf Academy</title></svelte:head>

<main class="container auth-page">
	<div class="panel auth-panel">
		<h1>Become a Knowledge Ranger</h1>
		{#if form?.confirmationSent}
			<div class="panel--dialogue confirm-note">
				<p>Check your email to confirm your account, then sign in.</p>
			</div>
		{:else}
			{#if form?.error}
				<div class="error-box">{form.error}</div>
			{/if}
			<form
				method="POST"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						submitting = false;
						await update();
					};
				}}
			>
				<label for="display_name">Ranger name</label>
				<input id="display_name" name="display_name" type="text" maxlength="40" value={form?.displayName ?? ''} />
				<label for="email">Email</label>
				<input id="email" name="email" type="email" required value={form?.email ?? ''} />
				<label for="password">Password (8+ characters)</label>
				<input id="password" name="password" type="password" minlength="8" required />
				<button class="btn btn--green" type="submit" disabled={submitting}>
					{submitting ? 'Creating…' : 'Create account'}
				</button>
			</form>
			<p class="switch">Already enrolled? <a href="/login">Sign in</a></p>
		{/if}
	</div>
</main>

<style>
	.auth-page { display: flex; justify-content: center; padding-top: 4rem; }
	.auth-panel { width: 100%; max-width: 420px; }
	.switch { margin-top: 1rem; }
	.confirm-note { padding: 1rem; border-radius: 4px; }
</style>
