<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let busyItem: string | null = $state(null);

	const itemsBySection = $derived(
		data.items.reduce<Record<string, typeof data.items>>((acc, item) => {
			(acc[item.section_id] ??= []).push(item);
			return acc;
		}, {})
	);

	const ownedCount = $derived(Object.keys(data.ownedMap).length);

	async function toggleEquip(itemId: string, equip: boolean) {
		busyItem = itemId;
		try {
			const res = await fetch('/api/cosmetics/equip', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ cosmeticItemId: itemId, equip })
			});
			if (res.ok) await invalidateAll();
		} finally {
			busyItem = null;
		}
	}
</script>

<svelte:head><title>Cosmetics Shop — Loreleaf Academy</title></svelte:head>

<nav class="crumbs"><a href="/app">← Archive Isles</a></nav>

<header class="shop-head">
	<h1>The Trellis &amp; Thread</h1>
	{#if !data.purchasesEnabled}
		<span class="badge badge--soon">Shop Coming Soon</span>
	{/if}
</header>

<p class="lede">
	Everything here is <strong>purely cosmetic</strong> — outfits, frames, and decorations never
	change question difficulty, answers, XP, or anything about how you learn. Buying with coins is
	still being built, but items marked <span class="badge badge--green">Earnable in game</span> can
	be earned right now by restoring regions, and you can equip anything you own.
</p>

{#if ownedCount > 0}
	<p class="owned-line">You own {ownedCount} cosmetic{ownedCount === 1 ? '' : 's'}.</p>
{/if}

<div class="shop-grid">
	{#each data.sections as section (section.id)}
		<section class="panel shop-section">
			<div class="section-head">
				<h2>{section.name}</h2>
			</div>
			<ul class="item-list">
				{#each itemsBySection[section.id] ?? [] as item (item.id)}
					{@const owned = data.ownedMap[item.id]}
					<li class="item" class:owned={!!owned}>
						<div class="swatch" aria-hidden="true"></div>
						<div class="item-body">
							<strong>{item.name}</strong>
							<p class="item-desc">{item.description}</p>
							<div class="item-tags">
								{#if item.earnable_from === 'gameplay'}
									<span class="badge badge--green">Earnable in game</span>
								{:else if item.earnable_from === 'rewarded_ad'}
									<span class="badge">Rewarded ads later</span>
								{:else}
									<span class="badge badge--soon">Coming Soon</span>
								{/if}
								{#if owned}<span class="badge">Owned</span>{/if}
							</div>
							{#if owned}
								<button
									class="btn btn--small {owned.equipped ? 'btn--ghost' : 'btn--green'}"
									disabled={busyItem === item.id}
									onclick={() => toggleEquip(item.id, !owned.equipped)}
								>
									{owned.equipped ? 'Equipped — remove' : 'Equip'}
								</button>
							{/if}
						</div>
					</li>
				{:else}
					<li class="item-empty">Pieces for this shelf are still on the loom…</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.crumbs { margin-bottom: 0.6rem; }
	.shop-head { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
	.lede { max-width: 70ch; }
	.owned-line { font-family: var(--font-pixel); color: var(--vine); }
	.shop-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}
	.section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.6rem; }
	.item-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.8rem; }
	.item { display: flex; gap: 0.8rem; align-items: flex-start; }
	.item.owned .swatch { opacity: 1; }
	.item-body { flex: 1; }
	.item-desc { margin: 0.1rem 0 0.4rem; font-size: 0.9rem; color: var(--ink-soft); }
	.item-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
	.item-empty { color: var(--ink-soft); font-size: 0.9rem; }
	.swatch {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border: 3px solid var(--ink);
		border-radius: 4px;
		background: linear-gradient(135deg, var(--pink) 0 50%, var(--green) 50% 100%);
		image-rendering: pixelated;
		opacity: 0.75;
	}
</style>
