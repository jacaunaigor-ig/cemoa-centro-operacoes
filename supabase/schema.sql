-- CEMOA · persistência operacional (SQL Editor do Supabase)
-- Sem NEXT_PUBLIC_SUPABASE_URL + chave no ambiente, o painel segue local.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Operador CEMOA',
  login text,
  role text not null default 'operacional'
    check (role in ('chefe', 'meteorologista', 'geologo', 'operacional', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.equipe (
  login text primary key,
  name text not null,
  role text not null,
  setor text not null,
  plantao boolean not null default false
);

insert into public.equipe (login, name, role, setor, plantao) values
  ('karol', 'Karol', 'meteorologista', 'Meteorologia', true),
  ('lenizia', 'Lenizia', 'meteorologista', 'Meteorologia', true),
  ('luan', 'Luan', 'meteorologista', 'Meteorologia', true),
  ('gustavo', 'Gustavo', 'meteorologista', 'Meteorologia', true),
  ('adriana', 'Adriana', 'meteorologista', 'Meteorologia', true),
  ('thayna', 'Thayná', 'geologo', 'Geologia · expediente', false),
  ('igor', 'Igor', 'geologo', 'Geologia · expediente', false),
  ('barroso', 'Capitão BM Barroso', 'chefe', 'Chefe do Centro de Monitoramento', false)
on conflict (login) do update
  set name = excluded.name, role = excluded.role, setor = excluded.setor, plantao = excluded.plantao;

create table if not exists public.alert_overrides (
  tipo text not null,
  municipio_id text not null,
  level text not null,
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_by text,
  issued_by_id text,
  previous_level text,
  updated_by uuid references public.profiles (id),
  primary key (tipo, municipio_id)
);

alter table public.alert_overrides add column if not exists issued_by text;
alter table public.alert_overrides add column if not exists issued_by_id text;
alter table public.alert_overrides add column if not exists previous_level text;

create table if not exists public.classification_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  tipo text not null,
  municipio_id text not null,
  municipio text,
  previous_level text,
  level text not null,
  issued_by text,
  source text not null default 'clique'
);

create table if not exists public.hydro_overrides (
  station_id text primary key,
  patch jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  issued_by text
);

alter table public.hydro_overrides add column if not exists issued_by text;

alter table public.profiles enable row level security;
alter table public.equipe enable row level security;
alter table public.alert_overrides enable row level security;
alter table public.hydro_overrides enable row level security;
alter table public.classification_audit enable row level security;

drop policy if exists "equipe readable" on public.equipe;
create policy "equipe readable" on public.equipe for select using (true);

drop policy if exists "profiles readable by operators" on public.profiles;
create policy "profiles readable by operators"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "operators write alerts" on public.alert_overrides;
create policy "operators write alerts"
  on public.alert_overrides for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('chefe', 'meteorologista', 'geologo', 'operacional', 'admin', 'operator')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('chefe', 'meteorologista', 'geologo', 'operacional', 'admin', 'operator')
    )
  );

drop policy if exists "operators write hydro" on public.hydro_overrides;
create policy "operators write hydro"
  on public.hydro_overrides for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('chefe', 'meteorologista', 'geologo', 'operacional', 'admin', 'operator')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('chefe', 'meteorologista', 'geologo', 'operacional', 'admin', 'operator')
    )
  );

drop policy if exists "alerts readable" on public.alert_overrides;
create policy "alerts readable" on public.alert_overrides for select using (true);

drop policy if exists "hydro readable" on public.hydro_overrides;
create policy "hydro readable" on public.hydro_overrides for select using (true);

drop policy if exists "audit readable" on public.classification_audit;
create policy "audit readable" on public.classification_audit for select using (auth.role() = 'authenticated');

drop policy if exists "operators write audit" on public.classification_audit;
create policy "operators write audit"
  on public.classification_audit for insert
  with check (auth.role() = 'authenticated');

create table if not exists public.meteo_avisos (
  id text primary key,
  issued_at timestamptz not null,
  issued_by text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.meteo_avisos enable row level security;

drop policy if exists "avisos readable" on public.meteo_avisos;
create policy "avisos readable" on public.meteo_avisos for select using (true);

drop policy if exists "operators write avisos" on public.meteo_avisos;
create policy "operators write avisos"
  on public.meteo_avisos for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('chefe', 'meteorologista', 'operacional', 'admin', 'operator')
    )
  );

-- Perfil automático quando a conta nasce no Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, login, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'admin'), '@', 1)),
    lower(coalesce(new.raw_user_meta_data->>'login', split_part(coalesce(new.email, 'admin'), '@', 1))),
    'operacional'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

grant usage on schema public to anon, authenticated, service_role;
grant select on table public.equipe, public.alert_overrides, public.hydro_overrides, public.meteo_avisos to anon, authenticated, service_role;
grant select, insert, update, delete on table public.profiles, public.alert_overrides, public.hydro_overrides, public.classification_audit, public.meteo_avisos to authenticated, service_role;
grant usage, select on sequence public.classification_audit_id_seq to authenticated, service_role;

