/* =========================================================
   ESTADO DE LA SUSCRIPCIÓN · lo consulta el portal de cada cliente
   GET /api/estado?key=<clave del panel>
   Responde si el portal debe abrir o mostrar el aviso de servicio
   suspendido. Solo da el estado, nada más del cliente. La clave
   está en el panel, en el detalle de la suscripción.

   Abierto a otros dominios (CORS): los portales viven en otras
   direcciones. Caché de 30 s en Vercel: un bloqueo tarda como
   mucho eso en verse.
   ========================================================= */
const { canUseDb, db } = require("./_lib");

const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_NOTE = "La suscripción de Legajo tiene un pago pendiente. Comunícate con AM Developer para reactivar el acceso.";

function send(res, status, data, cache) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return send(res, 405, { ok: false, error: "method" });
  }
  const key = new URL(req.url, "http://x").searchParams.get("key") || "";
  if (!KEY_RE.test(key)) return send(res, 400, { ok: false, error: "key" });
  if (!canUseDb()) return send(res, 503, { ok: false, error: "not_configured" });

  try {
    const rows = await db("fl_licenses?access_key=eq." + key + "&select=status,blocked,block_note,modules,maint_until&limit=1");
    if (!rows || !rows.length) return send(res, 404, { ok: false, error: "not_found" });
    const l = rows[0];
    const active = !l.blocked && l.status !== "cancelada";
    return send(
      res,
      200,
      {
        ok: true,
        active,
        status: l.blocked ? "bloqueado" : l.status === "cancelada" ? "cancelado" : "activo",
        message: active ? "" : l.block_note || DEFAULT_NOTE,
        modules: l.modules || [],
        paid_until: l.maint_until || null,
      },
      "public, max-age=0, s-maxage=30"
    );
  } catch (e) {
    console.error("Estado de suscripción:", e.message);
    return send(res, 500, { ok: false, error: "server" });
  }
};
