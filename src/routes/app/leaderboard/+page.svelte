<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let mode: 'none' | 'create' | 'join' = $state('none');
	let className = $state('');
	let joinCode = $state('');
	let busy = $state(false);
	let message: string | null = $state(null);
	let errorMessage: string | null = $state(null);

	async function submit() {
		busy = true;
		message = null;
		errorMessage = null;
		try {
			const payload =
				mode === 'create'
					? { action: 'create', name: className.trim() }
					: { action: 'join', joinCode: joinCode.trim() };
			const res = await fetch('/api/classes', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await res.json();
			if (!res.ok) {
				errorMessage = body.error ?? 'Something went wrong.';
				return;
			}
			if (mode === 'create') message = `Class created! Share code: ${body.joinCode}`;
			mode = 'none';
			className = '';
			joinCode = '';
			await invalidateAll();
		} catch {
			errorMessage = 'Something went wrong — check your connection.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Leaderboards — Loreleaf Academy</title></svelte:head>

<nav class="crumbs"><a href="/app">← Archive Isles</a></nav>

<header class="lb-head">
	<h1>Class Leaderboards</h1>
	<div class="lb-actions">
		<button class="btn btn--small" onclick={() => (mode = mode === 'create' ? 'none' : 'create')}>Create class</button>
		<button class="btn btn--small btn--ghost" onclick={() => (mode = mode === 'join' ? 'none' : 'join')}>Join with code</button>
	</div>
</header>

<p class="lede">
	Leaderboards are optional and purely social — they rank classmates by XP earned from studying.
	Joining a class never changes your questions, difficulty, or rewards.
</p>

{#if message}<div class="panel note">{message}</div>{/if}
{#if errorMessage}<div class="error-box">{errorMessage}</div>{/if}

{#if mode === 'create'}
	<div class="panel form-panel">
		<label for="cname">Class name</label>
		<input id="cname" type="text" bind:value={className} maxlength="80" placeholder="e.g. Ms. Fern's Biology" />
		<button class="btn btn--green" disabled={busy || !className.trim()} onclick={submit}>Create</button>
	</div>
{:else if mode === 'join'}
	<div class="panel form-panel">
		<label for="jcode">Join code</label>
		<input id="jcode" type="text" bind:value={joinCode} maxlength="12" placeholder="e.g. ABC234" style="text-transform: uppercase" />
		<button class="btn btn--green" disabled={busy || !joinCode.trim()} onclick={submit}>Join</button>
	</div>
{/if}

{#if data.classes.length === 0}
	<div class="panel empty">
		<p>You're not in a class yet. Create one and share the code with classmates, or join an existing class to compare progress.</p>
	</div>
{:else}
	{#each data.classes as cls (cls.id)}
		<section class="panel class-board">
			<div class="board-head">
				<h2>{cls.name}</h2>
				{#if cls.owner_id === data.currentUserId}
					<span class="badge">Code: {cls.join_code}</span>
				{/if}
			</div>
			<ol class="board">
				{#each data.boards[cls.id] ?? [] as row, i (row.user_id)}
					<li class="board-row" class:me={row.user_id === data.currentUserId}>
						<span class="rank">{i + 1}</span>
						<span class="name">{row.display_name}{row.user_id === data.currentUserId ? ' (you)' : ''}</span>
						<span class="lvl">Lv {row.level}</span>
						<span class="xp">{row.xp} XP</span>
						<span class="streak">{row.streak_days}d</span>
					</li>
				{/each}
			</ol>
		</section>
	{/each}
{/if}

<style>
	.crumbs { margin-bottom: 0.6rem; }
	.lb-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
	.lb-actions { display: flex; gap: 0.5rem; }
	.lede { max-width: 70ch; }
	.note { border-left: 4px solid var(--green); }
	.form-panel { max-width: 420px; margin-bottom: 1rem; }
	.class-board { margin-bottom: 1rem; }
	.board-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.6rem; }
	.board { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.3rem; }
	.board-row {
		display: grid;
		grid-template-columns: 2rem 1fr auto auto auto;
		gap: 0.8rem;
		align-items: center;
		padding: 0.4rem 0.6rem;
		border: 2px solid transparent;
		border-radius: 4px;
	}
	.board-row:nth-child(odd) { background: var(--cream-deep); }
	.board-row.me { border-color: var(--pink-deep); background: #fbe9f1; }
	.rank { font-family: var(--font-pixel); text-align: center; }
	.lvl, .xp, .streak { font-family: var(--font-pixel); font-size: 0.85rem; }
	.empty { color: var(--ink-soft); }
</style>
