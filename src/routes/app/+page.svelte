<script lang="ts">
	import AdSlot from '$lib/components/AdSlot.svelte';
	import CreatureSprite from '$lib/components/CreatureSprite.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const creatureRow = $derived(data.activeCreature);
	const creature = $derived(
		creatureRow?.creatures as unknown as
			| { name: string; sprite_key: string; description: string }
			| undefined
	);
</script>

<svelte:head><title>Archive Isles — Loreleaf Academy</title></svelte:head>

<h1>Archive Isles</h1>
<p>Welcome back, {data.profile.display_name}. Choose an isle to explore, or chart a new one.</p>

<!-- Banner ads live only on hub/meta screens like this one, never on study screens. -->
<AdSlot placement="banner" enabled={data.adFlags.banner} context="hub" />

<div class="hub-grid">
	<section class="courses">
		<div class="section-head">
			<h2>Your isles</h2>
			<a class="btn btn--green" href="/app/courses/new">+ New course</a>
		</div>

		{#if data.courses.length === 0}
			<div class="panel empty">
				<p>No isles charted yet. Create a course and upload your first study material — a photo of your notes or a PDF — to raise an island from the mist.</p>
			</div>
		{:else}
			<ul class="course-list">
				{#each data.courses as course}
					{@const prog = data.progressByCourse[course.id]}
					<li class="panel course-card">
						<div>
							<h3>{course.region_name}</h3>
							<p class="course-title">{course.title}{course.subject ? ` · ${course.subject}` : ''}</p>
							{#if prog}
								<p class="course-progress">
									{prog.nodes_cleared} nodes cleared
									{#if prog.boss_defeated}<span class="badge badge--green">Boss defeated</span>{/if}
								</p>
							{/if}
						</div>
						<a class="btn" href="/app/courses/{course.id}">Open</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<aside class="sidebar">
		{#if creatureRow && creature}
			<div class="panel creature-card">
				<h3>Your Memosprite</h3>
				<CreatureSprite spriteKey={creature.sprite_key} scale={5} />
				<p><strong>{creature.name}</strong> · Lv {creatureRow.level}</p>
				<p class="creature-desc">{creature.description}</p>
				<p class="creature-note">Grows with your mastery — never with purchases.</p>
			</div>
		{/if}

		<div class="panel shop-card">
			<h3>Cosmetics Shop</h3>
			<p>Outfits, frames, decorations, biome skins…</p>
			<a class="btn btn--ghost" href="/app/shop">
				Visit shop <span class="badge badge--soon">Coming Soon</span>
			</a>
		</div>

		<!-- Rewarded ads: opt-in, coins for cosmetics only. -->
		<AdSlot
			placement="rewarded"
			enabled={data.adFlags.rewarded}
			context="hub"
			onRewardGranted={() => invalidateAll()}
		/>
	</aside>
</div>

<style>
	.hub-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}
	@media (min-width: 760px) {
		.hub-grid { grid-template-columns: 2fr 1fr; }
	}
	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.8rem;
	}
	.course-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.8rem; }
	.course-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.course-title { color: var(--ink-soft); margin: 0; }
	.course-progress { margin: 0.3rem 0 0; font-size: 0.9rem; }
	.sidebar { display: grid; gap: 1rem; align-content: start; }
	.creature-card, .shop-card { text-align: center; }
	.creature-desc { font-size: 0.9rem; }
	.creature-note { font-size: 0.8rem; color: var(--ink-soft); }
	.empty { color: var(--ink-soft); }
</style>
