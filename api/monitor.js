/* =========================================================
   MONITOR DE WEBS
   Revisa las webs de la tabla fl_sites y avisa por correo cuando
   una se cae o vuelve. Lo llama cada 5 minutos un cron de Supabase
   (supabase/monitor-cron.sql) con la cabecera x-monitor-secret.
   También lo llama el botón "Revisar ahora" del panel, con la
   sesión del admin.

   Caída = sin respuesta o error 5xx en 2 revisiones seguidas, para
   no avisar por un fallo de un momento. Un 401/403/404 cuenta como
   arriba: el servidor responde. El error dice la causa (DNS,
   conexión rechazada, certificado…) y cada 12 horas se mira cuándo
   vence el certificado SSL.

   Cobros: una vez al día, desde las 8 a. m. de Colombia, avisa por
   correo y push qué suscripciones vencen en 5 días o ya vencieron.
   Avisa una vez por etapa y, si sigue vencida, cada 7 días. No
   bloquea nada: el bloqueo lo hace el admin a mano en el panel.
   ========================================================= */
const crypto = require("crypto");
const tls = require("tls");
const net = require("net");
const { BRAND, SITE_URL, TZ, reply, esc, stamp, canSendMail, sendMail, canUseDb, db, sessionIsAdmin, brandEmail } = require("./_lib");
const { pushAll } = require("./_push");

const CHECK_TIMEOUT_MS = 8000;
const FAILS_TO_ALERT = 2;
const SSL_EVERY_MS = 12 * 3600 * 1000;

/* Códigos de red de Node → lo que le pasó al servidor */
const NET_ERRORS = {
  ENOTFOUND: "Dominio no encontrado (DNS)",
  EAI_AGAIN: "Dominio no encontrado (DNS)",
  ECONNREFUSED: "Conexión rechazada por el servidor",
  ECONNRESET: "La conexión se cortó",
  EPIPE: "La conexión se cortó",
  EHOSTUNREACH: "Servidor inalcanzable",
  ENETUNREACH: "Servidor inalcanzable",
  CERT_HAS_EXPIRED: "Certificado SSL vencido",
  UND_ERR_CONNECT_TIMEOUT: "Sin respuesta al conectar",
  UND_ERR_SOCKET: "La conexión se cortó",
};

function netError(e) {
  let c = e;
  let code = "";
  for (let i = 0; c && i < 4 && !code; i++, c = c.cause) code = c.code || "";
  if (NET_ERRORS[code]) return NET_ERRORS[code];
  if (/CERT|SELF_SIGNED|ALTNAME|UNABLE_TO_VERIFY|ERR_TLS/.test(code)) return "Certificado SSL no válido";
  return "No se pudo conectar";
}

/* Fecha de vencimiento del certificado, o null si no se pudo leer */
function certExpiry(url) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return resolve(null);
    }
    if (u.protocol !== "https:") return resolve(null);
    const opts = { host: u.hostname, port: Number(u.port) || 443, rejectUnauthorized: false, timeout: 6000 };
    if (!net.isIP(u.hostname)) opts.servername = u.hostname;
    const sock = tls.connect(opts, () => {
      const cert = sock.getPeerCertificate();
      sock.end();
      const when = cert && cert.valid_to ? new Date(cert.valid_to) : null;
      resolve(when && !isNaN(when) ? when : null);
    });
    sock.on("timeout", () => {
      sock.destroy();
      resolve(null);
    });
    sock.on("error", () => resolve(null));
  });
}

function secretOk(req) {
  const want = process.env.MONITOR_SECRET || "";
  const got = String(req.headers["x-monitor-secret"] || "");
  if (!want || want.length !== got.length) return false;
  return crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

async function probe(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Madrixdev-Monitor/1.0" },
    });
    const ms = Date.now() - t0;
    if (r.body) r.body.cancel().catch(() => {});
    return { up: r.status < 500, http: r.status, ms, error: r.status < 500 ? null : "HTTP " + r.status };
  } catch (e) {
    const timedOut = e && e.name === "AbortError";
    return { up: false, http: null, ms: null, error: timedOut ? "Sin respuesta en " + CHECK_TIMEOUT_MS / 1000 + " s" : netError(e) };
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
  const siteLink = '<a href="' + esc(site.url) + '" style="color:#ff9a9a;">' + esc(site.url) + "</a>";
  const rows = [["Web", siteLink], ["Cuándo", esc(stamp(now)) + " (hora de Colombia)"]];
  if (down) rows.push(["Problema", esc(detail)]);
  else rows.push(["Estuvo caída", esc(downFor)]);
  const title = down ? site.name + " está caída" : site.name + " volvió";
  return {
    subject: (down ? "[CAÍDA] " : "[RESUELTO] ") + site.name,
    html: brandEmail({
      tag: down ? "Web caída" : "Web arriba",
      accent: down ? "#fa4040" : "#6fdc6f",
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
  const sslDue = /^https:/i.test(site.url) && (!site.ssl_checked_at || now - new Date(site.ssl_checked_at) > SSL_EVERY_MS);
  const [result, cert] = await Promise.all([probe(site.url), sslDue ? certExpiry(site.url) : null]);
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
  // Aparte: si aún no existen las columnas del SSL, la revisión principal sigue funcionando
  if (sslDue) {
    try {
      await db("fl_sites?id=eq." + site.id, {
        method: "PATCH",
        body: Object.assign({ ssl_checked_at: now.toISOString() }, cert ? { ssl_expires_on: cert.toISOString().slice(0, 10) } : {}),
      });
    } catch (e) {
      console.error("SSL sin guardar:", site.name, e.message);
    }
  }
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
  await pushAll({
    title: event === "down" ? site.name + " está caída" : site.name + " volvió",
    body: event === "down" ? detail : "Estuvo caída " + downFor,
    url: "/admin.html#sitios",
    tag: "sitio-" + site.id,
  });
  return { name: site.name, status: patch.status, event };
}

/* ---------- Cobros de suscripciones ---------- */
const SOON_DAYS = 5;
const REPEAT_DAYS = 7;
const PERIOD_MONTHS = { mensual: 1, trimestral: 3, anual: 12 };
const MODULE_NAMES = { conciliacion: "Conciliación", insolvencia: "Insolvencia" };

const bogotaDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const bogotaHour = (d) => Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(d));
const dayDiff = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const money = (n) => Math.round(Number(n) || 0).toLocaleString("es-CO") + " COP";

function monthsBetween(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am) - (bd < ad ? 1 : 0);
}

/* Igual que maintState del panel: vence pronto o vencida, con lo que se debe */
function billingState(l, today) {
  const fee = Number(l.maint_fee) || 0;
  if (fee <= 0 || !l.maint_until) return null;
  const until = String(l.maint_until).slice(0, 10);
  const d = dayDiff(today, until);
  if (d < 0) {
    const owed = Math.floor(monthsBetween(until, today) / (PERIOD_MONTHS[l.maint_period] || 12)) + 1;
    return { stage: "vencida", days: -d, due: owed * fee, until };
  }
  if (d <= SOON_DAYS) return { stage: "pronto", days: d, due: fee, until };
  return null;
}

function billingLine(item) {
  const { l, st } = item;
  const what = (l.modules || []).map((m) => MODULE_NAMES[m] || m).join(" + ") || l.product || "Legajo";
  const when = st.stage === "vencida" ? "Vencida hace " + st.days + (st.days === 1 ? " día" : " días") : st.days === 0 ? "Vence hoy" : "Vence en " + st.days + (st.days === 1 ? " día" : " días");
  return { name: (l.client && l.client.name) || "Sin cliente", text: when + " · " + money(st.due) + " · " + what };
}

async function billingCheck(now, force) {
  const today = bogotaDay(now);
  if (!force && bogotaHour(now) < 8) return null;
  const rows = await db("fl_settings?key=eq.avisos_cobro&select=value");
  const memo = (rows && rows[0] && rows[0].value) || {};
  if (!force && memo.last_run === today) return null;

  const lics = await db(
    "fl_licenses?status=eq.activa&blocked=is.false&select=id,product,modules,maint_fee,maint_period,maint_until,client:fl_clients(name)"
  );
  const sent = memo.sent || {};
  const items = [];
  for (const l of lics) {
    const st = billingState(l, today);
    if (!st) {
      delete sent[l.id];
      continue;
    }
    const prev = sent[l.id];
    const again = prev && prev.stage === "vencida" && st.stage === "vencida" && dayDiff(prev.on, today) >= REPEAT_DAYS;
    if (!force && prev && prev.stage === st.stage && !again) continue;
    sent[l.id] = { stage: st.stage, on: today };
    items.push({ l, st });
  }
  await db("fl_settings", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: { key: "avisos_cobro", value: { last_run: today, sent }, updated_at: now.toISOString() },
  });
  if (!items.length) return { avisos: 0 };

  items.sort((a, b) => (a.st.stage === b.st.stage ? b.st.due - a.st.due : a.st.stage === "vencida" ? -1 : 1));
  const late = items.filter((i) => i.st.stage === "vencida").length;
  const soon = items.length - late;
  const lines = items.map(billingLine);
  const total = items.reduce((n, i) => n + i.st.due, 0);
  const title = [late ? late + (late === 1 ? " suscripción vencida" : " suscripciones vencidas") : "", soon ? soon + " por vencer" : ""].filter(Boolean).join(" y ");

  if (canSendMail()) {
    try {
      await sendMail({
        subject: "[COBRO] " + title,
        html: brandEmail({
          tag: "Cobros",
          accent: late ? "#fa4040" : "#f5c46b",
          title: "Hay que cobrar: " + title,
          lead: "Por cobrar: " + money(total) + ". El bloqueo del portal lo decides tú en el panel.",
          rows: lines.map((x) => [x.name, esc(x.text)]),
          actions: [[SITE_URL + "/admin.html#licencias", "Abrir Suscripciones", true]],
          foot: esc(BRAND) + " · Aviso de cobros, una vez al día",
        }),
        text: ["Hay que cobrar: " + title, "Por cobrar: " + money(total), ""].concat(lines.map((x) => x.name + ": " + x.text)).join("\n"),
      });
    } catch (e) {
      console.error("Aviso de cobros sin enviar:", e.message);
    }
  }
  await pushAll({
    title: "Cobros: " + title,
    body: lines.slice(0, 4).map((x) => x.name).join(", ") + (lines.length > 4 ? " y " + (lines.length - 4) + " más" : ""),
    url: "/admin.html#licencias",
    tag: "cobros",
  });
  return { avisos: items.length };
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
    // Aparte: un fallo de cobros no tumba el monitor
    let cobros = null;
    try {
      cobros = await billingCheck(now, new URL(req.url, "http://x").searchParams.get("cobros") === "1");
    } catch (e) {
      console.error("Cobros:", e.message);
    }
    return reply(res, 200, { ok: true, checked: results.length, results, cobros });
  } catch (e) {
    console.error("Monitor:", e.message);
    return reply(res, 500, { ok: false, error: "monitor_failed" });
  }
};

module.exports.probe = probe;
module.exports.certExpiry = certExpiry;
module.exports.netError = netError;
module.exports.billingState = billingState;
module.exports.billingCheck = billingCheck;
