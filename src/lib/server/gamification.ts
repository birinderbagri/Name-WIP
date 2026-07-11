import { supabaseAdmin } from '$lib/server/supabase-admin';

// ------------------------------------------------------------
// XP / levels — no purchasable power anywhere in this module.
// ------------------------------------------------------------

export const XP_CORRECT = 10;
export const XP_REDEMPTION_BONUS = 8; // recovering a previously missed concept
export const XP_BOSS_MULTIPLIER = 2;
export const COINS_CORRECT = 2;
export const FOCUS_CHAIN_STEP = 2; // bonus XP per chain link, capped
export const FOCUS_CHAIN_CAP = 10;

export function xpForAttempt(input: {
	isCorrect: boolean;
	focusChain: number;
	wasRedemption: boolean;
	inBossBattle: boolean;
}): { xp: number; coins: number } {
	if (!input.isCorrect) return { xp: 0, coins: 0 };
	let xp = XP_CORRECT + Math.min(input.focusChain, FOCUS_CHAIN_CAP) * FOCUS_CHAIN_STEP;
	if (input.wasRedemption) xp += XP_REDEMPTION_BONUS;
	if (input.inBossBattle) xp *= XP_BOSS_MULTIPLIER;
	return { xp, coins: COINS_CORRECT };
}

/** Level curve: level n requires n*100 cumulative XP beyond the last level. */
export function levelForXp(totalXp: number): number {
	let level = 1;
	let threshold = 0;
	while (totalXp >= threshold + level * 100) {
		threshold += level * 100;
		level += 1;
	}
	return level;
}

export function xpProgressWithinLevel(totalXp: number): { current: number; needed: number } {
	let level = 1;
	let threshold = 0;
	while (totalXp >= threshold + level * 100) {
		threshold += level * 100;
		level += 1;
	}
	return { current: totalXp - threshold, needed: level * 100 };
}

// ------------------------------------------------------------
// Attempt application — single write path for XP, coins, streaks,
// creature mastery, and course progress. Called from the attempts route
// after ownership checks.
// ------------------------------------------------------------

export interface AttemptOutcome {
	xpGained: number;
	coinsGained: number;
	wasRedemption: boolean;
	newLevel: number;
	creatureLeveledUp: boolean;
}

export async function applyAttempt(params: {
	userId: string;
	questionId: string;
	courseId: string;
	isCorrect: boolean;
	answerGiven?: string;
	focusChain: number;
	inBossBattle: boolean;
}): Promise<AttemptOutcome> {
	const { userId, questionId, courseId, isCorrect, answerGiven, focusChain, inBossBattle } = params;

	// Redemption: correct now on a question previously answered wrong.
	let wasRedemption = false;
	if (isCorrect) {
		const { count } = await supabaseAdmin
			.from('user_question_attempts')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', userId)
			.eq('question_id', questionId)
			.eq('is_correct', false);
		wasRedemption = (count ?? 0) > 0;
	}

	const { error: attemptError } = await supabaseAdmin.from('user_question_attempts').insert({
		user_id: userId,
		question_id: questionId,
		course_id: courseId,
		is_correct: isCorrect,
		answer_given: answerGiven ?? null,
		focus_chain: focusChain,
		was_redemption: wasRedemption,
		in_boss_battle: inBossBattle
	});
	if (attemptError) throw new Error(`Could not record attempt: ${attemptError.message}`);

	const { xp, coins } = xpForAttempt({ isCorrect, focusChain, wasRedemption, inBossBattle });

	// Profile: XP, coins, level, streak.
	const { data: profile, error: profileError } = await supabaseAdmin
		.from('profiles')
		.select('xp, coins, streak_days, last_study_date')
		.eq('id', userId)
		.single();
	if (profileError || !profile) throw new Error('Profile not found.');

	const newXp = profile.xp + xp;
	const newLevel = levelForXp(newXp);

	const today = new Date().toISOString().slice(0, 10);
	let streak = profile.streak_days;
	if (profile.last_study_date !== today) {
		const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
		streak = profile.last_study_date === yesterday ? streak + 1 : 1;
	}

	const { error: updateError } = await supabaseAdmin
		.from('profiles')
		.update({
			xp: newXp,
			coins: profile.coins + coins,
			level: newLevel,
			streak_days: streak,
			last_study_date: today
		})
		.eq('id', userId);
	if (updateError) throw new Error(`Could not update profile: ${updateError.message}`);

	// Creature mastery: the active Memosprite levels up through repeated
	// correct answers — mastery, never purchases.
	let creatureLeveledUp = false;
	if (isCorrect) {
		const { data: creature } = await supabaseAdmin
			.from('user_creatures')
			.select('id, level, mastery_xp')
			.eq('user_id', userId)
			.eq('is_active', true)
			.maybeSingle();
		if (creature) {
			const masteryXp = creature.mastery_xp + xp;
			const creatureLevel = levelForXp(masteryXp);
			creatureLeveledUp = creatureLevel > creature.level;
			await supabaseAdmin
				.from('user_creatures')
				.update({ mastery_xp: masteryXp, level: creatureLevel })
				.eq('id', creature.id);
		}
	}

	return { xpGained: xp, coinsGained: coins, wasRedemption, newLevel, creatureLeveledUp };
}

/**
 * Weak topics for review zones: topics whose most recent attempt per
 * question is wrong become "shadow concepts".
 */
export async function shadowConceptQuestionIds(userId: string, courseId: string): Promise<string[]> {
	const { data: attempts } = await supabaseAdmin
		.from('user_question_attempts')
		.select('question_id, is_correct, created_at')
		.eq('user_id', userId)
		.eq('course_id', courseId)
		.order('created_at', { ascending: true });
	if (!attempts) return [];
	const latest = new Map<string, boolean>();
	for (const a of attempts) latest.set(a.question_id, a.is_correct);
	return [...latest.entries()].filter(([, correct]) => !correct).map(([id]) => id);
}
