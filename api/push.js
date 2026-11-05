/* =========================================================
   AVISOS PUSH DEL PANEL
   GET  da la clave pública, que el navegador necesita para suscribirse.
   POST (solo admin) manda un aviso de prueba a los dispositivos.
   ========================================================= */
const { reply, sessionIsAdmin } = require("./_lib");
const { canPush, pushAll } = require("./_push");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return reply(res, 200, { ok: true, key: canPush() ? process.env.VAPID_PUBLIC_KEY : null });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return reply(res, 405, { ok: false, error: "method" });
  }
  let allowed = false;
  try {
    allowed = await sessionIsAdmin(req);
  } catch (e) {}
  if (!allowed) return reply(res, 401, { ok: false, error: "unauthorized" });
  if (!canPush()) return reply(res, 200, { ok: false, error: "Faltan las claves VAPID en Vercel" });

  const out = await pushAll({ title: "AM Developer", body: "Los avisos funcionan en este dispositivo.", url: "/admin.html", tag: "prueba" });
  return reply(res, 200, { ok: out.sent > 0, sent: out.sent, failed: out.failed });
};
