<script lang="ts">
	/**
	 * Ads scaffold. Placements are feature-flagged server-side and OFF by
	 * default; this component renders nothing unless its flag is enabled.
	 *
	 * Product rules enforced here and in the rewarded route:
	 * - banner: hub/meta screens only — never mounted on study screens
	 * - interstitial: safe breakpoints only (session summary, region complete)
	 * - rewarded: opt-in, grants coins/cosmetic currency ONLY — never study
	 *   content, answers, or any academic advantage
	 */
	interface Props {
		placement: 'banner' | 'rewarded' | 'interstitial';
		enabled: boolean;
		context: string;
		rewardCoins?: number;
		onRewardGranted?: (coins: number) => void;
	}

	let { placement, enabled, context, rewardCoins = 15, onRewardGranted }: Props = $props();

	let watching = $state(false);
	let done = $state(false);
	let logged = false;

	async function logEvent(eventType: string) {
		try {
			await fetch('/api/ads/events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ placement, eventType, context })
			});
		} catch {
			// ad telemetry must never break the app
		}
	}

	$effect(() => {
		if (enabled && !logged) {
			logged = true;
			void logEvent('impression');
		}
	});

	async function watchRewarded() {
		watching = true;
		// Placeholder for a real ad SDK callback; the reward itself is granted
		// server-side so the client can't mint coins.
		try {
			const res = await fetch('/api/ads/reward', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ context })
			});
			if (res.ok) {
				const { coins } = await res.json();
				done = true;
				onRewardGranted?.(coins);
			}
		} finally {
			watching = false;
		}
	}
</script>

{#if enabled}
	{#if placement === 'banner'}
		<aside class="ad ad--banner" aria-label="Advertisement">
			<span class="ad-tag">Ad</span>
			<span class="ad-placeholder">Banner ad slot ({context})</span>
		</aside>
	{:else if placement === 'rewarded'}
		<aside class="ad ad--rewarded" aria-label="Optional rewarded ad">
			{#if done}
				<span>Thanks for watching! Coins added.</span>
			{:else}
				<span>Optional: watch a short ad for +{rewardCoins} coins (cosmetics only — never affects studying).</span>
				<button class="btn btn--small" disabled={watching} onclick={watchRewarded}>
					{watching ? 'Playing ad…' : 'Watch ad'}
				</button>
			{/if}
		</aside>
	{:else}
		<aside class="ad ad--interstitial" aria-label="Advertisement">
			<span class="ad-tag">Ad</span>
			<span class="ad-placeholder">Interstitial slot — safe breakpoint: {context}</span>
		</aside>
	{/if}
{/if}

<style>
	.ad {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		border: 2px dashed var(--ink-soft);
		border-radius: 4px;
		background: var(--cream-deep);
		color: var(--ink-soft);
		font-size: 0.9rem;
		padding: 0.6rem 0.9rem;
		margin: 1rem 0;
	}
	.ad-tag {
		font-family: var(--font-pixel);
		font-size: 0.7rem;
		border: 1px solid var(--ink-soft);
		border-radius: 2px;
		padding: 0 0.3rem;
	}
</style>
