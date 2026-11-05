/* =========================================================
   AVISOS PUSH (Web Push, sin dependencias)
   Cifrado RFC 8291 (aes128gcm) y firma VAPID RFC 8292 con el módulo
   crypto de Node. Las suscripciones viven en fl_push_subs.

   Variables de entorno:
     VAPID_PUBLIC_KEY   clave pública, base64url
     VAPID_PRIVATE_KEY  clave privada. SOLO aquí, en Vercel.

   pushAll nunca lanza error: un aviso fallido no debe tumbar el
   formulario de contacto ni el monitor.
   ========================================================= */
const crypto = require("crypto");
const { canUseDb, db, TO } = require("./_lib");

const PUSH_TIMEOUT_MS = 6000;
const TTL_SECONDS = 86400;

const canPush = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && canUseDb());

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, len));

/* Firma VAPID: un JWT ES256 válido para el servicio push del dispositivo */
function vapidHeader(endpoint, now) {
  const pub = Buffer.from(process.env.VAPID_PUBLIC_KEY, "base64url");
  const priv = Buffer.from(process.env.VAPID_PRIVATE_KEY, "base64url");
  const key = crypto.createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      d: b64u(Buffer.concat([Buffer.alloc(Math.max(0, 32 - priv.length)), priv])),
      x: b64u(pub.subarray(1, 33)),
      y: b64u(pub.subarray(33, 65)),
    },
  });
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor((now || Date.now()) / 1000) + 12 * 3600,
      sub: "mailto:" + TO,
    })
  );
  const sig = crypto.sign("sha256", Buffer.from(head + "." + claims), { key, dsaEncoding: "ieee-p1363" });
  return "vapid t=" + head + "." + claims + "." + b64u(sig) + ", k=" + process.env.VAPID_PUBLIC_KEY;
}

/* Cifra el aviso para una suscripción: solo ese dispositivo puede leerlo */
function encrypt(text, p256dh, auth) {
  const clientPub = Buffer.from(p256dh, "base64url");
  const ecdh = crypto.createECDH("prime256v1");
  const serverPub = ecdh.generateKeys();
  const shared = ecdh.computeSecret(clientPub);
  const ikm = hkdf(
    Buffer.from(auth, "base64url"),
    shared,
    Buffer.concat([Buffer.from("WebPush: info\0"), clientPub, serverPub]),
    32
  );
  const salt = crypto.randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  // 0x02 marca el último registro, como pide RFC 8188
  const body = Buffer.concat([cipher.update(Buffer.from(text, "utf8")), cipher.update(Buffer.from([2])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([serverPub.length]), serverPub, body]);
}

/* Devuelve el código HTTP del servicio push */
async function sendOne(sub, text) {
  const r = await fetch(sub.endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    headers: {
      Authorization: vapidHeader(sub.endpoint),
      TTL: String(TTL_SECONDS),
      Urgency: "high",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
    },
    body: encrypt(text, sub.p256dh, sub.auth),
  });
  return r.status;
}

/* note = { title, body, url, tag }. Responde { sent, failed }. */
async function pushAll(note) {
  if (!canPush()) return { sent: 0, failed: 0, off: true };
  try {
    const subs = await db("fl_push_subs?select=id,endpoint,p256dh,auth", { prefer: "return=representation" });
    const text = JSON.stringify(note);
    const out = await Promise.all(
      subs.map(async (sub) => {
        try {
          const status = await sendOne(sub, text);
          // 404 y 410: el dispositivo ya no existe o retiró el permiso
          if (status === 404 || status === 410) {
            await db("fl_push_subs?id=eq." + sub.id, { method: "DELETE" });
            return false;
          }
          if (status >= 400) console.error("Aviso push rechazado:", status);
          return status < 400;
        } catch (e) {
          console.error("Aviso push sin enviar:", e.message);
          return false;
        }
      })
    );
    return { sent: out.filter(Boolean).length, failed: out.filter((x) => !x).length };
  } catch (e) {
    console.error("Avisos push:", e.message);
    return { sent: 0, failed: 0, error: true };
  }
}

module.exports = { canPush, pushAll, encrypt, vapidHeader };
