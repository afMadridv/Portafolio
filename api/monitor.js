/* =========================================================
   MONITOR DE WEBS
   Revisa las webs de la tabla fl_sites y avisa por correo cuando
   una se cae o vuelve. Lo llama cada 5 minutos un cron de Supabase
   (supabase/monitor-cron.sql) con la cabecera x-monitor-secret.
   También lo llama el botón "Revisar ahora" del panel, con la
   sesión del admin.

   Caída = sin respuesta o error 5xx en 2 revisiones seguidas, para
   no avisar por un fallo de un momento. Un 401/403/404 cuenta como
   arriba: el servidor responde.
   ========================================================= */
const crypto = require("crypto");
const { BRAND, SITE_URL, SUPABASE_URL, SUPABASE_PUBLIC_KEY, reply, esc, stamp, canSendMail, sendMail, canUseDb, db, brandEmail } = require("./_lib");

const CHECK_TIMEOUT_MS = 8000;
const FAILS_TO_ALERT = 2;

function secretOk(req) {
  const want = process.env.MONITOR_SECRET || "";
  const got = String(req.headers["x-monitor-secret"] || "");
  if (!want || want.length !== got.length) return false;
  return crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

async function sessionIsAdmin(req) {
  const auth = String(req.headers.authorization || "");
  if (!auth.startsWith("Bearer ")) return false;
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/is_site_admin", {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: auth, "Content-Type": "application/json" },
    body: "{}",
  });
  return r.ok && (await r.json()) === true;
}

async function probe(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "AMDeveloper-Monitor/1.0" },
    });
    const ms = Date.now() - t0;
    if (r.body) r.body.cancel().catch(() => {});
    return { up: r.status < 500, http: r.status, ms, error: r.status < 500 ? null : "HTTP " + r.status };
  } catch (e) {
    const timedOut = e && e.name === "AbortError";
    return { up: false, http: null, ms: null, error: timedOut ? "Sin respuesta en " + CHECK_TIMEOUT_MS / 1000 + " s" : "No se pudo conectar" };
  } finally {
    clearTimeout(timer);
  }
}

function duration(fromIso, to) {
  const min = Math.max(1, Math.round((to - new Date(fromIso)) / 60000));
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60);
  return h + " h " + (min % 60) + " min";
}

function alertMail(site, kind, now, detail, downFor) {
  const down = kind === "down";
  const siteLink = '<a href="' + esc(site.url) + '" style="color:#0b4f8a;">' + esc(site.url) + "</a>";
  const rows = [["Web", siteLink], ["Cuándo", esc(stamp(now)) + " (hora de Colombia)"]];
  if (down) rows.push(["Problema", esc(detail)]);
  else rows.push(["Estuvo caída", esc(downFor)]);
  const title = down ? site.name + " está caída" : site.name + " volvió";
  return {
    subject: (down ? "[CAÍDA] " : "[RESUELTO] ") + site.name,
    html: brandEmail({
      tag: down ? "Web caída" : "Web arriba",
      accent: down ? "#b91c1c" : "#15803d",
      title,
      lead: down ? "Falló en dos revisiones seguidas." : "Ya responde con normalidad.",
      rows,
      actions: [[SITE_URL + "/admin.html#sitios", "Abrir panel", true], [site.url, "Abrir la web", false]],
      foot: esc(BRAND) + " · Monitor de webs",
    }),
    text: [title, "Web: " + site.url, "Cuándo: " + stamp(now), down ? "Problema: " + detail : "Estuvo caída: " + downFor].join("\n"),
  };
}

async function checkSite(site, now) {
  const result = await probe(site.url);
  const fails = result.up ? 0 : (site.fail_count || 0) + 1;
  const patch = {
    last_checked_at: now.toISOString(),
    last_ms: result.ms,
    last_http: result.http,
    last_error: result.error,
    fail_count: fails,
  };
  let event = null;
  if (result.up) {
    if (site.status === "down") event = "up";
    patch.status = "up";
  } else if (fails >= FAILS_TO_ALERT) {
    if (site.status !== "down") event = "down";
    patch.status = "down";
  }
  if (event || site.status === "unknown") patch.last_change_at = now.toISOString();

  await db("fl_sites?id=eq." + site.id, { method: "PATCH", body: patch });
  if (!event) return { name: site.name, status: patch.status || site.status };

  const detail = result.error || "";
  const downFor = event === "up" && site.last_change_at ? duration(site.last_change_at, now) : "";
  await db("fl_site_events", { method: "POST", body: { site_id: site.id, kind: event, at: now.toISOString(), detail: event === "down" ? detail : "Estuvo caída " + downFor } });
  if (canSendMail()) {
    try {
      await sendMail(alertMail(site, event, now, detail, downFor));
    } catch (e) {
      console.error("Aviso del monitor sin enviar:", e.message);
    }
  }
  return { name: site.name, status: patch.status, event };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return reply(res, 405, { ok: false, error: "method" });
  }
  let allowed = secretOk(req);
  if (!allowed) {
    try {
      allowed = await sessionIsAdmin(req);
    } catch (e) {
      allowed = false;
    }
  }
  if (!allowed) return reply(res, 401, { ok: false, error: "unauthorized" });

  // Botón "Probar correo" del panel: devuelve el error exacto del proveedor
  if (new URL(req.url, "http://x").searchParams.get("test") === "mail") {
    if (!canSendMail()) return reply(res, 200, { ok: false, error: "No hay BREVO_API_KEY en Vercel" });
    try {
      await sendMail({
        subject: "[Prueba] Correo del panel",
        html: brandEmail({
          tag: "Prueba",
          title: "El correo funciona",
          lead: "Este mensaje lo envió el botón Probar correo del panel.",
          foot: esc(BRAND),
        }),
        text: "El correo funciona. Lo envió el botón Probar correo del panel.",
      });
      return reply(res, 200, { ok: true });
    } catch (e) {
      return reply(res, 200, { ok: false, error: e.message });
    }
  }
  if (!canUseDb()) return reply(res, 503, { ok: false, error: "not_configured" });

  try {
    const sites = await db("fl_sites?active=is.true&select=*");
    const now = new Date();
    const results = await Promise.all(sites.map((s) => checkSite(s, now)));
    return reply(res, 200, { ok: true, checked: results.length, results });
  } catch (e) {
    console.error("Monitor:", e.message);
    return reply(res, 500, { ok: false, error: "monitor_failed" });
  }
};

module.exports.probe = probe;
