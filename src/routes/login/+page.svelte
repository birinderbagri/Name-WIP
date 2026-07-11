<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Sign in — Loreleaf Academy</title></svelte:head>

<main class="container auth-page">
	<div class="panel auth-panel">
		<h1>Welcome back, Ranger</h1>
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
			<label for="email">Email</label>
			<input id="email" name="email" type="email" required value={form?.email ?? ''} />
			<label for="password">Password</label>
			<input id="password" name="password" type="password" required />
			<button class="btn btn--green" type="submit" disabled={submitting}>
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
		<p class="switch">New here? <a href="/signup">Create an account</a></p>
	</div>
</main>

<style>
	.auth-page { display: flex; justify-content: center; padding-top: 4rem; }
	.auth-panel { width: 100%; max-width: 420px; }
	.switch { margin-top: 1rem; }
</style>
