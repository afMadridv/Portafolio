/* =========================================================
   SERVICE WORKER DEL PANEL (alcance /admin)
   Recibe los avisos push con el panel cerrado y abre la sección
   correcta al tocarlos. No guarda nada en caché: el panel siempre
   necesita datos en vivo, y el portafolio queda fuera del alcance.
   ========================================================= */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch (err) {}
  const jobs = [
    // Siempre se muestra: iOS retira el permiso a los push silenciosos
    self.registration.showNotification(d.title || "AM Developer", {
      body: d.body || "",
      icon: "/amd.png",
      badge: "/amd-badge.png",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || "/admin.html" },
    }),
  ];
  if (self.navigator.setAppBadge) jobs.push(self.navigator.setAppBadge().catch(() => {}));
  e.waitUntil(Promise.all(jobs));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const wanted = new URL((e.notification.data && e.notification.data.url) || "/admin.html", self.location.origin);
  const url = wanted.origin === self.location.origin ? wanted.href : new URL("/admin.html", self.location.origin).href;
  e.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const panel = open.find((c) => new URL(c.url).pathname.startsWith("/admin"));
      if (!panel) return self.clients.openWindow(url);
      await panel.focus();
      // Solo cambia el #: el panel lo oye con hashchange y no se recarga
      return panel.navigate(url).catch(() => {});
    })()
  );
});
