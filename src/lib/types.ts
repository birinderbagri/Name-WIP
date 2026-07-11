// Shared client-facing types (rows as served by load functions).

export type QuestionType = 'multiple_choice' | 'true_false' | 'typing' | 'matching' | 'ordering';

export interface AnswerJson {
	options?: string[];
	correct_index?: number;
	correct_answer?: boolean;
	accepted_answers?: string[];
}

export interface BattleQuestion {
	id: string;
	prompt: string;
	question_type: QuestionType;
	answer_json: AnswerJson;
	explanation: string;
	topic: string;
	location_label: string;
	source_id: string;
	source_chunk_id: string;
	is_boss: boolean;
}

export interface AttemptReward {
	xpGained: number;
	coinsGained: number;
	wasRedemption: boolean;
	newLevel: number;
	creatureLeveledUp: boolean;
}

export interface BattleResult {
	total: number;
	correct: number;
	xpGained: number;
	coinsGained: number;
}

export interface ProfileRow {
	id: string;
	display_name: string;
	xp: number;
	level: number;
	coins: number;
	streak_days: number;
}
