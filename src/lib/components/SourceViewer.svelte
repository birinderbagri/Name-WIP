<script lang="ts">
	interface Props {
		open: boolean;
		locationLabel: string;
		sourceTitle: string;
		chunkContent: string;
		/** Signed URL for the original photo/PDF, when the chunk came from a file. */
		fileUrl: string | null;
		fileKind: 'image' | 'pdf' | null;
		onClose: () => void;
	}

	let { open, locationLabel, sourceTitle, chunkContent, fileUrl, fileKind, onClose }: Props =
		$props();
</script>

{#if open}
	<div class="overlay" role="dialog" aria-modal="true" aria-label="View source">
		<div class="panel viewer">
			<div class="viewer-head">
				<h3>View Source</h3>
				<button class="btn btn--small btn--ghost" onclick={onClose}>Close</button>
			</div>
			<p class="origin">
				<span class="badge">{locationLabel}</span>
				<span class="source-title">{sourceTitle}</span>
			</p>

			{#if fileUrl && fileKind === 'image'}
				<img class="original pixel-safe" src={fileUrl} alt="Original uploaded material: {locationLabel}" />
			{:else if fileUrl && fileKind === 'pdf'}
				<a class="btn btn--green" href={fileUrl} target="_blank" rel="noreferrer">
					Open original PDF at {locationLabel}
				</a>
			{/if}

			<h4>Extracted text for this location</h4>
			<pre class="chunk-text">{chunkContent}</pre>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(58, 46, 42, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 60;
	}
	.viewer {
		max-width: 640px;
		width: 100%;
		max-height: 85vh;
		overflow-y: auto;
	}
	.viewer-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 1rem;
	}
	.origin { display: flex; align-items: center; gap: 0.6rem; }
	.source-title { color: var(--ink-soft); font-size: 0.95rem; }
	.original {
		max-width: 100%;
		border: 3px solid var(--ink);
		border-radius: 4px;
		margin-bottom: 1rem;
	}
	.chunk-text {
		white-space: pre-wrap;
		font-family: var(--font-body);
		font-size: 0.95rem;
		background: var(--cream-deep);
		border: 2px solid var(--ink);
		border-radius: 4px;
		padding: 0.8rem;
		max-height: 40vh;
		overflow-y: auto;
	}
</style>
