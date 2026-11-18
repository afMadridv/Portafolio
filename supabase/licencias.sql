-- =========================================================
-- SUSCRIPCIONES, LICENCIAS (CRM) Y CARPETAS DE SITIOS · admin.html
-- Córrelo una vez en Supabase → SQL Editor del proyecto del
-- portafolio. Se puede repetir sin romper nada. También está
-- dentro de schema.sql.
-- =========================================================

-- Sitios: carpeta (p. ej. Legajo) y vencimiento del certificado SSL
alter table public.fl_sites add column if not exists grp text;
alter table public.fl_sites add column if not exists ssl_expires_on date;
alter table public.fl_sites add column if not exists ssl_checked_at timestamptz;

-- Clientes: tipo (Notaría, Centro de conciliación…)
alter table public.fl_clients add column if not exists kind text;

-- Licencia de uso de un producto para un cliente, con su mantenimiento
create table if not exists public.fl_licenses (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.fl_clients(id) on delete set null,
  site_id       uuid references public.fl_sites(id) on delete set null,
  product       text not null default 'Legajo',
  status        text not null default 'activa' check (status in ('activa','suspendida','cancelada')),
  start_date    date not null default current_date,
  price         numeric(14,2) not null default 0 check (price >= 0),
  installments  integer not null default 1 check (installments between 1 and 60),
  maint_fee     numeric(14,2) not null default 0 check (maint_fee >= 0),
  maint_period  text not null default 'anual' check (maint_period in ('mensual','trimestral','anual')),
  maint_until   date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Pagos de una licencia: cuotas, mantenimiento o soporte
create table if not exists public.fl_license_payments (
  id          uuid primary key default gen_random_uuid(),
  license_id  uuid not null references public.fl_licenses(id) on delete cascade,
  concept     text not null check (concept in ('licencia','mantenimiento','soporte')),
  amount      numeric(14,2) not null check (amount > 0),
  paid_on     date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);

-- Arreglos y soporte por horas
create table if not exists public.fl_support (
  id           uuid primary key default gen_random_uuid(),
  license_id   uuid not null references public.fl_licenses(id) on delete cascade,
  happened_on  date not null default current_date,
  description  text not null,
  hours        numeric(6,2) not null default 0 check (hours >= 0),
  rate         numeric(14,2) not null default 0 check (rate >= 0),
  urgent       boolean not null default false,
  covered      boolean not null default false,
  charge       numeric(14,2) not null default 0 check (charge >= 0),
  paid_on      date,
  created_at   timestamptz not null default now()
);

-- Ajustes del panel (tarifa de soporte). Privados: no es site_config.
create table if not exists public.fl_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists fl_licenses_client_idx on public.fl_licenses(client_id);
create index if not exists fl_licenses_site_idx on public.fl_licenses(site_id);
create index if not exists fl_license_payments_license_idx on public.fl_license_payments(license_id);
create index if not exists fl_support_license_idx on public.fl_support(license_id);

drop trigger if exists fl_licenses_touch on public.fl_licenses;
create trigger fl_licenses_touch before update on public.fl_licenses
  for each row execute function public.fl_touch();

do $$
declare
  t text;
begin
  foreach t in array array['fl_licenses','fl_license_payments','fl_support','fl_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, references, trigger on public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "%s solo admin" on public.%I', t, t);
    execute format(
      'create policy "%s solo admin" on public.%I for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin())',
      t, t
    );
  end loop;
end;
$$;

-- Suscripciones de Legajo (Conciliación, Insolvencia) y bloqueo del portal
alter table public.fl_sites add column if not exists is_main boolean not null default false;
alter table public.fl_licenses add column if not exists billing text not null default 'suscripcion';
alter table public.fl_licenses add column if not exists modules text[] not null default '{}';
alter table public.fl_licenses add column if not exists blocked boolean not null default false;
alter table public.fl_licenses add column if not exists blocked_at timestamptz;
alter table public.fl_licenses add column if not exists block_note text;
alter table public.fl_licenses add column if not exists access_key uuid not null default gen_random_uuid();
create unique index if not exists fl_licenses_access_key_idx on public.fl_licenses(access_key);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fl_licenses_billing_check') then
    alter table public.fl_licenses add constraint fl_licenses_billing_check check (billing in ('suscripcion','licencia'));
  end if;
end;
$$;
