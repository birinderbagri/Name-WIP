import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase-admin';
import { consumeUsage, UsageLimitError } from '$lib/server/usage';
import { getParser } from '$lib/server/ingestion/parsers';
import type { RequestHandler } from './$types';

const MAX_FILES = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED: Record<string, { mimes: string[]; extensions: Record<string, string> }> = {
	image: {
		mimes: ['image/png', 'image/jpeg', 'image/webp'],
		extensions: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
	},
	pdf: {
		mimes: ['application/pdf'],
		extensions: { 'application/pdf': 'pdf' }
	},
	docx: {
		mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
		extensions: {
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
		}
	},
	pptx: {
		mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
		extensions: {
			'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
		}
	}
};

// Formats that upload a single file (one file per source, like PDF).
const SINGLE_FILE_TYPES = new Set(['pdf', 'docx', 'pptx']);

/**
 * POST /api/sources — create a source record and store raw files privately.
 * multipart form: courseId, sourceType (image|pdf|pasted_text), title,
 * files[] or content.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ error: 'Expected multipart form data.' }, { status: 400 });
	}

	const courseId = String(form.get('courseId') ?? '');
	const sourceType = String(form.get('sourceType') ?? '');
	const title = String(form.get('title') ?? '').trim();

	if (!courseId || !title || title.length > 200) {
		return json({ error: 'courseId and a title (max 200 chars) are required.' }, { status: 400 });
	}
	if (!['image', 'pdf', 'pasted_text', 'docx', 'pptx', 'webpage'].includes(sourceType)) {
		return json({ error: 'Unsupported source type.' }, { status: 400 });
	}

	// Ownership check — the course must belong to the caller.
	const { data: course } = await locals.supabase
		.from('courses')
		.select('id')
		.eq('id', courseId)
		.eq('user_id', userId)
		.single();
	if (!course) {
		return json({ error: 'Course not found.' }, { status: 404 });
	}

	try {
		await consumeUsage(userId, 'uploads');
	} catch (err) {
		if (err instanceof UsageLimitError) return json({ error: err.message }, { status: 429 });
		throw err;
	}

	// Validate payload before creating anything.
	let files: File[] = [];
	let pastedContent = '';
	let originUrl: string | null = null;
	if (sourceType === 'pasted_text') {
		pastedContent = String(form.get('content') ?? '').trim();
		if (pastedContent.length < 20 || pastedContent.length > 200_000) {
			return json({ error: 'Pasted notes must be between 20 and 200,000 characters.' }, { status: 400 });
		}
	} else if (sourceType === 'webpage') {
		originUrl = String(form.get('originUrl') ?? '').trim();
		let parsedUrl: URL | null = null;
		try {
			parsedUrl = new URL(originUrl);
		} catch {
			parsedUrl = null;
		}
		if (!parsedUrl || (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')) {
			return json({ error: 'Enter a valid public http(s) URL.' }, { status: 400 });
		}
	} else {
		files = form.getAll('files').filter((f): f is File => f instanceof File);
		const rules = ALLOWED[sourceType];
		if (files.length === 0) return json({ error: 'No files provided.' }, { status: 400 });
		if (SINGLE_FILE_TYPES.has(sourceType) && files.length > 1) {
			return json({ error: 'Upload one file at a time for this format.' }, { status: 400 });
		}
		if (files.length > MAX_FILES) {
			return json({ error: `At most ${MAX_FILES} photos per source.` }, { status: 400 });
		}
		for (const file of files) {
			if (!rules.mimes.includes(file.type)) {
				return json({ error: `Unsupported file type: ${file.type || 'unknown'}.` }, { status: 400 });
			}
			if (file.size > MAX_FILE_BYTES) {
				return json({ error: `"${file.name}" is over the 10 MB limit.` }, { status: 400 });
			}
		}
	}

	const { data: source, error: sourceError } = await supabaseAdmin
		.from('sources')
		.insert({
			course_id: courseId,
			user_id: userId,
			source_type: sourceType,
			title,
			status: 'uploaded',
			origin_url: originUrl
		})
		.select('id')
		.single();
	if (sourceError || !source) {
		return json({ error: 'Could not create the source record.' }, { status: 500 });
	}

	if (sourceType === 'pasted_text') {
		// No raw file: run the (local, fast) parser inline and go straight
		// to review.
		try {
			const parser = getParser('pasted_text');
			const chunks = await parser.extract(
				{
					id: source.id,
					user_id: userId,
					course_id: courseId,
					source_type: 'pasted_text',
					title,
					storage_paths: [],
					origin_url: null
				},
				{ admin: supabaseAdmin, inlineContent: pastedContent }
			);
			const { error: chunkError } = await supabaseAdmin.from('source_chunks').insert(
				chunks.map((c) => ({
					source_id: source.id,
					user_id: userId,
					source_type: 'pasted_text',
					chunk_index: c.chunkIndex,
					location_label: c.locationLabel,
					content: c.content,
					storage_path_index: c.storagePathIndex,
					metadata_json: c.metadata ?? null
				}))
			);
			if (chunkError) throw new Error(chunkError.message);
			await supabaseAdmin.from('sources').update({ status: 'needs_review' }).eq('id', source.id);
		} catch (err) {
			await supabaseAdmin
				.from('sources')
				.update({ status: 'failed', error_message: (err as Error).message })
				.eq('id', source.id);
		}
		return json({ sourceId: source.id });
	}

	if (sourceType === 'webpage') {
		// No raw file to store; the review page triggers extraction, which
		// fetches origin_url. Kept out of the request path since it hits the
		// network.
		return json({ sourceId: source.id });
	}

	// Store raw files in the private bucket: {userId}/{sourceId}/{i}.{ext}
	const rules = ALLOWED[sourceType];
	const paths: string[] = [];
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const ext = rules.extensions[file.type];
		const path = `${userId}/${source.id}/${i}.${ext}`;
		const { error: uploadError } = await supabaseAdmin.storage
			.from('sources')
			.upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
		if (uploadError) {
			await supabaseAdmin
				.from('sources')
				.update({ status: 'failed', error_message: `Upload failed: ${uploadError.message}` })
				.eq('id', source.id);
			return json({ error: 'File upload failed. Please try again.' }, { status: 500 });
		}
		paths.push(path);
	}

	await supabaseAdmin
		.from('sources')
		.update({ storage_paths: paths, page_count: paths.length })
		.eq('id', source.id);

	return json({ sourceId: source.id });
};
