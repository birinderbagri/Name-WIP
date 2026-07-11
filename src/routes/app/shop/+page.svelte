<script lang="ts">
	let { data } = $props();

	const itemsBySection = $derived(
		Object.groupBy?.(data.items, (item) => item.section_id) ??
			data.items.reduce<Record<string, typeof data.items>>((acc, item) => {
				(acc[item.section_id] ??= []).push(item);
				return acc;
			}, {})
	);
</script>

<svelte:head><title>Cosmetics Shop — Loreleaf Academy</title></svelte:head>

<nav class="crumbs"><a href="/app">← Archive Isles</a></nav>

<header class="shop-head">
	<h1>The Trellis &amp; Thread</h1>
	{#if !data.purchasesEnabled}
		<span class="badge badge--soon">Coming Soon</span>
	{/if}
</header>

<p class="lede">
	The academy's cosmetics boutique is still being decorated. Everything here is
	<strong>purely cosmetic</strong> — outfits, frames, and decorations never change question
	difficulty, answers, XP, or anything about how you learn. Some pieces will also be earnable
	through gameplay{#if data.items.some((i) => i.earnable_from === 'rewarded_ad')}&nbsp;or optional rewarded ads{/if}.
</p>

<div class="shop-grid">
	{#each data.sections as section (section.id)}
		<section class="panel shop-section">
			<div class="section-head">
				<h2>{section.name}</h2>
				{#if section.is_coming_soon && !data.purchasesEnabled}
					<span class="badge badge--soon">Coming Soon</span>
				{/if}
			</div>
			<ul class="item-list">
				{#each itemsBySection[section.id] ?? [] as item (item.id)}
					<li class="item">
						<div class="swatch" aria-hidden="true"></div>
						<div>
							<strong>{item.name}</strong>
							<p class="item-desc">{item.description}</p>
							{#if item.earnable_from === 'gameplay'}
								<span class="badge badge--green">Earnable in game</span>
							{:else if item.earnable_from === 'rewarded_ad'}
								<span class="badge">Rewarded ads later</span>
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
	.shop-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}
	.section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.6rem; }
	.item-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.8rem; }
	.item { display: flex; gap: 0.8rem; align-items: flex-start; }
	.item-desc { margin: 0.1rem 0 0.3rem; font-size: 0.9rem; color: var(--ink-soft); }
	.item-empty { color: var(--ink-soft); font-size: 0.9rem; }
	.swatch {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border: 3px solid var(--ink);
		border-radius: 4px;
		background:
			linear-gradient(135deg, var(--pink) 0 50%, var(--green) 50% 100%);
		image-rendering: pixelated;
		opacity: 0.75;
	}
</style>
