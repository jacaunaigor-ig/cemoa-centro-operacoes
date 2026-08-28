-- CEMOA · persistência operacional (rode no SQL Editor do Supabase)
-- Auth: use Supabase Auth (e-mail/senha ou Google) e marque o perfil como operator/admin.
-- Enquanto NEXT_PUBLIC_SUPABASE_URL e a chave não estiverem no ambiente,
-- o painel continua no modo local (cookie + memória/arquivo).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Operador CEMOA',
  role text not null default 'operator' check (role in ('admin', 'operator', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.alert_overrides (
  tipo text not null,
  municipio_id text not null,
  level text not null,
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  primary key (tipo, municipio_id)
);

create table if not exists public.hydro_overrides (
  station_id text primary key,
  patch jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.profiles enable row level security;
alter table public.alert_overrides enable row level security;
alter table public.hydro_overrides enable row level security;

create policy "profiles readable by operators"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "operators write alerts"
  on public.alert_overrides for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'operator')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'operator')
    )
  );

create policy "operators write hydro"
  on public.hydro_overrides for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'operator')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'operator')
    )
  );

-- Leitura pública do recorte operacional (o painel é de monitoramento).
create policy "alerts readable"
  on public.alert_overrides for select
  using (true);

create policy "hydro readable"
  on public.hydro_overrides for select
  using (true);
