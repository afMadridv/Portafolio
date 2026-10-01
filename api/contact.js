/* =========================================================
   FORMULARIO DE CONTACTO — envío directo
   Función de Vercel (Node). La ventana "Contacto" del escritorio
   manda aquí el formulario y esto lo reenvía a tu correo con
   Resend: el visitante no sale del portafolio ni abre su correo.

   No hace falta npm ni paso de compilación: Vercel convierte
   cada archivo de /api en una función.

   Variables de entorno (Vercel → Settings → Environment Variables):
     RESEND_API_KEY  obligatoria. Sin ella responde 503 y la
                     ventana pasa al plan B (Gmail, Outlook…).
     CONTACT_TO      opcional. Correo que recibe los mensajes.
                     Sin dominio propio en Resend tiene que ser
                     el mismo correo con el que abriste la cuenta.
     CONTACT_FROM    opcional. Remitente. Sin dominio propio
                     solo vale onboarding@resend.dev.

   No usa cookies ni guarda nada: recibe, valida y reenvía.
   ========================================================= */

const TO = process.env.CONTACT_TO || "mvandres08@gmail.com";
const FROM = process.env.CONTACT_FROM || "Portafolio <onboarding@resend.dev>";
const TZ = "America/Bogota";

const LIMITS = { name: 80, email: 120, subject: 120, message: 4000 };
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

/* Freno contra envíos en ráfaga: 5 mensajes cada 10 minutos por
   IP. Vive en la memoria de la función, así que es aproximado
   (cada instancia lleva su cuenta), pero corta a un bot simple. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function tooMany(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) {
    for (const [key, list] of hits) {
      if (now - list[list.length - 1] > WINDOW_MS) hits.delete(key);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

function reply(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  try {
    if (req.body && typeof req.body === "object") return req.body;
    if (typeof req.body === "string") return JSON.parse(req.body);
  } catch (e) {
    return null;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20000) return null;
  }
  try {
    return JSON.parse(raw || "{}");
  } catch (e) {
    return null;
  }
}

/* Solo se acepta desde el propio sitio: el navegador siempre manda
   Origin en un POST, y tiene que coincidir con el host que responde.
   Así ninguna otra web puede usar este formulario como relevo. */
function sameOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  try {
    return new URL(req.headers.origin).host === host;
  } catch (e) {
    return false;
  }
}

// Texto de una línea: sin saltos ni caracteres de control
const line = (v) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
const text = (v) =>
  String(v == null ? "" : v)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim();

function validate(body) {
  const data = {
    name: line(body.name),
    email: line(body.email),
    subject: line(body.subject),
    message: text(body.message),
  };
  for (const field of Object.keys(LIMITS)) {
    if (!data[field] || data[field].length > LIMITS[field]) return { field };
  }
  if (!EMAIL_RE.test(data.email)) return { field: "email" };
  return { data };
}

/* ---------------------------------------------------------
   El correo: una ventana del escritorio en pequeño.
   Todo con tablas y estilos en línea, que es lo único que
   respetan Gmail, Outlook y el correo del móvil. El biselado
   se hace con bordes (box-shadow no llega a todos).
   --------------------------------------------------------- */
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const FONT_UI = "Tahoma,Verdana,Segoe UI,Arial,sans-serif";
const FONT_MONO = "'Courier New',Consolas,monospace";
const RAISED =
  "border-top:2px solid #ffffff;border-left:2px solid #ffffff;" +
  "border-right:2px solid #1b1b1b;border-bottom:2px solid #1b1b1b;";
const SUNKEN =
  "border-top:2px solid #808080;border-left:2px solid #808080;" +
  "border-right:2px solid #ffffff;border-bottom:2px solid #ffffff;";

function stamp(date) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: TZ,
  }).format(date);
}

function renderEmail(d, opts) {
  const site = opts.site;
  const host = site.replace(/^https?:\/\//, "");
  const when = stamp(opts.date || new Date());
  const lang = opts.lang === "en" ? "Inglés" : "Español";
  const first = d.name.split(/\s+/)[0];
  const replyHref =
    "mailto:" + esc(d.email) + "?subject=" + encodeURIComponent("Re: " + d.subject);
  const preview = d.message.replace(/\s+/g, " ").slice(0, 110);

  const winBtn = (label) =>
    '<td style="padding-left:2px;"><div style="width:16px;height:14px;line-height:13px;' +
    "background:#c6c6c6;" + RAISED.replace(/2px/g, "1px") +
    "font:bold 10px " + FONT_UI + ';color:#101010;text-align:center;">' + label + "</div></td>";

  const row = (label, value) =>
    '<tr><td valign="top" style="padding:5px 10px 5px 12px;width:68px;white-space:nowrap;' +
    "font:bold 12px " + FONT_MONO + ';color:#6e6e6e;">' + label + "</td>" +
    '<td style="padding:5px 12px 5px 0;font:13px ' + FONT_UI + ';color:#101010;word-break:break-word;">' +
    value + "</td></tr>";

  const button = (href, label, strong) =>
    '<a href="' + href + '" style="display:inline-block;margin:0 0 6px 6px;padding:8px 16px;' +
    "background:#c6c6c6;" + RAISED + "font:" + (strong ? "bold " : "") + "13px " + FONT_UI +
    ";color:" + (strong ? "#6d0d0d" : "#101010") + ';text-decoration:none;">' + label + "</a>";

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(d.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#000000;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#000000;">${esc(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;">
<tr><td align="center" style="padding:28px 10px 22px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background:#c6c6c6;${RAISED}">

<tr><td style="padding:3px 3px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#7a0f0f;background-image:linear-gradient(90deg,#7a0f0f,#d63a3a);">
<tr>
<td style="padding:5px 8px;font:bold 13px ${FONT_UI};color:#ffffff;">&#9993;&nbsp; Mensaje nuevo &mdash; Portafolio</td>
<td align="right" style="padding:3px 4px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${winBtn("_")}${winBtn("&#9633;")}${winBtn("&times;")}</tr></table></td>
</tr>
</table>
</td></tr>

<tr><td style="padding:4px 11px 2px;font:12px ${FONT_UI};color:#101010;">
<u>A</u>rchivo&nbsp;&nbsp;&nbsp;<u>E</u>dici&oacute;n&nbsp;&nbsp;&nbsp;<u>V</u>er&nbsp;&nbsp;&nbsp;<u>A</u>yuda
</td></tr>
<tr><td style="padding:0 3px;"><div style="height:0;border-top:1px solid #808080;border-bottom:1px solid #ffffff;font-size:0;line-height:0;">&nbsp;</div></td></tr>

<tr><td style="padding:16px 16px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" width="64"><img src="${site}/img/mail.png" width="64" height="64" alt="" style="display:block;border:0;image-rendering:pixelated;"></td>
<td style="padding-left:14px;">
<div style="font:bold 18px ${FONT_MONO};color:#101010;letter-spacing:0.5px;">Tienes un mensaje nuevo</div>
<div style="padding-top:4px;font:12px ${FONT_UI};color:#4a4a4a;">${esc(first)} te escribi&oacute; desde el formulario de tu portafolio.</div>
</td>
</tr></table>
</td></tr>

<tr><td style="padding:6px 16px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;${SUNKEN}">
<tr><td style="height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
${row("De", esc(d.name))}
${row("Correo", '<a href="mailto:' + esc(d.email) + '" style="color:#0a3fd0;">' + esc(d.email) + "</a>")}
${row("Asunto", "<strong>" + esc(d.subject) + "</strong>")}
${row("Fecha", esc(when) + ' <span style="color:#808080;">(hora de Colombia)</span>')}
${row("Idioma", lang)}
<tr><td style="height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
</table>
</td></tr>

<tr><td style="padding:12px 16px 4px;font:bold 12px ${FONT_UI};color:#101010;">Mensaje</td></tr>
<tr><td style="padding:0 16px 6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;${SUNKEN}">
<tr><td style="padding:16px 18px;font:14px/1.65 ${FONT_UI};color:#101010;word-break:break-word;">${esc(d.message).replace(/\n/g, "<br>")}</td></tr>
</table>
</td></tr>

<tr><td align="right" style="padding:10px 10px 10px 16px;">
${button(replyHref, "Responder a " + esc(first), true)}${button(site, "Abrir portafolio", false)}
</td></tr>

<tr><td style="padding:0 3px 3px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:3px 8px;font:11px ${FONT_UI};color:#101010;border-top:1px solid #808080;border-left:1px solid #808080;border-right:1px solid #ffffff;border-bottom:1px solid #ffffff;">Formulario de contacto</td>
<td width="3" style="font-size:0;">&nbsp;</td>
<td align="right" style="padding:3px 8px;font:11px ${FONT_UI};color:#101010;white-space:nowrap;border-top:1px solid #808080;border-left:1px solid #808080;border-right:1px solid #ffffff;border-bottom:1px solid #ffffff;">${esc(host)}</td>
</tr></table>
</td></tr>

</table>

<p style="max-width:560px;margin:14px auto 0;font:11px/1.5 ${FONT_UI};color:#8a8a8a;">Si respondes a este correo, la respuesta le llega a ${esc(d.name)} (${esc(d.email)}).</p>

</td></tr>
</table>
</body>
</html>`;

  const plain = [
    "Mensaje nuevo desde tu portafolio",
    "=================================",
    "",
    "De:      " + d.name,
    "Correo:  " + d.email,
    "Asunto:  " + d.subject,
    "Fecha:   " + when + " (hora de Colombia)",
    "Idioma:  " + lang,
    "",
    "---------------------------------",
    d.message,
    "---------------------------------",
    "",
    "Si respondes a este correo, la respuesta le llega a " + d.name + ".",
    site,
  ].join("\n");

  return { html, text: plain };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return reply(res, 405, { ok: false, error: "method" });
  }
  if (!sameOrigin(req)) return reply(res, 403, { ok: false, error: "origin" });

  const body = await readBody(req);
  if (!body || typeof body !== "object") return reply(res, 400, { ok: false, error: "body" });

  // Trampas para bots: el campo invisible lleno o un envío más
  // rápido de lo que tarda una persona en escribir. Se responde
  // "ok" para que el bot no sepa que lo pillaron.
  if (body.website || !(Number(body.elapsed) >= 2500)) return reply(res, 200, { ok: true });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "local";
  if (tooMany(ip)) return reply(res, 429, { ok: false, error: "rate" });

  const checked = validate(body);
  if (!checked.data) return reply(res, 400, { ok: false, error: "invalid", field: checked.field });

  const key = process.env.RESEND_API_KEY;
  if (!key) return reply(res, 503, { ok: false, error: "not_configured" });

  const d = checked.data;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || (/^localhost\b/.test(host) ? "http" : "https");
  const mail = renderEmail(d, { site: proto + "://" + host, lang: body.lang });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: d.email,
        subject: d.subject + " — " + d.name + " (portafolio)",
        html: mail.html,
        text: mail.text,
      }),
    });
    if (!r.ok) {
      console.error("Resend respondió", r.status, await r.text());
      return reply(res, 502, { ok: false, error: "send_failed" });
    }
    return reply(res, 200, { ok: true });
  } catch (e) {
    console.error("Resend no responde:", e);
    return reply(res, 502, { ok: false, error: "send_failed" });
  }
};

module.exports.renderEmail = renderEmail;
