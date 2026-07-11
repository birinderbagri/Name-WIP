# Loreleaf Academy

A source-grounded, gamified study app. You play a **Knowledge Ranger** restoring the
pixel-art **Archive Isles**: upload your own study materials (photos of notes, PDFs,
pasted text) and each course becomes an explorable island where stepping on study nodes
triggers quick question battles.

**The core trust rule:** every flashcard, question, and explanation is generated *only*
from material you uploaded and confirmed — never from outside knowledge — and every item
carries a **View Source** button that deep-links back to the exact page, photo, or
section it came from.

## Stack

- **SvelteKit** (Svelte 5) — frontend + server routes, deployed to Vercel via `adapter-vercel`
- **Supabase** — Auth, Postgres (full RLS), private Storage buckets
- **Google Gemini API** — server-side only (vision OCR + question generation); the key
  never reaches the browser. Uses Gemini's free tier (Google AI Studio), so there's no
  cost to run this.
- **Zod** — validation of both user requests *and* model output

## Getting started

1. Create a Supabase project, then run in the SQL editor (in order):
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_storage.sql`
   - `supabase/migrations/0003_post_mvp.sql`
   - `supabase/migrations/0004_security_fixes.sql`
   - `supabase/seed.sql`
2. Copy `.env.example` to `.env` and fill in your Supabase URL, anon key, service-role
   key, and a free Gemini API key from [aistudio.google.com](https://aistudio.google.com/apikey).
3. Install and run:

```bash
npm install
npm run dev
```

`npm run check` typechecks; `npm run build` produces a Vercel Build Output
(`.vercel/output`) — use `vercel dev` to preview it locally, or push to a
repo connected to Vercel to deploy.

## Deploying to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket) and import it in the
   [Vercel dashboard](https://vercel.com/new) — it auto-detects SvelteKit.
2. In the project's Settings → Environment Variables, add the same 5 keys
   from `.env`: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
3. Deploy. Every route runs as a Node.js serverless function
   (`adapter-vercel`'s default runtime — not Edge, since several ingestion
   parsers use Node APIs that Edge doesn't support).
4. The `extract` and `generate` API routes set `maxDuration: 60` (the Hobby
   plan's ceiling) since Gemini calls can take longer than Vercel's default
   10s function timeout. **Caveat:** a source with several photos OCRs them
   one at a time, so a large multi-photo batch could still exceed 60s on
   Hobby — keep photo batches modest, or raise `maxDuration` further if the
   account is on Pro.

## Architecture

```
src/
  hooks.server.ts                  Supabase SSR auth + /app and /api guards
  lib/
    server/
      supabase-admin.ts            service-role client + signed URL helper
      gemini.ts                    Gemini client (server-only)
      validation.ts                zod schemas for requests AND model output
      generation.ts                source-grounded question generation
      gamification.ts              XP/levels/streaks/creature mastery (single write path)
      usage.ts                     per-user daily quotas
      flags.ts                     feature flags (ads, shop, post-MVP imports)
      ingestion/
        types.ts                   SourceParser interface
        parsers/image.ts           Gemini-vision OCR, one chunk per photo
        parsers/pdf.ts             per-page text extraction (unpdf)
        parsers/pasted-text.ts     section splitting
    game/
      sprites.ts                   original hand-authored pixel art
      map.ts                       seeded 12x12 island generation
      GameCanvas.svelte            canvas renderer + keyboard/touch movement
    components/                    BattleModal, SourceViewer, AdSlot, CreatureSprite
  routes/
    /, /login, /signup, /logout
    /app                           hub (courses, Memosprite, shop button, banner ad slot)
    /app/courses/new
    /app/courses/[courseId]        upload + source statuses
    /app/courses/[courseId]/sources/[sourceId]/review   "check extracted text" screen
    /app/courses/[courseId]/play   tilemap, battles, boss trial
    /app/shop                      Coming Soon cosmetics shop
    /api/sources                   multipart upload → private storage
    /api/sources/[id]/extract      parser pipeline (job-queue-ready endpoint)
    /api/sources/[id]/confirm      persist user-corrected chunks
    /api/sources/[id]/generate     Gemini generation from confirmed chunks only
    /api/source-links/[chunkId]    View Source resolution (signed URLs)
    /api/attempts                  answer recording + rewards
    /api/game/save, /api/game/boss
    /api/ads/events, /api/ads/reward
```

### Ingestion pipeline

`upload → extract → review/confirm → generate`, with a `sources.status` state machine
(`uploaded → extracting → needs_review → confirmed → generating → ready`, plus `failed`
with a stored error message). Extraction and generation are separate POST endpoints so
they can move behind a job queue without client changes. Generation only ever reads
**confirmed** chunks, so the user's OCR corrections are authoritative.

### Source grounding enforcement

- The generation prompt forbids outside knowledge and requires a `source_chunk_index`
  per question; responses are schema-validated and questions citing nonexistent chunks
  are dropped server-side.
- `quiz_questions` and `flashcards` have **NOT NULL foreign keys** to `source_chunks`
  and `sources` — an ungrounded item cannot be persisted.
- `View Source` resolves through `/api/source-links/[chunkId]`, which returns the chunk
  text plus a short-lived signed URL to the original private photo/PDF.
- `source_chunks.bounding_boxes_json` is reserved for future source highlighting.

### Storage security

The `sources` bucket is private. RLS on `storage.objects` scopes every path to the
owner's folder (`{user_id}/{source_id}/{n}.{ext}`), and files are only ever served via
short-lived signed URLs created server-side.

### Monetization (phase 1: tasteful ads only)

All ad placements are **off by default** behind `feature_flags` rows:

- `ads_banner` — hub/meta screens only; never mounted on study screens
- `ads_rewarded` — opt-in; grants **coins for cosmetics only**, granted server-side with
  a daily cap; there is deliberately no code path from ads to study content, answers,
  XP, or mastery
- `ads_interstitial` — safe breakpoints only (session summary)

Every ad interaction is logged to `ad_events`. No subscriptions, no pay-to-win, no
academic advantages for paying users.

### Cosmetics shop

“The Trellis & Thread” ships visible-but-Coming-Soon: seeded sections (outfits, frames,
decorations, biome skins, creature variants) and preview items with no purchase path
until `cosmetics_shop_purchases` is flipped. Cosmetic tables have no gameplay stat
fields at all, by design.

## Post-MVP features (shipped)

Built on top of the MVP:

- **DOCX parsing** (`mammoth`) — section-split by paragraphs.
- **PPTX parsing** (`jszip`) — one chunk per slide, `Slide N` labels.
- **Webpage import** (`linkedom` + `@mozilla/readability`) — main-content extraction with
  an SSRF guard that refuses localhost/private-network hosts.
- **Spaced repetition** — SM-2-lite `review_schedule` per user/question; due cards
  resurface in the review zone alongside recently-missed shadow concepts. Study-quality
  only: never grants XP or advantage.
- **Class leaderboards** — opt-in classes with a share code (`/app/leaderboard`), ranked
  by XP through an RLS-scoped `class_leaderboard` view. Purely social.
- **Cosmetics inventory + equipping** — gameplay-earnable items (granted on region
  completion) can be equipped one-per-category via `/api/cosmetics/equip`; shop shows
  ownership and equip controls. Cosmetic tables still carry no gameplay fields.
- **More creatures + evolution chains** — each subject creature now has stage-2/3
  evolutions reached through mastery.

New feature flags (`webpage_import`, `docx_import`, `pptx_import`, `spaced_repetition`,
`leaderboards`) are seeded **on**; the storage bucket's allowed MIME types were extended
for Office files in `migrations/0003_post_mvp.sql`.

## Still deferred

- **Payments** — intentionally out (the product is ads-first; needs a real processor).
- **Real ad-network integration** — the banner/rewarded/interstitial scaffold and
  server-side reward path are in place, but wiring a live ad SDK needs a provider
  account.
