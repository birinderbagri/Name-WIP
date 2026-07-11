<script lang="ts">
	import type { BattleQuestion, AttemptReward, BattleResult } from '$lib/types';
	import CreatureSprite from './CreatureSprite.svelte';

	interface Props {
		questions: BattleQuestion[];
		isBoss: boolean;
		isReview: boolean;
		creatureSpriteKey: string;
		creatureName: string;
		/** Persists the attempt server-side and returns the reward. */
		onAttempt: (
			question: BattleQuestion,
			isCorrect: boolean,
			answerGiven: string,
			focusChain: number
		) => Promise<AttemptReward>;
		onViewSource: (question: BattleQuestion) => void;
		onComplete: (result: BattleResult & { bossWon: boolean }) => void;
		onFlee: () => void;
	}

	let {
		questions,
		isBoss,
		isReview,
		creatureSpriteKey,
		creatureName,
		onAttempt,
		onViewSource,
		onComplete,
		onFlee
	}: Props = $props();

	const BOSS_SECONDS_PER_QUESTION = 45;
	const BOSS_PASS_RATIO = 0.7;

	let index = $state(0);
	let focusChain = $state(0);
	let correctCount = $state(0);
	let xpTotal = $state(0);
	let coinsTotal = $state(0);
	let phase: 'question' | 'feedback' | 'summary' = $state('question');
	let lastCorrect = $state(false);
	let lastReward: AttemptReward | null = $state(null);
	let typedAnswer = $state('');
	let submitting = $state(false);
	let attemptFailed = $state(false);
	let pendingAnswer: { isCorrect: boolean; answerGiven: string } | null = $state(null);
	let secondsLeft = $state(BOSS_SECONDS_PER_QUESTION);
	let timerHandle: ReturnType<typeof setInterval> | undefined;

	const question = $derived(questions[index]);
	const enemyHp = $derived(questions.length - correctCount);

	$effect(() => {
		if (isBoss && phase === 'question') {
			secondsLeft = BOSS_SECONDS_PER_QUESTION;
			timerHandle = setInterval(() => {
				secondsLeft -= 1;
				if (secondsLeft <= 0) {
					clearInterval(timerHandle);
					void submitAnswer(false, '(time expired)');
				}
			}, 1000);
			return () => clearInterval(timerHandle);
		}
	});

	function checkTyping(q: BattleQuestion, answer: string): boolean {
		const normalized = answer.trim().toLowerCase();
		return (q.answer_json.accepted_answers ?? []).some(
			(accepted) => accepted.trim().toLowerCase() === normalized
		);
	}

	async function submitAnswer(isCorrect: boolean, answerGiven: string) {
		if (submitting || phase !== 'question') return;
		clearInterval(timerHandle);
		submitting = true;
		attemptFailed = false;
		pendingAnswer = { isCorrect, answerGiven };
		try {
			lastReward = await onAttempt(question, isCorrect, answerGiven, focusChain);
			lastCorrect = isCorrect;
			if (isCorrect) {
				correctCount += 1;
				focusChain += 1;
				xpTotal += lastReward.xpGained;
				coinsTotal += lastReward.coinsGained;
			} else {
				focusChain = 0;
			}
			phase = 'feedback';
			pendingAnswer = null;
		} catch {
			// Attempt failed to persist — keep the question up and offer retry
			// instead of silently losing progress.
			attemptFailed = true;
		} finally {
			submitting = false;
		}
	}

	function retrySubmit() {
		if (pendingAnswer) void submitAnswer(pendingAnswer.isCorrect, pendingAnswer.answerGiven);
	}

	function next() {
		typedAnswer = '';
		if (index + 1 >= questions.length) {
			phase = 'summary';
		} else {
			index += 1;
			phase = 'question';
		}
	}

	function finish() {
		const bossWon = isBoss && correctCount >= Math.ceil(questions.length * BOSS_PASS_RATIO);
		onComplete({
			total: questions.length,
			correct: correctCount,
			xpGained: xpTotal,
			coinsGained: coinsTotal,
			bossWon
		});
	}

	const bossPassNeeded = $derived(Math.ceil(questions.length * BOSS_PASS_RATIO));
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label="Question battle">
	<div class="battle panel">
		<header class="battle-head">
			<div class="combatant">
				<CreatureSprite spriteKey={creatureSpriteKey} scale={3} />
				<div>
					<strong>{creatureName}</strong>
					<div class="chain" class:active={focusChain >= 2}>
						Focus Chain ×{focusChain}
					</div>
				</div>
			</div>
			<div class="enemy">
				<strong>
					{#if isBoss}Boss Trial{:else if isReview}Shadow Concept{:else}Wild Question{/if}
				</strong>
				<div class="hp-bar" aria-label="Enemy stamina">
					<div class="hp-fill" style="width: {(enemyHp / questions.length) * 100}%"></div>
				</div>
				<small>{index + 1} / {questions.length}</small>
				{#if isBoss && phase === 'question'}
					<small class="timer" class:low={secondsLeft <= 10}>{secondsLeft}s</small>
				{/if}
			</div>
		</header>

		{#if phase === 'question' && question}
			<div class="panel--dialogue qbox">
				<span class="badge">{question.topic}</span>
				<p class="prompt">{question.prompt}</p>
			</div>

			{#if attemptFailed}
				<div class="error-box">
					That answer didn't save (connection problem).
					<button class="btn btn--small" onclick={retrySubmit}>Retry</button>
				</div>
			{/if}

			{#if question.question_type === 'multiple_choice'}
				<div class="options">
					{#each question.answer_json.options ?? [] as option, i}
						<button
							class="btn btn--ghost option"
							disabled={submitting}
							onclick={() => submitAnswer(i === question.answer_json.correct_index, option)}
						>
							{option}
						</button>
					{/each}
				</div>
			{:else if question.question_type === 'true_false'}
				<div class="options options--row">
					<button
						class="btn btn--green"
						disabled={submitting}
						onclick={() => submitAnswer(question.answer_json.correct_answer === true, 'True')}
					>
						True
					</button>
					<button
						class="btn btn--danger"
						disabled={submitting}
						onclick={() => submitAnswer(question.answer_json.correct_answer === false, 'False')}
					>
						False
					</button>
				</div>
			{:else}
				<form
					class="typing"
					onsubmit={(e) => {
						e.preventDefault();
						submitAnswer(checkTyping(question, typedAnswer), typedAnswer);
					}}
				>
					<input
						type="text"
						bind:value={typedAnswer}
						placeholder="Type your answer"
						aria-label="Your answer"
						disabled={submitting}
					/>
					<button class="btn btn--green" type="submit" disabled={submitting || !typedAnswer.trim()}>
						Answer
					</button>
				</form>
			{/if}

			<button class="btn btn--small btn--ghost flee" onclick={onFlee}>Retreat from battle</button>
		{:else if phase === 'feedback' && question}
			<div class="feedback" class:correct={lastCorrect} class:wrong={!lastCorrect}>
				{#if lastCorrect}
					<h3>Direct hit!</h3>
					<p>
						+{lastReward?.xpGained ?? 0} XP, +{lastReward?.coinsGained ?? 0} coins
						{#if focusChain >= 2}&nbsp;· Focus Chain ×{focusChain} bonus!{/if}
						{#if lastReward?.wasRedemption}&nbsp;· Shadow concept redeemed — recovery XP!{/if}
						{#if lastReward?.creatureLeveledUp}&nbsp;· {creatureName} leveled up!{/if}
					</p>
				{:else}
					<h3>The question strikes back!</h3>
					<p class="correction">{question.explanation}</p>
					<p class="shadow-note">This concept is marked for review — it will reappear as a shadow concept.</p>
				{/if}
				<div class="feedback-actions">
					<button class="btn btn--ghost" onclick={() => onViewSource(question)}>View Source</button>
					<button class="btn btn--green" onclick={next}>
						{index + 1 >= questions.length ? 'Finish' : 'Next'}
					</button>
				</div>
			</div>
		{:else if phase === 'summary'}
			<div class="summary">
				<h3>
					{#if isBoss}
						{correctCount >= bossPassNeeded ? 'Boss defeated!' : 'The boss holds the gate…'}
					{:else}
						Battle complete!
					{/if}
				</h3>
				<p>
					{correctCount} / {questions.length} correct · +{xpTotal} XP · +{coinsTotal} coins
				</p>
				{#if isBoss && correctCount < bossPassNeeded}
					<p>You need {bossPassNeeded} correct to win. Review your shadow concepts and challenge it again.</p>
				{/if}
				<button class="btn btn--green" onclick={finish}>Return to map</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(58, 46, 42, 0.65);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 50;
	}
	.battle {
		width: 100%;
		max-width: 560px;
		max-height: 90vh;
		overflow-y: auto;
	}
	.battle-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.combatant { display: flex; gap: 0.6rem; align-items: center; }
	.chain {
		font-family: var(--font-pixel);
		font-size: 0.8rem;
		color: var(--ink-soft);
	}
	.chain.active { color: var(--pink-deep); }
	.enemy { text-align: right; }
	.hp-bar {
		width: 140px;
		height: 12px;
		border: 2px solid var(--ink);
		border-radius: 3px;
		background: var(--cream-deep);
		margin: 4px 0;
	}
	.hp-fill { height: 100%; background: var(--danger); transition: width 200ms ease; }
	.timer { display: block; font-family: var(--font-pixel); }
	.timer.low { color: var(--danger); }
	.qbox { padding: 1rem; border-radius: 4px; margin-bottom: 1rem; }
	.prompt { font-size: 1.1rem; margin: 0.5rem 0 0; }
	.options { display: grid; gap: 0.5rem; }
	.options--row { grid-template-columns: 1fr 1fr; }
	.option { justify-content: flex-start; text-align: left; font-family: var(--font-body); font-weight: 400; }
	.typing { display: flex; gap: 0.5rem; align-items: flex-start; }
	.flee { margin-top: 1rem; opacity: 0.8; }
	.feedback.correct h3 { color: var(--green-deep); }
	.feedback.wrong h3 { color: var(--danger); }
	.correction {
		background: var(--cream-deep);
		border-left: 4px solid var(--danger);
		padding: 0.6rem 0.8rem;
	}
	.shadow-note { font-size: 0.9rem; color: var(--ink-soft); }
	.feedback-actions, .summary { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
	.summary { flex-direction: column; align-items: flex-start; }
</style>
