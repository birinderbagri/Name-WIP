<script lang="ts">
	import CreatureSprite from '$lib/components/CreatureSprite.svelte';
</script>

<svelte:head>
	<title>Loreleaf Academy — study your own notes, restore the Archive Isles</title>
	<meta
		name="description"
		content="Upload your notes, worksheets, and PDFs. Loreleaf Academy turns them into a cozy pixel-art study RPG — every question grounded in your own material."
	/>
</svelte:head>

<main class="container landing">
	<header class="hero panel">
		<div class="hero-text">
			<h1>Loreleaf Academy</h1>
			<p class="tagline">
				You are a Knowledge Ranger. Upload your own study materials and restore the
				<strong>Archive Isles</strong> — one question battle at a time.
			</p>
			<ul class="promises">
				<li>Every question is generated <strong>only from your uploads</strong> — photos of notes, PDFs, or pasted text.</li>
				<li>Every card and question has a <strong>View Source</strong> button linking back to the exact page or photo.</li>
				<li>Raise a Memosprite that levels up with your mastery — never with your wallet.</li>
			</ul>
			<div class="cta">
				<a class="btn btn--green" href="/signup">Begin your expedition</a>
				<a class="btn btn--ghost" href="/login">I have an account</a>
			</div>
		</div>
		<div class="hero-sprite">
			<CreatureSprite spriteKey="sproutome" scale={7} />
			<p class="sprite-caption">Sproutome, the seedling notebook</p>
		</div>
	</header>

	<section class="steps">
		<div class="panel step">
			<h3>1. Upload</h3>
			<p>Photograph handwritten notes, drop in a PDF, or paste your notes. Check and fix the extracted text before anything is generated.</p>
		</div>
		<div class="panel step">
			<h3>2. Explore</h3>
			<p>Your course becomes an island region with study trails, flashcard groves, and a boss gate guarding course completion.</p>
		</div>
		<div class="panel step">
			<h3>3. Master</h3>
			<p>Missed concepts return as shadow concepts in review zones. Redeem them for recovery XP and watch your Memosprite bloom.</p>
		</div>
	</section>
</main>

<style>
	.landing { padding-top: 3rem; }
	.hero {
		display: flex;
		gap: 2rem;
		align-items: center;
		flex-wrap: wrap;
		padding: 2rem;
	}
	.hero-text { flex: 1 1 380px; }
	.tagline { font-size: 1.15rem; }
	.promises { padding-left: 1.2rem; }
	.promises li { margin-bottom: 0.4rem; }
	.cta { display: flex; gap: 0.8rem; margin-top: 1.2rem; flex-wrap: wrap; }
	.hero-sprite { text-align: center; }
	.sprite-caption { font-family: var(--font-pixel); font-size: 0.85rem; color: var(--ink-soft); }
	.steps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
		margin-top: 1.5rem;
	}
</style>
