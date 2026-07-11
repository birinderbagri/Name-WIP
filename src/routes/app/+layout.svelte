<script lang="ts">
	import { xpProgressWithinLevel } from '$lib/xp';

	let { data, children } = $props();

	const progress = $derived(xpProgressWithinLevel(data.profile.xp));
</script>

<div class="app-shell">
	<header class="topbar">
		<a href="/app" class="brand">Loreleaf Academy</a>
		<div class="stats" aria-label="Your stats">
			<span class="stat" title="Level">Lv {data.profile.level}</span>
			<span class="xp-bar" title="{progress.current} / {progress.needed} XP">
				<span class="xp-fill" style="width: {(progress.current / progress.needed) * 100}%"></span>
			</span>
			<span class="stat" title="Coins">{data.profile.coins} coins</span>
			<span class="stat" title="Study streak">{data.profile.streak_days} day streak</span>
		</div>
		<nav class="topnav">
			<a class="btn btn--small btn--ghost" href="/app/leaderboard">Leaderboard</a>
			<a class="btn btn--small btn--ghost" href="/app/shop">Shop <span class="badge badge--soon">Soon</span></a>
			<form method="POST" action="/logout">
				<button class="btn btn--small btn--ghost" type="submit">Sign out</button>
			</form>
		</nav>
	</header>

	<main class="container">
		{@render children()}
	</main>
</div>

<style>
	.topbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		background: var(--parchment);
		border-bottom: 3px solid var(--ink);
		padding: 0.6rem 1rem;
	}
	.brand {
		font-family: var(--font-pixel);
		font-weight: 700;
		font-size: 1.15rem;
		color: var(--vine);
		text-decoration: none;
	}
	.stats {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex: 1;
		flex-wrap: wrap;
	}
	.stat { font-family: var(--font-pixel); font-size: 0.9rem; }
	.xp-bar {
		display: inline-block;
		width: 110px;
		height: 10px;
		border: 2px solid var(--ink);
		border-radius: 3px;
		background: var(--cream-deep);
		overflow: hidden;
	}
	.xp-fill { display: block; height: 100%; background: var(--green); }
	.topnav { display: flex; gap: 0.5rem; align-items: center; }
</style>
