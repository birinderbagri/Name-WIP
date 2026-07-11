<script lang="ts">
	import GameCanvas from '$lib/game/GameCanvas.svelte';
	import BattleModal from '$lib/components/BattleModal.svelte';
	import SourceViewer from '$lib/components/SourceViewer.svelte';
	import AdSlot from '$lib/components/AdSlot.svelte';
	import { generateRegionMap, type StudyNodePlacement } from '$lib/game/map';
	import type { BattleQuestion, AttemptReward, BattleResult } from '$lib/types';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Deterministic seed from the course id so the island layout is stable.
	function hashSeed(id: string): number {
		let h = 2166136261;
		for (let i = 0; i < id.length; i++) {
			h ^= id.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}

	const BOSS_QUESTION_COUNT = 8;

	const allQuestions = data.questions as BattleQuestion[];
	const questionById = new Map(allQuestions.map((q) => [q.id, q]));

	// Boss trial: a timed test sampled across the course's questions.
	const bossQuestionIds = allQuestions
		.map((q) => q.id)
		.filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / BOSS_QUESTION_COUNT)) === 0)
		.slice(0, BOSS_QUESTION_COUNT);

	const map = generateRegionMap({
		seed: hashSeed(data.course.id),
		questionIds: allQuestions.filter((q) => !q.is_boss).map((q) => q.id),
		bossQuestionIds,
		reviewQuestionIds: data.shadowQuestionIds
	});

	let clearedNodes: string[] = $state([...((data.save?.cleared_nodes_json as string[]) ?? [])]);
	let activeNode: StudyNodePlacement | null = $state(null);
	let sessionSummary: (BattleResult & { bossWon: boolean; kind: string }) | null = $state(null);
	let saveFailed = $state(false);

	let viewer = $state({
		open: false,
		locationLabel: '',
		sourceTitle: '',
		content: '',
		fileUrl: null as string | null,
		fileKind: null as 'image' | 'pdf' | null
	});

	const startX = data.save?.player_x ?? map.spawn.x;
	const startY = data.save?.player_y ?? map.spawn.y;
	let lastPos = { x: startX, y: startY };

	const studyNodeIds = map.nodes.filter((n) => n.kind === 'study').map((n) => n.id);
	const bossUnlocked = $derived(
		data.bossDefeated || studyNodeIds.every((id) => clearedNodes.includes(id))
	);

	const battleQuestions: BattleQuestion[] = $derived.by(() => {
		const node = activeNode;
		if (!node) return [];
		return node.questionIds
			.map((id) => questionById.get(id))
			.filter((q): q is BattleQuestion => q !== undefined);
	});

	async function persistSave() {
		saveFailed = false;
		try {
			const res = await fetch('/api/game/save', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					courseId: data.course.id,
					playerX: lastPos.x,
					playerY: lastPos.y,
					clearedNodes
				})
			});
			if (!res.ok) saveFailed = true;
		} catch {
			saveFailed = true;
		}
	}

	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	function onMove(x: number, y: number) {
		lastPos = { x, y };
		clearTimeout(saveTimer);
		saveTimer = setTimeout(persistSave, 1200);
	}

	function onNodeEnter(node: StudyNodePlacement) {
		if (node.questionIds.length === 0) return;
		sessionSummary = null;
		activeNode = node;
	}

	async function onAttempt(
		question: BattleQuestion,
		isCorrect: boolean,
		answerGiven: string,
		focusChain: number
	): Promise<AttemptReward> {
		const res = await fetch('/api/attempts', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				questionId: question.id,
				courseId: data.course.id,
				isCorrect,
				answerGiven,
				focusChain,
				inBossBattle: activeNode?.kind === 'boss'
			})
		});
		if (!res.ok) throw new Error('attempt failed');
		return res.json();
	}

	async function onViewSource(question: BattleQuestion) {
		try {
			const res = await fetch(`/api/source-links/${question.source_chunk_id}`);
			if (!res.ok) return;
			const body = await res.json();
			viewer = {
				open: true,
				locationLabel: body.locationLabel,
				sourceTitle: body.sourceTitle,
				content: body.content,
				fileUrl: body.fileUrl,
				fileKind: body.fileKind
			};
		} catch {
			// leave the battle view as-is
		}
	}

	async function onBattleComplete(result: BattleResult & { bossWon: boolean }) {
		const node = activeNode;
		activeNode = null;
		if (!node) return;

		if (node.kind === 'boss') {
			if (result.bossWon) {
				clearedNodes = [...clearedNodes, node.id];
				try {
					await fetch('/api/game/boss', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							courseId: data.course.id,
							correct: result.correct,
							total: result.total
						})
					});
				} catch {
					saveFailed = true;
				}
			}
		} else {
			clearedNodes = [...clearedNodes, node.id];
		}

		sessionSummary = { ...result, kind: node.kind };
		await persistSave();
		await invalidateAll(); // refresh XP/coins in the top bar
	}
</script>

<svelte:head><title>{data.course.region_name} — exploring</title></svelte:head>

<nav class="crumbs"><a href="/app/courses/{data.course.id}">← Leave region</a></nav>

<header class="play-head">
	<h1>{data.course.region_name}</h1>
	<p class="companion">
		Traveling with <strong>{data.creature.name}</strong> (Lv {data.creature.level})
		{#if data.bossDefeated}<span class="badge badge--green">Region restored</span>{/if}
	</p>
</header>

{#if saveFailed}
	<div class="error-box">
		Progress didn't save. <button class="btn btn--small" onclick={persistSave}>Retry save</button>
	</div>
{/if}

<div class="legend panel">
	<span>Glowing tome = study battle</span>
	<span>Stone gate = boss trial (clear every tome first)</span>
	{#if data.shadowQuestionIds.length > 0}
		<span>Dark wisp = shadow concepts to redeem</span>
	{/if}
</div>

<GameCanvas
	{map}
	{clearedNodes}
	{bossUnlocked}
	{startX}
	{startY}
	{onNodeEnter}
	{onMove}
	inputLocked={activeNode !== null}
/>

{#if sessionSummary}
	<div class="panel session-summary">
		<h3>
			{#if sessionSummary.kind === 'boss'}
				{sessionSummary.bossWon ? 'The gate opens — region restored!' : 'The boss endures.'}
			{:else if sessionSummary.kind === 'review'}
				Shadow concepts faced!
			{:else}
				Node cleared!
			{/if}
		</h3>
		<p>
			{sessionSummary.correct}/{sessionSummary.total} correct · +{sessionSummary.xpGained} XP · +{sessionSummary.coinsGained} coins
		</p>
		<!-- Interstitial slot: session summary is a safe breakpoint — never during active studying. -->
		<AdSlot placement="interstitial" enabled={data.adFlags.interstitial} context="session_summary" />
	</div>
{/if}

{#if activeNode && battleQuestions.length > 0}
	<BattleModal
		questions={battleQuestions}
		isBoss={activeNode.kind === 'boss'}
		isReview={activeNode.kind === 'review'}
		creatureSpriteKey={data.creature.spriteKey}
		creatureName={data.creature.name}
		{onAttempt}
		{onViewSource}
		onComplete={onBattleComplete}
		onFlee={() => (activeNode = null)}
	/>
{/if}

<SourceViewer
	open={viewer.open}
	locationLabel={viewer.locationLabel}
	sourceTitle={viewer.sourceTitle}
	chunkContent={viewer.content}
	fileUrl={viewer.fileUrl}
	fileKind={viewer.fileKind}
	onClose={() => (viewer = { ...viewer, open: false })}
/>

<style>
	.crumbs { margin-bottom: 0.6rem; }
	.play-head { margin-bottom: 0.8rem; }
	.companion { margin: 0; color: var(--ink-soft); }
	.legend {
		display: flex;
		gap: 1.2rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
		font-family: var(--font-pixel);
		padding: 0.6rem 1rem;
		margin-bottom: 1rem;
	}
	.session-summary { margin-top: 1rem; }
</style>
