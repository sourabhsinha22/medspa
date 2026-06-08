-- Run this in your Supabase SQL Editor (supabase.com → project → SQL Editor)

-- Patients table
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  age integer not null,
  concerns text[] default '{}',
  previous_injectables boolean default false
);

-- Treatment sessions table
create table if not exists treatment_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  patient_id uuid references patients(id) on delete cascade,
  photo_url text,
  selected_zone_ids text[] default '{}',
  zone_scores jsonb default '{}',
  clinician_notes text default '',
  consented_at timestamptz
);

-- Storage bucket for patient photos
insert into storage.buckets (id, name, public)
values ('patient-photos', 'patient-photos', false)
on conflict do nothing;

-- RLS: enable but allow all for now (tighten in Phase 2 with auth)
alter table patients enable row level security;
alter table treatment_sessions enable row level security;

create policy "allow all patients" on patients for all using (true);
create policy "allow all sessions" on treatment_sessions for all using (true);

-- Storage policy
create policy "allow photo uploads" on storage.objects
  for all using (bucket_id = 'patient-photos');
