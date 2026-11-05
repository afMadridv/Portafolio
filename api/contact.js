/* =========================================================
   FORMULARIO DE CONTACTO — envío directo
   Función de Vercel (Node). La ventana "Contacto" del escritorio
   manda aquí el formulario: se guarda en la Bandeja del panel
   (tabla fl_messages) y te llega al correo con Brevo. El visitante
   no sale del portafolio ni abre su correo. No usa cookies.

   Variables de entorno: ver api/_lib.js. Sin proveedor de correo
   ni base de datos responde 503 y la ventana pasa al plan B.
   ========================================================= */
const { BRAND, reply, esc, stamp, canSendMail, sendMail, canUseDb, db, brandEmail } = require("./_lib");

const LIMITS = { name: 80, email: 120, subject: 120, message: 4000 };
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

/* Formatos de correo: cada motivo del formulario lleva su etiqueta en
   el asunto, su titular y los datos extra que pide. */
const EXTRA_MAX = 160;
const MOTIVES = {
  cotizar: {
    tag: "Cotización",
    accent: "#0b4f8a",
    title: "Quieren cotizar un proyecto",
    rows: [["projectType", "Proyecto"], ["budget", "Presupuesto"], ["deadline", "Para cuándo"]],
  },
  colaborar: {
    tag: "Colaboración",
    accent: "#0f766e",
    title: "Quieren colaborar contigo",
    rows: [["collabArea", "En qué"], ["link", "Enlace"]],
  },
  empleo: {
    tag: "Empleo",
    accent: "#6d28d9",
    title: "Tienes una oferta de empleo",
    rows: [["company", "Empresa"], ["link", "Vacante"]],
  },
  otro: { tag: "Contacto", accent: "#374151", title: "Tienes un mensaje nuevo", rows: [] },
};

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
  data.motive = MOTIVES[body.motive] ? body.motive : "otro";
  data.extra = {};
  MOTIVES[data.motive].rows.forEach(([key]) => {
    const v = line(body[key]).slice(0, EXTRA_MAX);
    if (v) data.extra[key] = v;
  });
  return { data };
}

/* ---------------------------------------------------------
   El correo que recibes: formato exclusivo de la marca, con el
   motivo en el asunto, en la etiqueta y en el color.
   --------------------------------------------------------- */
function renderEmail(d, opts) {
  const site = opts.site;
  const when = stamp(opts.date || new Date());
  const lang = opts.lang === "en" ? "Inglés" : "Español";
  const first = d.name.split(/\s+/)[0];
  const motive = MOTIVES[d.motive] || MOTIVES.otro;
  const extra = d.extra || {};
  const extraRows = motive.rows.filter(([key]) => extra[key]);
  const extraValue = (key) =>
    /^https?:\/\//i.test(extra[key])
      ? '<a href="' + esc(extra[key]) + '" style="color:' + motive.accent + ';">' + esc(extra[key]) + "</a>"
      : esc(extra[key]);
  const replyHref = "mailto:" + d.email + "?subject=" + encodeURIComponent("Re: " + d.subject);

  const html = brandEmail({
    tag: motive.tag,
    accent: motive.accent,
    title: motive.title,
    lead: first + " te escribió desde tu portafolio.",
    preview: d.message.replace(/\s+/g, " ").slice(0, 110),
    rows: [
      ["De", "<strong>" + esc(d.name) + "</strong>"],
      ["Correo", '<a href="mailto:' + esc(d.email) + '" style="color:' + motive.accent + ';">' + esc(d.email) + "</a>"],
      ["Asunto", esc(d.subject)],
      ...extraRows.map(([key, label]) => [label, extraValue(key)]),
      ["Recibido", esc(when)],
      ["Idioma", lang],
    ],
    bodyTitle: "Mensaje",
    body: esc(d.message).replace(/\n/g, "<br>"),
    actions: [
      [replyHref, "Responder a " + first, true],
      [site + "/admin.html#bandeja", "Abrir bandeja", false],
    ],
    foot: esc(BRAND) + " · Si respondes a este correo, le llega a " + esc(d.name) + ".",
  });

  const plain = [
    motive.title + " · " + BRAND,
    "",
    "De:       " + d.name,
    "Correo:   " + d.email,
    "Motivo:   " + motive.tag,
    "Asunto:   " + d.subject,
    ...extraRows.map(([key, label]) => (label + ":").padEnd(10) + extra[key]),
    "Recibido: " + when + " (hora de Colombia)",
    "Idioma:   " + lang,
    "",
    d.message,
    "",
    "Si respondes a este correo, le llega a " + d.name + ".",
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

  if (!canSendMail() && !canUseDb()) return reply(res, 503, { ok: false, error: "not_configured" });

  const d = checked.data;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || (/^localhost\b/.test(host) ? "http" : "https");
  const mail = renderEmail(d, { site: proto + "://" + host, lang: body.lang });
  const motive = MOTIVES[d.motive] || MOTIVES.otro;

  // Primero a la Bandeja: si el correo falla, el mensaje no se pierde
  let saved = false;
  if (canUseDb()) {
    try {
      await db("fl_messages", {
        method: "POST",
        body: {
          motive: d.motive,
          name: d.name,
          email: d.email,
          subject: d.subject,
          message: d.message,
          extra: d.extra,
          lang: body.lang === "en" ? "en" : "es",
        },
      });
      saved = true;
    } catch (e) {
      console.error("Mensaje sin guardar:", e.message);
    }
  }

  let sent = false;
  if (canSendMail()) {
    try {
      await sendMail({
        subject: "[" + motive.tag + "] " + d.subject + " — " + d.name,
        html: mail.html,
        text: mail.text,
        replyEmail: d.email,
        replyName: d.name,
      });
      sent = true;
    } catch (e) {
      console.error("Correo sin enviar:", e.message);
    }
  }

  if (saved || sent) return reply(res, 200, { ok: true });
  return reply(res, 502, { ok: false, error: "send_failed" });
};

module.exports.renderEmail = renderEmail;
