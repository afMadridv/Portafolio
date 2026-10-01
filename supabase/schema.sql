-- =========================================================
-- PORTAFOLIO — escritorio publicado en Supabase
-- Pegar entero en Supabase → SQL Editor → Run. Se puede
-- ejecutar más de una vez: no duplica ni borra nada.
--
-- Una sola fila (id = 'desktop') guarda toda la config del
-- escritorio en JSON. Cualquiera la lee; solo los correos de
-- site_admins pueden cambiarla. Cada cambio sale por Realtime
-- y las visitas que tengan la página abierta lo ven al momento.
-- =========================================================

-- ---------- Tablas ----------
create table if not exists public.site_config (
  id          text primary key default 'desktop',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  constraint site_config_size check (octet_length(data::text) < 500000)
);

-- Quién puede publicar. Para añadir a alguien:
--   insert into public.site_admins (email) values ('otro@correo.com');
create table if not exists public.site_admins (
  email text primary key check (email = lower(email))
);

insert into public.site_admins (email) values ('amvcbn@gmail.com')
on conflict do nothing;

-- Fila de partida: '{}' = escritorio de fábrica (el de script.js)
insert into public.site_config (id, data) values ('desktop', '{}'::jsonb)
on conflict do nothing;

-- ---------- ¿Es admin quien hace la petición? ----------
-- security definer: puede mirar site_admins aunque el que
-- pregunta no tenga permiso de leerla.
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to anon, authenticated;

-- ---------- Fecha y autor de cada cambio ----------
create or replace function public.site_config_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.jwt() ->> 'email';
  return new;
end;
$$;

drop trigger if exists site_config_touch on public.site_config;
create trigger site_config_touch
  before insert or update on public.site_config
  for each row execute function public.site_config_touch();

-- ---------- Permisos (RLS) ----------
alter table public.site_config enable row level security;
alter table public.site_admins enable row level security;

grant select on public.site_config to anon, authenticated;
grant insert, update on public.site_config to authenticated;
revoke all on public.site_admins from anon, authenticated;

drop policy if exists "site_config lectura publica" on public.site_config;
create policy "site_config lectura publica"
  on public.site_config for select
  to anon, authenticated
  using (true);

drop policy if exists "site_config alta solo admins" on public.site_config;
create policy "site_config alta solo admins"
  on public.site_config for insert
  to authenticated
  with check (public.is_site_admin());

drop policy if exists "site_config cambios solo admins" on public.site_config;
create policy "site_config cambios solo admins"
  on public.site_config for update
  to authenticated
  using (public.is_site_admin())
  with check (public.is_site_admin());

-- Sin política de delete: nadie puede borrar la fila desde la web.
-- site_admins no tiene políticas: solo se toca desde el panel de Supabase.

-- ---------- Tiempo real ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'site_config'
  ) then
    alter publication supabase_realtime add table public.site_config;
  end if;
end;
$$;
