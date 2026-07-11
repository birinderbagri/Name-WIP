<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();

	type UploadKind = 'image' | 'pdf' | 'docx' | 'pptx' | 'pasted_text' | 'webpage';
	let uploadKind: UploadKind = $state('image');
	let sourceTitle = $state('');
	let pastedContent = $state('');
	let originUrl = $state('');
	let files: FileList | undefined = $state();
	let uploading = $state(false);
	let uploadError: string | null = $state(null);

	const FILE_ACCEPT: Record<string, string> = {
		image: 'image/png,image/jpeg,image/webp',
		pdf: 'application/pdf',
		docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
	};

	const STATUS_LABELS: Record<string, string> = {
		uploaded: 'Uploaded — extraction pending',
		extracting: 'Reading your material…',
		needs_review: 'Ready for your check',
		confirmed: 'Confirmed — ready to generate',
		generating: 'Writing questions…',
		ready: 'Ready to play',
		failed: 'Something went wrong'
	};

	async function submitUpload(event: SubmitEvent) {
		event.preventDefault();
		uploadError = null;

		if (!sourceTitle.trim()) {
			uploadError = 'Give this source a name, e.g. "Chapter 3 notes".';
			return;
		}
		const isFileKind = uploadKind === 'image' || uploadKind === 'pdf' || uploadKind === 'docx' || uploadKind === 'pptx';
		if (isFileKind && (!files || files.length === 0)) {
			uploadError = 'Choose at least one file to upload.';
			return;
		}
		if (uploadKind === 'pasted_text' && pastedContent.trim().length < 20) {
			uploadError = 'Paste at least a paragraph of notes.';
			return;
		}
		if (uploadKind === 'webpage' && !/^https?:\/\/.+/i.test(originUrl.trim())) {
			uploadError = 'Enter a valid public http(s) URL.';
			return;
		}

		uploading = true;
		try {
			const form = new FormData();
			form.set('courseId', data.course.id);
			form.set('sourceType', uploadKind);
			form.set('title', sourceTitle.trim());
			if (uploadKind === 'pasted_text') {
				form.set('content', pastedContent);
			} else if (uploadKind === 'webpage') {
				form.set('originUrl', originUrl.trim());
			} else {
				for (const file of files ?? []) form.append('files', file);
			}

			const res = await fetch('/api/sources', { method: 'POST', body: form });
			const body = await res.json();
			if (!res.ok) {
				uploadError = body.error ?? 'Upload failed. Please try again.';
				return;
			}
			// Head straight into extraction + review.
			await goto(`/app/courses/${data.course.id}/sources/${body.sourceId}/review`);
		} catch {
			uploadError = 'Upload failed — check your connection and try again.';
		} finally {
			uploading = false;
		}
	}

	const hasPlayableContent = $derived(data.questionCount > 0);
</script>

<svelte:head><title>{data.course.region_name} — Loreleaf Academy</title></svelte:head>

<nav class="crumbs"><a href="/app">← Archive Isles</a></nav>

<header class="course-head">
	<div>
		<h1>{data.course.region_name}</h1>
		<p class="subtitle">{data.course.title}{data.course.subject ? ` · ${data.course.subject}` : ''}</p>
	</div>
	{#if hasPlayableContent}
		<a class="btn btn--green" href="/app/courses/{data.course.id}/play">Enter region ({data.questionCount} questions)</a>
	{/if}
</header>

<div class="course-grid">
	<section class="panel upload-panel">
		<h2>Add study material</h2>
		<p class="hint">Everything you generate is built only from what you add here — with a View Source link on every question.</p>

		{#if uploadError}
			<div class="error-box">{uploadError}</div>
		{/if}

		<form onsubmit={submitUpload}>
			<label for="kind">Material type</label>
			<select id="kind" bind:value={uploadKind}>
				<option value="image">Photos of notes / worksheets / textbook pages</option>
				<option value="pdf">PDF</option>
				<option value="docx">Word document (.docx)</option>
				<option value="pptx">PowerPoint (.pptx)</option>
				<option value="pasted_text">Pasted notes</option>
				<option value="webpage">Public webpage / article URL</option>
			</select>

			<label for="stitle">Name this source</label>
			<input id="stitle" type="text" bind:value={sourceTitle} maxlength="200" placeholder='e.g. "Biology Chapter 3 — 8 pages"' />

			{#if uploadKind === 'pasted_text'}
				<label for="pasted">Your notes</label>
				<textarea id="pasted" bind:value={pastedContent} placeholder="Paste your notes here…"></textarea>
			{:else if uploadKind === 'webpage'}
				<label for="url">Article URL</label>
				<input id="url" type="url" bind:value={originUrl} placeholder="https://…" />
				<p class="hint">We import the main readable content only — public pages work best.</p>
			{:else if uploadKind === 'image'}
				<label for="files">Photos (up to 8 — they will be grouped as one source)</label>
				<input id="files" type="file" accept={FILE_ACCEPT.image} multiple bind:files />
			{:else if uploadKind === 'docx'}
				<label for="files">Word document</label>
				<input id="files" type="file" accept={FILE_ACCEPT.docx} bind:files />
			{:else if uploadKind === 'pptx'}
				<label for="files">PowerPoint file</label>
				<input id="files" type="file" accept={FILE_ACCEPT.pptx} bind:files />
			{:else}
				<label for="files">PDF file</label>
				<input id="files" type="file" accept={FILE_ACCEPT.pdf} bind:files />
			{/if}

			<button class="btn btn--green" type="submit" disabled={uploading}>
				{uploading ? 'Uploading…' : 'Upload & extract'}
			</button>
		</form>
	</section>

	<section class="sources">
		<h2>Sources</h2>
		{#if data.sources.length === 0}
			<p class="hint">No materials yet. The isle stays misty until you add some.</p>
		{:else}
			<ul class="source-list">
				{#each data.sources as source}
					<li class="panel source-card">
						<div>
							<strong>{source.title}</strong>
							<p class="source-meta">
								{source.source_type === 'image'
									? `${source.storage_paths.length} photo${source.storage_paths.length === 1 ? '' : 's'}`
									: source.source_type}
								· <span class="status status--{source.status}">{STATUS_LABELS[source.status]}</span>
							</p>
							{#if source.status === 'failed' && source.error_message}
								<p class="source-error">{source.error_message}</p>
							{/if}
						</div>
						<div class="source-actions">
							{#if source.status === 'needs_review' || source.status === 'uploaded' || source.status === 'extracting'}
								<a class="btn btn--small" href="/app/courses/{data.course.id}/sources/{source.id}/review">Check extracted text</a>
							{:else if source.status === 'confirmed' || source.status === 'failed'}
								<a class="btn btn--small" href="/app/courses/{data.course.id}/sources/{source.id}/review">Open</a>
							{:else if source.status === 'ready'}
								<span class="badge badge--green">Ready</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
			<button class="btn btn--small btn--ghost" onclick={() => invalidateAll()}>Refresh statuses</button>
		{/if}
	</section>
</div>

<style>
	.crumbs { margin-bottom: 0.6rem; }
	.course-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.2rem;
	}
	.subtitle { color: var(--ink-soft); margin: 0; }
	.course-grid { display: grid; gap: 1.5rem; }
	@media (min-width: 820px) {
		.course-grid { grid-template-columns: 1fr 1fr; align-items: start; }
	}
	.hint { color: var(--ink-soft); font-size: 0.95rem; }
	.source-list { list-style: none; padding: 0; margin: 0 0 0.8rem; display: grid; gap: 0.7rem; }
	.source-card { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 0.9rem 1rem; }
	.source-meta { margin: 0.2rem 0 0; font-size: 0.9rem; color: var(--ink-soft); }
	.source-error { color: var(--danger); font-size: 0.9rem; margin: 0.3rem 0 0; }
	.status--ready { color: var(--green-deep); }
	.status--failed { color: var(--danger); }
</style>
