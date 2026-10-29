-- ============================================================================
-- Eastbridge Quiz Arcade — Supabase schema, RLS policies, RPCs and storage.
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- Designed for Ghana's Data Protection Act, 2012 (Act 843): minimum data,
-- class-scoped access, no public directory of children.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'teacher', 'learner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quiz_visibility as enum ('private', 'shared');
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum ('todo', 'in_progress', 'done', 'overdue');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('teacher', 'admin') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.my_class_id()
returns uuid language sql stable security definer set search_path = public as $$
  select class_id from public.profiles where id = auth.uid();
$$;

create or replace function public.teaches_class(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.classes c
    where c.id = p_class and (auth.uid() = any (c.teacher_ids) or public.is_admin())
  );
$$;

create or replace function public.can_access_quiz(p_quiz uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.quizzes q
    where q.id = p_quiz
      and (
        q.owner_id = auth.uid()
        or public.is_admin()
        or (q.visibility = 'shared' and public.is_teacher())
        -- learners may read a quiz that has been assigned to them
        or exists (
          select 1 from public.assignments a
          where a.quiz_id = q.id
            and (
              (a.target_type = 'class' and public.my_class_id() = any (a.class_ids))
              or (a.target_type = 'year' and a.year_group = (select c.year_group from public.classes c where c.id = public.my_class_id()))
              or exists (select 1 from public.assignment_targets t where t.assignment_id = a.id and t.learner_id = auth.uid())
            )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'learner',
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  email citext unique,
  school_code text unique,
  pin_hash text,                       -- bcrypt hash of the 4-digit learner PIN (never the raw PIN)
  class_id uuid,
  avatar_id text not null default 'eagle-navy',
  hat_id text,
  trail_id text,
  coins integer not null default 0 check (coins >= 0),
  xp integer not null default 0 check (xp >= 0),
  owned_items text[] not null default '{}',
  badges text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists profiles_class_idx on public.profiles (class_id);
create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Classes & membership
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year_group smallint not null check (year_group between 1 and 9),
  code text not null unique,
  teacher_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_class_fk;
alter table public.profiles
  add constraint profiles_class_fk foreign key (class_id) references public.classes (id) on delete set null;

create table if not exists public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  learner_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, learner_id)
);

-- ---------------------------------------------------------------------------
-- Quizzes & questions
-- ---------------------------------------------------------------------------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  emoji text not null default '📘',
  cover_image text,
  description text not null default '',
  subject text not null,
  year_group smallint not null check (year_group between 1 and 9),
  tags text[] not null default '{}',
  visibility quiz_visibility not null default 'private',
  owner_id uuid not null references public.profiles (id) on delete cascade,
  folder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quizzes_owner_idx on public.quizzes (owner_id);
create index if not exists quizzes_shared_idx on public.quizzes (visibility, subject, year_group);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position integer not null default 0,
  type text not null default 'multiple_choice' check (type in ('multiple_choice', 'true_false')),
  text text not null,
  options jsonb not null default '[]'::jsonb,   -- [{id,text,imageUrl,imageAlt}]
  correct_index smallint not null default 0,
  time_limit smallint not null default 20 check (time_limit between 5 and 120),
  points integer not null default 1000 check (points between 0 and 10000),
  image_url text,
  image_alt text,
  explanation text,
  topic text,
  created_at timestamptz not null default now(),
  constraint question_has_options check (jsonb_array_length(options) between 2 and 4),
  constraint correct_index_in_range check (correct_index >= 0 and correct_index < jsonb_array_length(options)),
  constraint image_needs_alt check (image_url is null or coalesce(char_length(image_alt), 0) > 0)
);

create index if not exists questions_quiz_idx on public.questions (quiz_id, position);

-- ---------------------------------------------------------------------------
-- Live games
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  pin text not null check (pin ~ '^[0-9]{6}$'),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  quiz_title text not null,
  host_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null default 'classic',
  status text not null default 'lobby' check (status in ('lobby', 'live', 'reveal', 'break', 'podium', 'ended')),
  settings jsonb not null default '{}'::jsonb,
  question_order text[] not null default '{}',
  current_index integer not null default -1,
  phase_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists games_active_pin_idx on public.games (pin) where status <> 'ended';
create index if not exists games_host_idx on public.games (host_id, created_at desc);

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.games (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 18),
  avatar_id text not null default 'eagle-navy',
  team smallint,
  is_guest boolean not null default true,
  profile_id uuid references public.profiles (id) on delete set null,
  score integer not null default 0 check (score >= 0),
  coins integer not null default 0 check (coins >= 0),
  streak integer not null default 0,
  best_streak integer not null default 0,
  correct integer not null default 0,
  total integer not null default 0,
  answers jsonb not null default '[]'::jsonb,
  connected boolean not null default true,
  kicked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists game_players_session_idx on public.game_players (session_id);

-- One-time arcade passes — the server-side anti-cheat record.
create table if not exists public.arcade_tokens (
  token uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.game_players (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  game_id text not null default 'any',
  duration_sec smallint not null check (duration_sec between 15 and 180),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  unique (player_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  instructions text not null default '',
  target_type text not null default 'class' check (target_type in ('class', 'year', 'learners')),
  class_ids uuid[] not null default '{}',
  year_group smallint,
  start_date timestamptz not null default now(),
  due_date timestamptz not null,
  attempts smallint not null default 1 check (attempts in (1, 2, 999)),
  time_limit_min smallint,
  shuffle boolean not null default true,
  shuffle_answers boolean not null default true,
  show_answers boolean not null default true,
  arcade jsonb not null default '{"enabled":true,"durationSec":60,"allowedGames":[],"trigger":"every","skipAllowed":true}'::jsonb,
  short_code text not null unique,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists assignments_teacher_idx on public.assignments (teacher_id, due_date desc);

create table if not exists public.assignment_targets (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  learner_id uuid references public.profiles (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,
  primary key (assignment_id, learner_id)
);

create or replace function public.is_assigned_to_me(p_assignment uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assignments a
    where a.id = p_assignment
      and (
        (a.target_type = 'class' and public.my_class_id() = any (a.class_ids))
        or (a.target_type = 'year' and a.year_group = (select c.year_group from public.classes c where c.id = public.my_class_id()))
        or exists (select 1 from public.assignment_targets t where t.assignment_id = a.id and t.learner_id = auth.uid())
        or a.teacher_id = auth.uid()
        or public.is_admin()
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Submissions
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  learner_id uuid not null references public.profiles (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  attempt smallint not null default 1,
  score integer not null default 0,
  accuracy numeric(5, 2) not null default 0 check (accuracy between 0 and 100),
  correct integer not null default 0,
  total integer not null default 0,
  best_streak integer not null default 0,
  total_time_ms integer not null default 0,
  arcade_bonus integer not null default 0,
  status submission_status not null default 'done',
  late boolean not null default false,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  teacher_comment text,
  reopened boolean not null default false,
  unique (assignment_id, learner_id, attempt)
);

create index if not exists submissions_assignment_idx on public.submissions (assignment_id);
create index if not exists submissions_learner_idx on public.submissions (learner_id, submitted_at desc);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  option_index smallint,
  correct boolean not null default false,
  ms integer not null default 0,
  points integer not null default 0
);

create table if not exists public.minigame_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  game_id text not null,
  score integer not null default 0,
  coins integer not null default 0,
  duration_ms integer not null default 0,
  played_at timestamptz not null default now()
);

create table if not exists public.game_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.games (id) on delete set null,
  quiz_id uuid references public.quizzes (id) on delete set null,
  host_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null,
  title text not null,
  ended_at timestamptz not null default now(),
  players jsonb not null default '[]'::jsonb,
  question_stats jsonb not null default '[]'::jsonb
);

create table if not exists public.org_settings (
  id text primary key default 'default',
  school_name text not null default 'Eastbridge International School',
  minigames_disabled text[] not null default '{}',
  grade_bands jsonb not null default '[]'::jsonb,
  term text not null default 'Term 1',
  academic_year text not null default '2026/27',
  updated_at timestamptz not null default now()
);

insert into public.org_settings (id) values ('default') on conflict do nothing;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.arcade_tokens enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_targets enable row level security;
alter table public.submissions enable row level security;
alter table public.answers enable row level security;
alter table public.minigame_results enable row level security;
alter table public.game_reports enable row level security;
alter table public.org_settings enable row level security;

-- ------------------------------- profiles ---------------------------------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles for select using (
  id = auth.uid()
  or public.is_admin()
  -- teachers see learners in the classes they teach
  or (public.is_teacher() and class_id is not null and public.teaches_class(class_id))
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (
  id = auth.uid()
  -- learners may only change cosmetic fields and cannot promote themselves
  and (role = (select role from public.profiles p where p.id = auth.uid()))
  and coins >= 0 and xp >= 0
);

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- -------------------------------- classes ---------------------------------
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select using (
  public.is_admin() or auth.uid() = any (teacher_ids) or id = public.my_class_id()
);

drop policy if exists classes_write on public.classes;
create policy classes_write on public.classes for all
  using (public.is_admin() or auth.uid() = any (teacher_ids))
  with check (public.is_admin() or auth.uid() = any (teacher_ids));

-- ----------------------------- class_members -------------------------------
drop policy if exists class_members_select on public.class_members;
create policy class_members_select on public.class_members for select using (
  learner_id = auth.uid() or public.is_admin() or public.teaches_class(class_id)
);

drop policy if exists class_members_write on public.class_members;
create policy class_members_write on public.class_members for all
  using (public.is_admin() or public.teaches_class(class_id))
  with check (public.is_admin() or public.teaches_class(class_id));

-- -------------------------------- quizzes ---------------------------------
drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes for select using (public.can_access_quiz(id));

drop policy if exists quizzes_insert on public.quizzes;
create policy quizzes_insert on public.quizzes for insert with check (owner_id = auth.uid() and public.is_teacher());

drop policy if exists quizzes_update on public.quizzes;
create policy quizzes_update on public.quizzes for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists quizzes_delete on public.quizzes;
create policy quizzes_delete on public.quizzes for delete using (owner_id = auth.uid() or public.is_admin());

-- ------------------------------- questions --------------------------------
drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions for select using (public.can_access_quiz(quiz_id));

drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions for all
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and (q.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and (q.owner_id = auth.uid() or public.is_admin())));

-- --------------------------------- games ----------------------------------
drop policy if exists games_select_host on public.games;
create policy games_select_host on public.games for select using (host_id = auth.uid() or public.is_admin());

drop policy if exists games_write_host on public.games;
create policy games_write_host on public.games for all
  using (host_id = auth.uid() or public.is_admin())
  with check (host_id = auth.uid() or public.is_admin());

-- ----------------------------- game_players -------------------------------
-- Guests join anonymously: insert is allowed into a live lobby. The host tab is
-- the authority for scores; players may only read rows in their own session.
drop policy if exists game_players_select on public.game_players;
create policy game_players_select on public.game_players for select using (
  profile_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.games g where g.id = session_id and g.host_id = auth.uid())
);

drop policy if exists game_players_insert on public.game_players;
create policy game_players_insert on public.game_players for insert with check (
  exists (select 1 from public.games g where g.id = session_id and g.status <> 'ended')
);

drop policy if exists game_players_update_host on public.game_players;
create policy game_players_update_host on public.game_players for update using (
  public.is_admin()
  or exists (select 1 from public.games g where g.id = session_id and g.host_id = auth.uid())
);

-- ----------------------------- arcade tokens ------------------------------
drop policy if exists arcade_tokens_select on public.arcade_tokens;
create policy arcade_tokens_select on public.arcade_tokens for select using (
  player_id in (select id from public.game_players where profile_id = auth.uid())
  or public.is_admin()
);

-- --------------------------------- assignments ----------------------------
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments for select using (
  teacher_id = auth.uid() or public.is_admin() or public.is_assigned_to_me(id)
);

drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments for all
  using (teacher_id = auth.uid() or public.is_admin())
  with check (teacher_id = auth.uid() or public.is_admin());

drop policy if exists assignment_targets_select on public.assignment_targets;
create policy assignment_targets_select on public.assignment_targets for select using (
  learner_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = auth.uid())
);

drop policy if exists assignment_targets_write on public.assignment_targets;
create policy assignment_targets_write on public.assignment_targets for all
  using (exists (select 1 from public.assignments a where a.id = assignment_id and (a.teacher_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.assignments a where a.id = assignment_id and (a.teacher_id = auth.uid() or public.is_admin())));

-- -------------------------------- submissions -----------------------------
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions for select using (
  learner_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = auth.uid())
);

drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions for insert with check (
  learner_id = auth.uid() and public.is_assigned_to_me(assignment_id)
);

drop policy if exists submissions_update_teacher on public.submissions;
create policy submissions_update_teacher on public.submissions for update using (
  public.is_admin()
  or exists (select 1 from public.assignments a where a.id = assignment_id and a.teacher_id = auth.uid())
);

-- --------------------------------- answers --------------------------------
drop policy if exists answers_select on public.answers;
create policy answers_select on public.answers for select using (
  exists (
    select 1 from public.submissions s
    where s.id = submission_id
      and (s.learner_id = auth.uid() or public.is_admin()
        or exists (select 1 from public.assignments a where a.id = s.assignment_id and a.teacher_id = auth.uid()))
  )
);

drop policy if exists answers_insert on public.answers;
create policy answers_insert on public.answers for insert with check (
  exists (select 1 from public.submissions s where s.id = submission_id and s.learner_id = auth.uid())
);

-- ---------------------------- minigame results ----------------------------
drop policy if exists minigame_results_select on public.minigame_results;
create policy minigame_results_select on public.minigame_results for select using (
  exists (
    select 1 from public.submissions s
    where s.id = submission_id
      and (s.learner_id = auth.uid() or public.is_admin()
        or exists (select 1 from public.assignments a where a.id = s.assignment_id and a.teacher_id = auth.uid()))
  )
);

drop policy if exists minigame_results_insert on public.minigame_results;
create policy minigame_results_insert on public.minigame_results for insert with check (
  exists (select 1 from public.submissions s where s.id = submission_id and s.learner_id = auth.uid())
);

-- ------------------------------- game reports -----------------------------
drop policy if exists game_reports_select on public.game_reports;
create policy game_reports_select on public.game_reports for select using (host_id = auth.uid() or public.is_admin());

drop policy if exists game_reports_write on public.game_reports;
create policy game_reports_write on public.game_reports for all
  using (host_id = auth.uid() or public.is_admin())
  with check (host_id = auth.uid() or public.is_admin());

-- ------------------------------ org settings ------------------------------
drop policy if exists org_settings_select on public.org_settings;
create policy org_settings_select on public.org_settings for select using (true);

drop policy if exists org_settings_write on public.org_settings;
create policy org_settings_write on public.org_settings for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- RPCs
-- ============================================================================

-- Learner sign-in with school code + 4-digit PIN (no email required).
-- Returns a minimal profile row; raises on failure. Rate limiting is handled by
-- Supabase's built-in auth throttling plus the delay in the Edge Function.
create or replace function public.learner_login(p_school_code text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  p record;
begin
  select * into p from public.profiles
   where role = 'learner'
     and upper(replace(school_code, ' ', '')) = upper(replace(p_school_code, ' ', ''))
     and active = true;

  if p.id is null then
    raise exception 'School code or PIN not recognised';
  end if;

  if p.pin_hash is null or crypt(p_pin, p.pin_hash) <> p.pin_hash then
    raise exception 'School code or PIN not recognised';
  end if;

  return jsonb_build_object(
    'id', p.id, 'role', p.role, 'firstName', p.first_name, 'lastName', p.last_name,
    'schoolCode', p.school_code, 'classId', p.class_id, 'avatarId', p.avatar_id,
    'hatId', p.hat_id, 'trailId', p.trail_id, 'coins', p.coins, 'xp', p.xp,
    'ownedItems', p.owned_items, 'badges', p.badges, 'active', p.active,
    'createdAt', p.created_at
  );
end;
$$;

revoke all on function public.learner_login(text, text) from public;
grant execute on function public.learner_login(text, text) to anon, authenticated;

-- Set a learner PIN (admin/teacher only). Stores a bcrypt hash, never the PIN.
create or replace function public.set_learner_pin(p_profile uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.is_admin() or (public.is_teacher() and exists (
      select 1 from public.profiles where id = p_profile and public.teaches_class(class_id)))) then
    raise exception 'Not allowed';
  end if;
  update public.profiles
     set pin_hash = crypt(p_pin, gen_salt('bf', 8))
   where id = p_profile and role = 'learner';
end;
$$;

-- Minimal game lookup by PIN for the join screen (guests are not authenticated).
create or replace function public.game_by_pin(p_pin text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', g.id, 'pin', g.pin, 'quizTitle', g.quiz_title, 'mode', g.mode,
    'status', g.status, 'settings', g.settings,
    'locked', coalesce((g.settings->>'lockLobby')::boolean, false)
  )
  from public.games g
  where g.pin = p_pin and g.status <> 'ended'
  limit 1;
$$;
grant execute on function public.game_by_pin(text) to anon, authenticated;

-- Server-validated arcade pass.
-- Only a player whose recorded answer for the question was correct can claim one,
-- and only once per question. The client renders the break using the returned
-- expires_at — it cannot extend it locally.
create or replace function public.claim_arcade_break(
  p_player uuid,
  p_question uuid,
  p_game text default 'any'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_player public.game_players;
  v_game public.games;
  v_correct boolean := false;
  v_duration smallint;
  v_token public.arcade_tokens;
begin
  select * into v_player from public.game_players where id = p_player;
  if v_player.id is null then raise exception 'Unknown player'; end if;

  select * into v_game from public.games where id = v_player.session_id;
  if v_game.id is null or v_game.status = 'ended' then raise exception 'Game is over'; end if;

  -- Validate the answer from the stored player answer log.
  select coalesce(bool_or((a->>'correct')::boolean), false)
    into v_correct
    from jsonb_array_elements(v_player.answers) a
   where a->>'questionId' = p_question::text;

  if not v_correct then
    raise exception 'Arcade passes are only issued for correct answers';
  end if;

  v_duration := least(180, greatest(15, coalesce((v_game.settings->>'breakDurationSec')::smallint, 60)));

  insert into public.arcade_tokens (player_id, question_id, game_id, duration_sec, expires_at)
  values (p_player, p_question, p_game, v_duration, now() + (v_duration + 120) * interval '1 second')
  on conflict (player_id, question_id) do nothing
  returning * into v_token;

  if v_token.token is null then
    raise exception 'This arcade pass has already been claimed';
  end if;

  return jsonb_build_object(
    'token', v_token.token,
    'durationSec', v_token.duration_sec,
    'issuedAt', v_token.issued_at,
    'expiresAt', v_token.expires_at
  );
end;
$$;

-- ============================================================================
-- STORAGE — quiz images (compressed to WebP client-side, served signed)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select using (
  bucket_id = 'media' and auth.role() = 'authenticated'
);

drop policy if exists media_write on storage.objects;
create policy media_write on storage.objects for insert to authenticated with check (
  bucket_id = 'media' and public.is_teacher()
);

drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects for update to authenticated using (
  bucket_id = 'media' and (owner = auth.uid() or public.is_admin())
);

drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'media' and (owner = auth.uid() or public.is_admin())
);

-- ============================================================================
-- REALTIME — enable broadcast for live games
-- ============================================================================
do $$ begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.game_players;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- MAINTENANCE
-- ============================================================================
create or replace function public.prune_expired_arcade_tokens()
returns void language sql security definer set search_path = public as $$
  delete from public.arcade_tokens where expires_at < now() - interval '1 day';
$$;

comment on table public.profiles is 'Minimal child data: first/last name, class, school code, avatar. No email required for learners.';
comment on column public.profiles.pin_hash is 'bcrypt hash only. Never store the raw 4-digit PIN.';
