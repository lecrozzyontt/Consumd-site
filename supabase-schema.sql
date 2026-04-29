-- ============================================================
-- OmniLog / Consumd — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- PROFILES (extends auth.users)
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  username    text unique not null,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- LOGS
create table if not exists public.logs (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  title       text not null,
  media_type  text not null check (media_type in ('movie', 'show', 'book', 'game')),
  creator     text,
  year        integer,
  cover_url   text,
  genre       text,
  external_id text,
  rating      integer check (rating >= 1 and rating <= 5),
  review      text,
  status      text default 'completed' check (status in ('completed', 'in_progress', 'want')),
  logged_at   timestamptz default now()
);

-- FRIENDSHIPS
create table if not exists public.friendships (
  id           uuid default gen_random_uuid() primary key,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status       text default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.logs enable row level security;
alter table public.friendships enable row level security;

-- Profiles: public read, owner write
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Logs: owner + friends can read; only owner can write
create policy "logs_select" on public.logs for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.friendships
    where status = 'accepted'
    and (
      (requester_id = auth.uid() and addressee_id = user_id) or
      (addressee_id = auth.uid() and requester_id = user_id)
    )
  )
);
create policy "logs_insert_own" on public.logs for insert with check (auth.uid() = user_id);
create policy "logs_update_own" on public.logs for update using (auth.uid() = user_id);
create policy "logs_delete_own" on public.logs for delete using (auth.uid() = user_id);

-- Friendships
create policy "friendships_select" on public.friendships for select using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);
create policy "friendships_insert" on public.friendships for insert with check (auth.uid() = requester_id);
create policy "friendships_update" on public.friendships for update using (auth.uid() = addressee_id);
create policy "friendships_delete" on public.friendships for delete using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
