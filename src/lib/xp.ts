/**
 * XP curve helpers shared by client UI. Mirrors the server rules in
 * $lib/server/gamification.ts (server remains the authority — the client
 * only uses this for display).
 */
export function xpProgressWithinLevel(totalXp: number): { current: number; needed: number } {
	let level = 1;
	let threshold = 0;
	while (totalXp >= threshold + level * 100) {
		threshold += level * 100;
		level += 1;
	}
	return { current: totalXp - threshold, needed: level * 100 };
}
