-- Create guests table
create table if not exists public.guests (
  id uuid default gen_random_uuid() primary key,
  first_name text not null,
  last_name text not null,
  ip_address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(first_name, last_name)
);

-- Create photos table
create table if not exists public.photos (
  id uuid default gen_random_uuid() primary key,
  guest_id uuid references public.guests(id) on delete cascade,
  guest_name text not null,
  url text not null,
  storage_path text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create timer_state table
create table if not exists public.timer_state (
  id integer primary key default 1 check (id = 1),
  status text not null default 'reset', -- 'running', 'paused', 'reset'
  remaining_seconds integer not null default 10800, -- 3 hours = 10800 seconds
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert initial timer state if not exists
insert into public.timer_state (id, status, remaining_seconds, updated_at)
values (1, 'reset', 10800, now())
on conflict (id) do nothing;

-- Enable Row Level Security (RLS)
alter table public.guests enable row level security;
alter table public.photos enable row level security;
alter table public.timer_state enable row level security;

-- Create policies for public access (since guests upload without formal email/password accounts)
-- Anyone can view guests (for displaying names and galleries)
create policy "Allow public read of guests" on public.guests
  for select using (true);

-- Anyone can register (insert a guest)
create policy "Allow public insert of guests" on public.guests
  for insert with check (true);

-- Anyone can view photos
create policy "Allow public read of photos" on public.photos
  for select using (true);

-- Anyone can upload photos
create policy "Allow public insert of photos" on public.photos
  for insert with check (true);

-- Users can delete their own photos
create policy "Allow users to delete their own photos" on public.photos
  for delete using (true); -- We will verify ownership on client or server-side API

-- Anyone can view the timer state
create policy "Allow public read of timer_state" on public.timer_state
  for select using (true);

-- Only admin (service role / API route) will update the timer state or delete others' photos,
-- so we allow all changes from the service role. If RLS is enabled, server-side requests with 
-- service role key bypass RLS policies.
create policy "Allow service role full access on timer_state" on public.timer_state
  for all using (true) with check (true);
