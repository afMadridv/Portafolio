/* =========================================================
   Piezas compartidas de las funciones de /api. Los archivos que
   empiezan por "_" no se publican como ruta en Vercel.

   Variables de entorno:
     BREVO_API_KEY        clave de la API de Brevo
     BREVO_SENDER         remitente verificado en Brevo
     CONTACT_TO           correo que recibe avisos y mensajes
     RESEND_API_KEY       respaldo si no hay BREVO_API_KEY
     SUPABASE_SECRET_KEY  clave secreta de Supabase. SOLO aquí, en
                          Vercel: se salta las reglas RLS. Sirve para
                          guardar mensajes y revisar las webs.
     MONITOR_SECRET       contraseña larga del monitor (la usa el cron)
     VAPID_PUBLIC_KEY     avisos push: ver api/_push.js
     VAPID_PRIVATE_KEY    avisos push. SOLO aquí, en Vercel
   ========================================================= */
const BRAND = "AM Developer";
const SITE_URL = "https://andresmadrid.vercel.app";
const TZ = "America/Bogota";
const TO = process.env.CONTACT_TO || "mvandres08@gmail.com";
const FROM = process.env.CONTACT_FROM || BRAND + " <onboarding@resend.dev>";

// Públicos: también están en script.js
const SUPABASE_URL = "https://mfhyxbekkiugplawbddt.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_jRkmQGoUTw182zPQu7lBhw_soW0SQJv";

function reply(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function stamp(date) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: TZ }).format(date);
}

/* ---------- Correo ---------- */
const canSendMail = () => !!(process.env.BREVO_API_KEY || process.env.RESEND_API_KEY);

/* mail = { subject, html, text, replyEmail?, replyName? }. Lanza error si no sale. */
async function sendMail(mail) {
  const brevo = process.env.BREVO_API_KEY;
  const resend = process.env.RESEND_API_KEY;
  if (!brevo && !resend) throw new Error("sin proveedor de correo");
  const r = brevo
    ? await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevo, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: BRAND, email: process.env.BREVO_SENDER || TO },
          to: [{ email: TO }],
          ...(mail.replyEmail ? { replyTo: { email: mail.replyEmail, name: mail.replyName || mail.replyEmail } } : {}),
          subject: mail.subject,
          htmlContent: mail.html,
          textContent: mail.text,
        }),
      })
    : await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + resend, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          ...(mail.replyEmail ? { reply_to: mail.replyEmail } : {}),
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      });
  if (!r.ok) throw new Error((brevo ? "Brevo " : "Resend ") + r.status + ": " + (await r.text()).slice(0, 300));
}

/* ---------- Supabase con la clave secreta ---------- */
const canUseDb = () => !!process.env.SUPABASE_SECRET_KEY;

async function db(path, opts) {
  const o = opts || {};
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: o.method || "GET",
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY,
      "Content-Type": "application/json",
      Prefer: o.prefer || "return=minimal",
    },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  if (!r.ok) throw new Error("Supabase " + r.status + ": " + (await r.text()).slice(0, 300));
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

/* ¿La petición trae la sesión del admin del panel? */
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

/* ---------- Plantilla de correo de la marca ----------
   Tablas y estilos en línea: es lo único que respetan Gmail, Outlook
   y el correo del móvil. Ningún correo aplica desenfoque, así que el
   vidrio se logra con paneles translúcidos sobre negro, como el
   escritorio del portafolio. Cada color translúcido va después de uno sólido: quien
   no entiende rgba (Outlook de escritorio) se queda con el sólido.
   El logo es PNG porque Gmail no muestra SVG. */
const F = "'Segoe UI',Tahoma,Verdana,Arial,sans-serif";
const EMAIL_LINE = "1px solid #2a2a2a;border-color:rgba(255,255,255,.14)";

/* opts = { tag, accent, title, lead, rows: [[label, htmlValue]], body (html),
            bodyTitle, actions: [[href, label, primary]], foot, preview } */
function brandEmail(opts) {
  const accent = opts.accent || "#fa4040";
  const rows = (opts.rows || [])
    .map(([label, value], i) => {
      const top = i ? "border-top:" + EMAIL_LINE + ";" : "";
      return (
        '<tr><td valign="top" style="padding:9px 14px 9px 0;width:112px;font:12px ' + F + ";color:#bcaeaf;" + top + '">' + esc(label) + "</td>" +
        '<td style="padding:9px 0;font:14px ' + F + ";color:#f6f0f0;word-break:break-word;" + top + '">' + value + "</td></tr>"
      );
    })
    .join("");
  const actions = (opts.actions || [])
    .map(
      ([href, label, primary]) =>
        '<a href="' + esc(href) + '" style="display:inline-block;margin:0 8px 8px 0;padding:11px 20px;border-radius:10px;font:600 14px ' + F + ";text-decoration:none;color:#ffffff;" +
        (primary
          ? "background-color:#b92b2b;background-image:linear-gradient(90deg,#7a0f0f,#d63a3a);border:1px solid #d63a3a;"
          : "background-color:#222222;background-color:rgba(255,255,255,.1);border:" + "1px solid #444444;border-color:rgba(255,255,255,.28);") +
        '">' + esc(label) + "</a>"
    )
    .join("");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background-color:#000000;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preview || opts.lead || "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000;"><tr><td align="center" style="padding:30px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141414" style="max-width:600px;background-color:#141414;background-color:rgba(255,255,255,.07);border:1px solid #333333;border-color:rgba(255,255,255,.2);border-radius:18px;overflow:hidden;">
<tr><td style="padding:16px 26px;background-color:#0d0d0d;background-color:rgba(0,0,0,.28);border-bottom:${EMAIL_LINE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="44" valign="middle" style="width:44px;"><img src="${SITE_URL}/amd.png" width="32" height="32" alt="AMD" style="display:block;width:32px;height:32px;border:0;color:#ffffff;font:700 12px ${F};"></td>
<td valign="middle" style="font:700 15px ${F};letter-spacing:.2px;color:#ffffff;">${esc(BRAND)}</td>
<td align="right" valign="middle"><span style="display:inline-block;padding:4px 11px;border-radius:999px;background-color:${accent};font:700 12px ${F};color:#000000;">${esc(opts.tag)}</span></td>
</tr></table></td></tr>
<tr><td style="padding:26px 26px 6px;">
<div style="font:700 22px/1.3 ${F};color:#ffffff;">${esc(opts.title)}</div>
${opts.lead ? `<div style="padding-top:6px;font:14px/1.55 ${F};color:#d8cbcc;">${esc(opts.lead)}</div>` : ""}
</td></tr>
${rows ? `<tr><td style="padding:14px 26px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>` : ""}
${opts.body ? `<tr><td style="padding:14px 26px 6px;">
${opts.bodyTitle ? `<div style="padding-bottom:7px;font:600 12px ${F};color:#bcaeaf;">${esc(opts.bodyTitle)}</div>` : ""}
<div style="padding:16px 18px;background-color:#0d0d0d;background-color:rgba(0,0,0,.3);border-left:3px solid ${accent};border-radius:0 10px 10px 0;font:15px/1.65 ${F};color:#f6f0f0;word-break:break-word;">${opts.body}</div>
</td></tr>` : ""}
${actions ? `<tr><td style="padding:18px 26px 12px;">${actions}</td></tr>` : ""}
<tr><td style="padding:14px 26px 20px;border-top:${EMAIL_LINE};font:12px/1.5 ${F};color:#a89a9b;">${opts.foot || esc(BRAND)}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

module.exports = {
  BRAND, SITE_URL, TZ, TO, SUPABASE_URL, SUPABASE_PUBLIC_KEY,
  reply, esc, stamp, canSendMail, sendMail, canUseDb, db, sessionIsAdmin, brandEmail,
};
