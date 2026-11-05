-- =========================================================
-- CRON DEL MONITOR: revisa las webs cada 5 minutos.
-- Pegar en Supabase → SQL Editor DESPUÉS de cambiar PON_AQUI_TU_MONITOR_SECRET
-- por el mismo valor de MONITOR_SECRET en Vercel.
-- No guardes este archivo con el valor real: el repo es público.
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'monitor-webs',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://andresmadrid.vercel.app/api/monitor',
    headers := jsonb_build_object('x-monitor-secret', 'PON_AQUI_TU_MONITOR_SECRET'),
    timeout_milliseconds := 25000
  );
  $$
);

-- Para detenerlo:  select cron.unschedule('monitor-webs');
