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
  constraint site_config_size check (octet_length(data::text) < 500000),
  constraint site_config_is_object check (jsonb_typeof(data) = 'object')
);

-- Quién puede publicar. Para añadir a alguien:
--   insert into public.site_admins (email) values ('otro@correo.com');
create table if not exists public.site_admins (
  email text primary key check (email = lower(email))
);

insert into public.site_admins (email) values ('admin_am@portafolio.com')
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

-- Solo quien ya inició sesión necesita preguntarlo
revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;

-- ---------- Fecha y autor de cada cambio ----------
-- El autor se guarda como id, no como correo: la fila es pública.
create or replace function public.site_config_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid()::text;
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

-- Permisos mínimos: la web anónima solo lee; el admin lee y edita.
-- RLS ya lo impide, pero así ni siquiera se puede intentar.
grant select on public.site_config to anon, authenticated;
grant insert, update on public.site_config to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.site_config from anon;
revoke delete, truncate, references, trigger on public.site_config from authenticated;
revoke all on public.site_admins from anon, authenticated;

-- Función interna de Supabase (activa RLS en tablas nuevas): no es para la API
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

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

-- ---------- Videos de los proyectos (Storage) ----------
-- Bucket público: cualquiera ve un video por su URL pública, pero
-- solo el admin sube, lista, cambia o borra. Máx. 50 MB (plan gratis).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-videos', 'project-videos', true, 52428800, array['video/mp4','video/webm','video/ogg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project-videos admin lee" on storage.objects;
create policy "project-videos admin lee" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-videos' and public.is_site_admin());

drop policy if exists "project-videos admin sube" on storage.objects;
create policy "project-videos admin sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-videos' and public.is_site_admin());

drop policy if exists "project-videos admin cambia" on storage.objects;
create policy "project-videos admin cambia" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-videos' and public.is_site_admin())
  with check (bucket_id = 'project-videos' and public.is_site_admin());

drop policy if exists "project-videos admin borra" on storage.objects;
create policy "project-videos admin borra" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-videos' and public.is_site_admin());
