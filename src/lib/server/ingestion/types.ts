import type { SupabaseClient } from '@supabase/supabase-js';

export type SourceType = 'image' | 'pdf' | 'pptx' | 'docx' | 'webpage' | 'pasted_text';

export interface SourceRecord {
	id: string;
	user_id: string;
	course_id: string;
	source_type: SourceType;
	title: string;
	storage_paths: string[];
	origin_url: string | null;
}

/** A normalized content unit produced by a parser, pre-confirmation. */
export interface ExtractedChunk {
	chunkIndex: number;
	locationLabel: string;
	content: string;
	/** Index into sources.storage_paths for the raw file this came from. */
	storagePathIndex: number | null;
	boundingBoxes?: unknown;
	metadata?: Record<string, unknown>;
}

export interface ParserContext {
	/** Service-role client for reading the private raw file. */
	admin: SupabaseClient;
	/** Pasted text / webpage HTML when no storage file exists. */
	inlineContent?: string;
}

/**
 * Each input format implements this interface. Adding DOCX/PPTX/webpage
 * support later means adding one module and registering it — nothing else
 * in the pipeline changes.
 */
export interface SourceParser {
	sourceType: SourceType;
	extract(source: SourceRecord, ctx: ParserContext): Promise<ExtractedChunk[]>;
}
