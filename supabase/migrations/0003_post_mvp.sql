-- ============================================================
-- Post-MVP: DOCX/PPTX uploads, spaced repetition, class
-- leaderboards, and cosmetic equipping/earning.
-- ============================================================

-- ------------------------------------------------------------
-- Allow Office document uploads in the private bucket.
-- ------------------------------------------------------------
update storage.buckets
set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/webp', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]
where id = 'sources';

-- ------------------------------------------------------------
-- Spaced repetition — an SM-2-lite schedule per user per question.
-- Every review updates ease, interval, and the next due date.
-- ------------------------------------------------------------
create table review_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  question_id uuid not null references quiz_questions (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  ease numeric(4,2) not null default 2.50 check (ease >= 1.30),
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  due_on date not null default current_date,
  last_reviewed_at timestamptz,
  unique (user_id, question_id)
);
create index review_schedule_due_idx on review_schedule (user_id, course_id, due_on);

alter table review_schedule enable row level security;
create policy "own review schedule read" on review_schedule
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Classes & leaderboards — opt-in via a share code. A learner joins
-- a class, and the leaderboard ranks members by XP. Purely social;
-- no effect on learning content.
-- ------------------------------------------------------------
create table classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  join_code text not null unique,
  created_at timestamptz not null default now()
);
create index classes_owner_idx on classes (owner_id);

create table class_members (
  class_id uuid not null references classes (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index class_members_user_idx on class_members (user_id);

alter table classes enable row level security;
alter table class_members enable row level security;

-- A learner can see classes they own or belong to.
create policy "class visible to members" on classes
  for select using (
    auth.uid() = owner_id
    or exists (
      select 1 from class_members m
      where m.class_id = classes.id and m.user_id = auth.uid()
    )
  );

create policy "own class membership read" on class_members
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from classes c
      where c.id = class_members.class_id and c.owner_id = auth.uid()
    )
  );

-- Leaderboard view: members of a class with their public stats. Runs with
-- the caller's RLS, so a user only sees rows for classes they belong to.
create or replace view class_leaderboard as
select
  m.class_id,
  p.id as user_id,
  p.display_name,
  p.xp,
  p.level,
  p.streak_days
from class_members m
join profiles p on p.id = m.user_id;

-- ------------------------------------------------------------
-- Cosmetics: let users equip owned items directly, and make a
-- starter set of gameplay-earnable items actually available.
-- ------------------------------------------------------------
create policy "own cosmetics write" on user_cosmetics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Turn on the gameplay-earnable cosmetics seeded in seed.sql so the
-- inventory/equipping flow has real items to grant.
update cosmetic_items set is_available = true
where earnable_from = 'gameplay';
