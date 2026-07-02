/* =========================================================
   JavaScript del portafolio
   Se carga desde el <head> SIN defer a propósito: la parte
   de arriba debe ejecutarse ANTES de pintar para evitar el
   parpadeo (FOUC) del tema y de las animaciones. El resto
   espera a que el DOM esté listo (DOMContentLoaded).
   ========================================================= */

/* Activa las animaciones de entrada SOLO si el navegador las soporta
   y el usuario no pidió reducir el movimiento. Así se evita el
   parpadeo (FOUC) y se respeta la accesibilidad. */
(function () {
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ("IntersectionObserver" in window && !reduce) {
    document.documentElement.classList.add("js");
  }
  /* Aplica el tema guardado cuanto antes para evitar el parpadeo claro/oscuro */
  try {
    var saved = localStorage.getItem("theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
  

document.addEventListener("DOMContentLoaded", function () {
    // ----- Año actual en el footer -----
    document.getElementById("year").textContent = new Date().getFullYear();

    // ----- Tema claro / oscuro -----
    const root = document.documentElement;
    const sunIcons = document.querySelectorAll(".icon-sun");
    const moonIcons = document.querySelectorAll(".icon-moon");

    function applyTheme(theme) {
      const dark = theme === "dark";
      root.classList.toggle("dark", dark);
      sunIcons.forEach((el) => (el.style.display = dark ? "none" : "block"));
      moonIcons.forEach((el) => (el.style.display = dark ? "block" : "none"));
    }

    // Tema guardado, o preferencia del sistema
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));

    function toggleTheme() {
      const next = root.classList.contains("dark") ? "light" : "dark";
      localStorage.setItem("theme", next);
      applyTheme(next);
    }
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
    document.getElementById("theme-toggle-mobile").addEventListener("click", toggleTheme);

    // ----- Menú móvil -----
    const navMobile = document.getElementById("nav-mobile");
    const iconMenu = document.getElementById("icon-menu");
    const iconClose = document.getElementById("icon-close");
    document.getElementById("menu-toggle").addEventListener("click", () => {
      const open = navMobile.classList.toggle("open");
      iconMenu.style.display = open ? "none" : "block";
      iconClose.style.display = open ? "block" : "none";
    });
    // Cerrar el menú al pulsar un enlace
    navMobile.querySelectorAll(".nav-link").forEach((link) =>
      link.addEventListener("click", () => {
        navMobile.classList.remove("open");
        iconMenu.style.display = "block";
        iconClose.style.display = "none";
      })
    );

    // ----- Fondo glass del header al hacer scroll -----
    const header = document.getElementById("site-header");
    window.addEventListener("scroll", () => {
      header.classList.toggle("scrolled", window.scrollY > 10);
      highlightActiveSection();
    });

    // ----- Resaltar el enlace de la sección visible -----
    const sections = ["home", "about", "experience", "projects", "education", "contact"];
    const desktopLinks = document.querySelectorAll(".nav-desktop .nav-link");
    function highlightActiveSection() {
      let current = "home";
      for (const id of sections) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= 150 && rect.bottom >= 150) current = id;
      }
      desktopLinks.forEach((link) =>
        link.classList.toggle("active", link.getAttribute("href") === "#" + current)
      );
    }
    highlightActiveSection();

    // ----- Animaciones de entrada al hacer scroll -----
    if (document.documentElement.classList.contains("js")) {
      const revealEls = document.querySelectorAll(".section-head, .lead, .card");

      // Retraso escalonado para las tarjetas que están una al lado de otra
      revealEls.forEach((el) => {
        const sibCards = [...el.parentElement.children].filter((c) =>
          c.classList.contains("card")
        );
        const idx = sibCards.indexOf(el);
        el.dataset.delay = idx > 0 ? Math.min(idx, 6) * 90 : 0;
      });

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            setTimeout(
              () => el.classList.add("visible"),
              Number(el.dataset.delay) || 0
            );
            io.unobserve(el);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );

      revealEls.forEach((el) => io.observe(el));
    }
  
});
