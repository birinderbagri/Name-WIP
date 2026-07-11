<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Chart a new isle — Loreleaf Academy</title></svelte:head>

<div class="panel new-course">
	<h1>Chart a new isle</h1>
	<p>Each course becomes its own study region in the Archive Isles.</p>

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
		<label for="title">Course title</label>
		<input id="title" name="title" type="text" maxlength="120" required placeholder="e.g. Biology — Chapter 3" />
		<label for="subject">Subject (optional)</label>
		<input id="subject" name="subject" type="text" maxlength="80" placeholder="e.g. Biology" />
		<button class="btn btn--green" type="submit" disabled={submitting}>
			{submitting ? 'Raising the isle…' : 'Create course'}
		</button>
	</form>
</div>

<style>
	.new-course { max-width: 480px; margin: 0 auto; }
</style>
