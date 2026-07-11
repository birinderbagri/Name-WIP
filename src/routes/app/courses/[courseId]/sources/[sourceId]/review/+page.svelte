<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data } = $props();

	interface EditableChunk {
		chunkIndex: number;
		locationLabel: string;
		content: string;
		storagePathIndex: number | null;
	}

	let chunks: EditableChunk[] = $state(
		data.chunks.map((c) => ({
			chunkIndex: c.chunk_index,
			locationLabel: c.location_label,
			content: c.content,
			storagePathIndex: c.storage_path_index
		}))
	);

	let busy: 'extracting' | 'confirming' | 'generating' | null = $state(null);
	let errorMessage: string | null = $state(null);

	// Extraction hasn't run yet (or failed): trigger it on arrival.
	onMount(() => {
		if (data.source.status === 'uploaded') {
			void runExtraction();
		}
	});

	async function runExtraction() {
		busy = 'extracting';
		errorMessage = null;
		try {
			const res = await fetch(`/api/sources/${data.source.id}/extract`, { method: 'POST' });
			const body = await res.json();
			if (!res.ok) {
				errorMessage = body.error ?? 'Extraction failed.';
				return;
			}
			await invalidateAll();
			chunks = data.chunks.map((c) => ({
				chunkIndex: c.chunk_index,
				locationLabel: c.location_label,
				content: c.content,
				storagePathIndex: c.storage_path_index
			}));
		} catch {
			errorMessage = 'Extraction failed — check your connection and retry.';
		} finally {
			busy = null;
		}
	}

	async function confirmAndGenerate() {
		errorMessage = null;
		if (chunks.some((c) => c.content.trim().length === 0)) {
			errorMessage = 'Every section needs some text — delete empty sections instead.';
			return;
		}
		busy = 'confirming';
		try {
			const confirmRes = await fetch(`/api/sources/${data.source.id}/confirm`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					chunks: chunks.map((c, i) => ({ ...c, chunkIndex: i }))
				})
			});
			if (!confirmRes.ok) {
				errorMessage = (await confirmRes.json()).error ?? 'Could not save your edits.';
				return;
			}

			busy = 'generating';
			const genRes = await fetch(`/api/sources/${data.source.id}/generate`, { method: 'POST' });
			const genBody = await genRes.json();
			if (!genRes.ok) {
				errorMessage = `${genBody.error ?? 'Generation failed.'} Your confirmed text is saved — you can retry generation.`;
				return;
			}
			await goto(`/app/courses/${data.source.course_id}?generated=${genBody.questionCount}`);
		} catch {
			errorMessage = 'Something went wrong — your edits may not be saved. Please retry.';
		} finally {
			busy = null;
		}
	}

	function removeChunk(index: number) {
		chunks = chunks.filter((_, i) => i !== index);
	}
</script>

<svelte:head><title>Check extracted text — Loreleaf Academy</title></svelte:head>

<nav class="crumbs"><a href="/app/courses/{data.source.course_id}">← Back to course</a></nav>

<h1>Check extracted text</h1>
<p class="lede">
	<strong>{data.source.title}</strong> — read through what we extracted and fix any mistakes.
	Study content is generated <em>only</em> from the text you confirm here, so corrections you
	make now keep every future question trustworthy.
</p>

{#if errorMessage}
	<div class="error-box">
		{errorMessage}
		{#if data.source.status === 'failed' || data.source.status === 'uploaded'}
			<button class="btn btn--small" onclick={runExtraction}>Retry extraction</button>
		{/if}
	</div>
{/if}

{#if busy === 'extracting' || data.source.status === 'extracting'}
	<div class="panel loading">
		<h3>Reading your material…</h3>
		<p>Transcribing text, diagrams, and labels. Photos can take a little while — don't close this page.</p>
	</div>
{:else if data.source.status === 'failed' && chunks.length === 0}
	<div class="panel">
		<p>{data.source.error_message ?? 'Extraction failed.'}</p>
		<button class="btn" onclick={runExtraction}>Retry extraction</button>
	</div>
{:else if chunks.length === 0}
	<div class="panel loading"><p>Preparing extraction…</p></div>
{:else}
	<div class="review-list">
		{#each chunks as chunk, i (chunk.chunkIndex)}
			<section class="panel chunk">
				<div class="chunk-head">
					<input
						class="label-input"
						type="text"
						bind:value={chunk.locationLabel}
						maxlength="200"
						aria-label="Location label"
					/>
					<button class="btn btn--small btn--ghost" onclick={() => removeChunk(i)}>Remove section</button>
				</div>

				{#if chunk.storagePathIndex !== null && data.fileUrls[chunk.storagePathIndex] && data.source.source_type === 'image'}
					<details class="original">
						<summary>Show original photo</summary>
						<img src={data.fileUrls[chunk.storagePathIndex]} alt="Original photo for {chunk.locationLabel}" />
					</details>
				{/if}

				<textarea
					bind:value={chunk.content}
					rows="8"
					aria-label="Extracted text for {chunk.locationLabel}"
				></textarea>
			</section>
		{/each}
	</div>

	<div class="confirm-bar panel">
		<p>
			{chunks.length} section{chunks.length === 1 ? '' : 's'} ready.
			Confirming locks this text in as the only material questions are built from.
		</p>
		<button class="btn btn--green" disabled={busy !== null} onclick={confirmAndGenerate}>
			{#if busy === 'confirming'}Saving…{:else if busy === 'generating'}Writing questions from your material…{:else}Looks right — generate study content{/if}
		</button>
	</div>
{/if}

<style>
	.crumbs { margin-bottom: 0.6rem; }
	.lede { max-width: 70ch; }
	.loading { text-align: center; padding: 2.5rem 1rem; }
	.review-list { display: grid; gap: 1rem; margin-bottom: 1rem; }
	.chunk-head {
		display: flex;
		gap: 0.8rem;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.6rem;
	}
	.label-input {
		font-family: var(--font-pixel);
		font-size: 0.95rem;
		max-width: 320px;
		margin-bottom: 0;
	}
	.chunk textarea { margin-bottom: 0; font-size: 0.95rem; }
	.original { margin-bottom: 0.7rem; }
	.original summary { cursor: pointer; font-size: 0.9rem; color: var(--pink-deep); }
	.original img { max-width: 100%; border: 3px solid var(--ink); border-radius: 4px; margin-top: 0.5rem; }
	.confirm-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		position: sticky;
		bottom: 0.8rem;
	}
	.confirm-bar p { margin: 0; font-size: 0.95rem; }
</style>
