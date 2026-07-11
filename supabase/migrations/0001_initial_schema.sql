-- ============================================================
-- Loreleaf Academy — initial schema
-- Source-grounded gamified learning. Every generated study item
-- carries a hard FK back to the source chunk it came from.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type source_type as enum ('image', 'pdf', 'pptx', 'docx', 'webpage', 'pasted_text');

create type source_status as enum (
  'uploaded',      -- raw file stored, nothing extracted yet
  'extracting',    -- extraction in progress
  'needs_review',  -- extracted text awaiting user confirmation
  'confirmed',     -- user confirmed extracted text
  'generating',    -- study item generation in progress
  'ready',         -- study items generated
  'failed'         -- extraction or generation failed (see error_message)
);

create type question_type as enum ('multiple_choice', 'true_false', 'matching', 'typing', 'ordering');

create type ad_placement as enum ('banner', 'rewarded', 'interstitial');
create type ad_event_type as enum ('impression', 'click', 'reward_granted', 'dismissed');

create type cosmetic_category as enum (
  'trainer_outfit', 'profile_frame', 'room_decoration', 'biome_skin', 'creature_variant'
);

-- ------------------------------------------------------------
-- profiles — one row per auth user
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Ranger',
  avatar_variant smallint not null default 0,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  coins integer not null default 0 check (coins >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_study_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile when a user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Ranger'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------
-- courses — a course becomes an explorable study region
-- ------------------------------------------------------------
create table courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  subject text,
  region_name text not null default 'Uncharted Isle',
  region_theme_json jsonb,          -- generated map/zone theming
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_user_id_idx on courses (user_id);

-- ------------------------------------------------------------
-- sources — one uploaded/imported material (may group multiple images)
-- ------------------------------------------------------------
create table sources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  source_type source_type not null,
  title text not null check (char_length(title) between 1 and 200),
  status source_status not null default 'uploaded',
  error_message text,
  -- storage object paths for raw files (private bucket), ordered.
  -- One entry per uploaded photo/file; empty for pasted_text/webpage.
  storage_paths text[] not null default '{}',
  origin_url text,                  -- for webpage imports
  page_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sources_course_id_idx on sources (course_id);
create index sources_user_id_idx on sources (user_id);

-- ------------------------------------------------------------
-- source_chunks — normalized, user-confirmed content units.
-- Every generated study item points at exactly one chunk.
-- ------------------------------------------------------------
create table source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  source_type source_type not null,
  chunk_index integer not null check (chunk_index >= 0),
  location_label text not null,       -- e.g. "Page 3", "Photo 2 of 8", "Section: Photosynthesis"
  content text not null,
  -- Which raw file this chunk came from (index into sources.storage_paths), for images/PDF pages.
  storage_path_index integer,
  bounding_boxes_json jsonb,          -- nullable; future source highlighting
  metadata_json jsonb,                -- nullable; parser-specific extras
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);
create index source_chunks_source_id_idx on source_chunks (source_id);
create index source_chunks_user_id_idx on source_chunks (user_id);

-- ------------------------------------------------------------
-- study_sets — a generation batch over a source
-- ------------------------------------------------------------
create table study_sets (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  source_id uuid not null references sources (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  topics_json jsonb,                  -- topic split produced during generation
  created_at timestamptz not null default now()
);
create index study_sets_course_id_idx on study_sets (course_id);
create index study_sets_user_id_idx on study_sets (user_id);

-- ------------------------------------------------------------
-- flashcards
-- ------------------------------------------------------------
create table flashcards (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references study_sets (id) on delete cascade,
  source_id uuid not null references sources (id) on delete cascade,
  source_chunk_id uuid not null references source_chunks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  location_label text not null,
  topic text not null,
  front text not null,
  back text not null,
  created_at timestamptz not null default now()
);
create index flashcards_study_set_id_idx on flashcards (study_set_id);
create index flashcards_user_id_idx on flashcards (user_id);

-- ------------------------------------------------------------
-- quiz_questions — battle encounters
-- ------------------------------------------------------------
create table quiz_questions (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references study_sets (id) on delete cascade,
  source_id uuid not null references sources (id) on delete cascade,
  source_chunk_id uuid not null references source_chunks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  location_label text not null,
  topic text not null,
  question_type question_type not null,
  difficulty smallint not null default 1 check (difficulty between 1 and 3),
  is_boss boolean not null default false,
  prompt text not null,
  -- multiple_choice/true_false: {"options": [...], "correct_index": n}
  -- typing: {"accepted_answers": [...]}
  -- matching: {"pairs": [{"left": "...", "right": "..."}]}
  -- ordering: {"items": [...]}  (correct order as given)
  answer_json jsonb not null,
  explanation text not null,          -- source-backed correction shown on a miss
  created_at timestamptz not null default now()
);
create index quiz_questions_study_set_id_idx on quiz_questions (study_set_id);
create index quiz_questions_user_id_idx on quiz_questions (user_id);
create index quiz_questions_topic_idx on quiz_questions (study_set_id, topic);

-- ------------------------------------------------------------
-- user_question_attempts — the learning record
-- ------------------------------------------------------------
create table user_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  question_id uuid not null references quiz_questions (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  is_correct boolean not null,
  answer_given text,
  focus_chain integer not null default 0 check (focus_chain >= 0),
  was_redemption boolean not null default false,  -- correctly redeemed a previously missed concept
  in_boss_battle boolean not null default false,
  created_at timestamptz not null default now()
);
create index uqa_user_question_idx on user_question_attempts (user_id, question_id);
create index uqa_user_course_idx on user_question_attempts (user_id, course_id, created_at);

-- ------------------------------------------------------------
-- game_saves — per-course play state
-- ------------------------------------------------------------
create table game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  player_x integer not null default 1,
  player_y integer not null default 1,
  cleared_nodes_json jsonb not null default '[]'::jsonb,
  map_seed integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index game_saves_user_idx on game_saves (user_id);

-- ------------------------------------------------------------
-- creatures — Memosprite catalog (global, read-only to users)
-- ------------------------------------------------------------
create table creatures (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subject_affinity text not null,      -- e.g. 'starter', 'science', 'math'
  description text not null,
  sprite_key text not null,            -- key into the client sprite atlas
  evolution_stage smallint not null default 1 check (evolution_stage between 1 and 3),
  evolves_to uuid references creatures (id),
  evolve_at_level integer,             -- creature level required to evolve
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- user_creatures — owned Memosprites; level = mastery, never purchases
-- ------------------------------------------------------------
create table user_creatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  creature_id uuid not null references creatures (id) on delete cascade,
  nickname text,
  level integer not null default 1 check (level >= 1),
  mastery_xp integer not null default 0 check (mastery_xp >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, creature_id)
);
create index user_creatures_user_idx on user_creatures (user_id);

-- ------------------------------------------------------------
-- course_progress
-- ------------------------------------------------------------
create table course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  nodes_cleared integer not null default 0,
  boss_defeated boolean not null default false,
  completed_at timestamptz,
  mastery_percent numeric(5,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index course_progress_user_idx on course_progress (user_id);

-- ------------------------------------------------------------
-- achievements (catalog) + earned achievements live in metadata for MVP;
-- keep a proper earned table for growth.
-- ------------------------------------------------------------
create table achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon_key text not null,
  created_at timestamptz not null default now()
);

create table user_achievements (
  user_id uuid not null references profiles (id) on delete cascade,
  achievement_id uuid not null references achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ------------------------------------------------------------
-- daily_quests
-- ------------------------------------------------------------
create table daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  quest_date date not null default current_date,
  quest_key text not null,             -- e.g. 'answer_10', 'clear_node', 'redeem_shadow'
  target integer not null default 1,
  progress integer not null default 0,
  coins_reward integer not null default 10,
  claimed boolean not null default false,
  unique (user_id, quest_date, quest_key)
);
create index daily_quests_user_date_idx on daily_quests (user_id, quest_date);

-- ------------------------------------------------------------
-- usage_limits — upload/generation quotas per user per day
-- ------------------------------------------------------------
create table usage_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  usage_date date not null default current_date,
  uploads_count integer not null default 0,
  generation_count integer not null default 0,
  extraction_count integer not null default 0,
  unique (user_id, usage_date)
);

-- ------------------------------------------------------------
-- ad_events — audit log for the ads scaffold
-- ------------------------------------------------------------
create table ad_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  placement ad_placement not null,
  event_type ad_event_type not null,
  reward_json jsonb,                   -- e.g. {"coins": 15} — cosmetic/currency only, never study content
  context text,                        -- screen or breakpoint, e.g. 'session_summary'
  created_at timestamptz not null default now()
);
create index ad_events_user_idx on ad_events (user_id, created_at);

-- ------------------------------------------------------------
-- cosmetics — catalog + shop sections + ownership. Cosmetic only:
-- no stat boosts, no learning advantages, enforced by having no
-- gameplay fields at all.
-- ------------------------------------------------------------
create table cosmetic_shop_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category cosmetic_category not null,
  sort_order integer not null default 0,
  is_coming_soon boolean not null default true
);

create table cosmetic_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references cosmetic_shop_sections (id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text not null,
  category cosmetic_category not null,
  sprite_key text not null,
  coin_price integer,                  -- null = not purchasable yet (coming soon / earn-only)
  earnable_from text,                  -- 'gameplay' | 'rewarded_ad' | null
  is_available boolean not null default false,
  created_at timestamptz not null default now()
);
create index cosmetic_items_section_idx on cosmetic_items (section_id);

create table user_cosmetics (
  user_id uuid not null references profiles (id) on delete cascade,
  cosmetic_item_id uuid not null references cosmetic_items (id) on delete cascade,
  equipped boolean not null default false,
  acquired_via text not null default 'gameplay',
  acquired_at timestamptz not null default now(),
  primary key (user_id, cosmetic_item_id)
);

-- ------------------------------------------------------------
-- feature_flags — server-controlled toggles (ads on/off etc.)
-- ------------------------------------------------------------
create table feature_flags (
  key text primary key,
  enabled boolean not null default false,
  value_json jsonb,
  description text,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles for each row execute function set_updated_at();
create trigger courses_updated_at before update on courses for each row execute function set_updated_at();
create trigger sources_updated_at before update on sources for each row execute function set_updated_at();
create trigger game_saves_updated_at before update on game_saves for each row execute function set_updated_at();
create trigger course_progress_updated_at before update on course_progress for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table courses enable row level security;
alter table sources enable row level security;
alter table source_chunks enable row level security;
alter table study_sets enable row level security;
alter table flashcards enable row level security;
alter table quiz_questions enable row level security;
alter table user_question_attempts enable row level security;
alter table game_saves enable row level security;
alter table creatures enable row level security;
alter table user_creatures enable row level security;
alter table course_progress enable row level security;
alter table achievements enable row level security;
alter table user_achievements enable row level security;
alter table daily_quests enable row level security;
alter table usage_limits enable row level security;
alter table ad_events enable row level security;
alter table cosmetic_shop_sections enable row level security;
alter table cosmetic_items enable row level security;
alter table user_cosmetics enable row level security;
alter table feature_flags enable row level security;

-- Owner-scoped tables: full select for owner; writes go through server
-- routes (service role) except where users legitimately write directly.
create policy "own profile read"  on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "own courses" on courses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sources" on sources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own chunks" on source_chunks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own study_sets read" on study_sets for select using (auth.uid() = user_id);
create policy "own flashcards read" on flashcards for select using (auth.uid() = user_id);
create policy "own questions read" on quiz_questions for select using (auth.uid() = user_id);
create policy "own attempts read" on user_question_attempts for select using (auth.uid() = user_id);
create policy "own attempts insert" on user_question_attempts for insert with check (auth.uid() = user_id);
create policy "own saves" on game_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own creatures read" on user_creatures for select using (auth.uid() = user_id);
create policy "own progress read" on course_progress for select using (auth.uid() = user_id);
create policy "own achievements read" on user_achievements for select using (auth.uid() = user_id);
create policy "own quests" on daily_quests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own usage read" on usage_limits for select using (auth.uid() = user_id);
create policy "own ad events insert" on ad_events for insert with check (auth.uid() = user_id);
create policy "own ad events read" on ad_events for select using (auth.uid() = user_id);
create policy "own cosmetics read" on user_cosmetics for select using (auth.uid() = user_id);

-- Global catalogs: readable by any signed-in user; written only via service role.
create policy "creatures readable" on creatures for select to authenticated using (true);
create policy "achievements readable" on achievements for select to authenticated using (true);
create policy "shop sections readable" on cosmetic_shop_sections for select to authenticated using (true);
create policy "cosmetic items readable" on cosmetic_items for select to authenticated using (true);
create policy "feature flags readable" on feature_flags for select to authenticated using (true);
