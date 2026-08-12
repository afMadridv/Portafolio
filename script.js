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

/* =========================================================
   IDIOMAS
   El HTML viene en español (idioma por defecto). El inglés
   se aplica desde este diccionario al pulsar el botón.
   ========================================================= */
const LANG_KEY = "lang";
const DEFAULT_LANG = "es";
let lang = DEFAULT_LANG;

const I18N = {
  es: {
    "meta.title": "Andres Madrid | Desarrollador de Software",
    "meta.desc":
      "Portafolio de Andres Madrid, desarrollador de software que construye sitios web escalables, seguros y eficientes.",

    "nav.home": "Inicio",
    "nav.about": "Sobre mí",
    "nav.skills": "Habilidades",
    "nav.projects": "Proyectos",
    "nav.education": "Educación",
    "nav.contact": "Contacto",

    "hero.greet": "Hola, soy",
    "hero.role": "Desarrollador de Software y VibeCoder",
    "hero.tagline": "Construyo sitios web escalables, seguros y eficientes",
    "hero.cta": "Hablemos",
    "hero.work": "Ver proyectos",
    "hero.resume": "Descargar CV", // sin usar: el botón está comentado en el HTML

    "about.title": "Sobre mí",
    "about.subtitle":
      "Ingeniero de software con experiencia como desarrollador Full Stack, especializado en JavaScript, TypeScript, React.js, Node.js, Laravel y AWS.",
    "about.lead":
      "Diseño sistemas escalables, seguros y eficientes, con experiencia colaborando en equipos remotos y multidisciplinares. He entregado soluciones en entornos muy regulados, incluidos proyectos de salud con cumplimiento HIPAA y SOC2. Optimizo el rendimiento de los sistemas y acompaño a los equipos para sostener el nivel técnico.",
    "about.f1.title": "Desarrollo Frontend",
    "about.f1.text": "Manejo de JavaScript, HTML y CSS",
    "about.f2.title": "Soluciones en la nube",
    "about.f2.text":
      "Servicios de AWS como SQS, EventBridge, Lambda y Step Functions",
    "about.f3.title": "Liderazgo de equipo",
    "about.f3.text":
      "Coordinación de equipos de desarrollo, diseño, DevOps y QA",
    "about.f4.title": "Colaboración remota",
    "about.f4.text": "Trabajo coordinado con equipos distribuidos en Colombia",

    "skills.title": "Habilidades",
    "skills.subtitle": "Mis conocimientos y herramientas técnicas",
    "skills.frontend": "Frontend",
    "skills.backend": "Backend",
    "skills.database": "Bases de datos",
    "skills.tools": "Herramientas",

    "projects.title": "Proyectos",
    "projects.subtitle":
      "Una selección de mis proyectos personales y profesionales",
    "projects.loading": "Cargando proyectos desde GitHub…",
    "projects.more": "Ver más ({n})",
    "projects.less": "Ver menos",
    "projects.none": "Todavía no hay repos públicos en {url}",
    "projects.error": "No se pudieron cargar los proyectos. Míralos en ",
    "project.nodesc": "Sin descripción todavía.",

    "edu.title": "Educación",
    "edu.subtitle": "Mi formación académica",
    "edu.ongoing": "En curso",
    "edu.done": "Finalizado",
    "edu.e1.title": "Ingeniería de Sistemas",
    "edu.e1.place": "Universidad de la Costa (2025 - Presente)",
    "edu.e1.text":
      "Formación en ingeniería de sistemas centrada en desarrollo de software, algoritmos, estructuras de datos y diseño de sistemas.",
    "edu.e2.title": "Técnico en Desarrollo de Software y Aplicaciones Móviles",
    "edu.e2.place": "Corporación Bolivariana del Norte (2022 - 2024)",
    "edu.e2.text":
      "Programa técnico enfocado en el desarrollo de software y aplicaciones móviles, con práctica en programación, bases de datos y despliegue.",

    "contact.title": "Hablemos",
    "contact.subtitle":
      "¿Tienes un proyecto en mente o quieres hablar de una oportunidad? Escríbeme.",
    "contact.name": "Nombre",
    "contact.name.ph": "Tu nombre",
    "contact.email": "Email",
    "contact.email.ph": "Tu email",
    "contact.subject": "Asunto",
    "contact.subject.ph": "Asunto del mensaje",
    "contact.message": "Mensaje",
    "contact.message.ph": "Tu mensaje",
    "contact.send": "Enviar mensaje",
    "contact.status.opening":
      "Abriendo tu correo con el mensaje listo — solo pulsa enviar. ¿No se abrió? Escríbeme a {mail}",
    "contact.status.toolong":
      "El mensaje es muy largo para abrirse solo. Cópialo y mándalo a {mail}",
    "contact.mail.from": "Enviado desde el portafolio por",
    "contact.mail.reply": "Responder a",
    "contact.location": "Ubicación",
    "contact.phone": "Teléfono",
    "contact.phone.value": "Disponible bajo petición",
    "contact.connect": "Conecta conmigo",
    "contact.connect.sub": "Búscame en estas plataformas",

    "footer.rights": "Todos los derechos reservados.",

    "admin.title": "Portal",
    "admin.gate": "Escribe la clave para elegir qué proyectos se publican.",
    "admin.pass": "Clave",
    "admin.pick":
      'Marca los repos que quieres publicar. Se muestran los 6 primeros y el resto queda tras el botón "Ver más". Sin nada marcado, salen todos.',
    "admin.enter": "Entrar",
    "admin.export": "Descargar projects.json",
    "admin.save": "Guardar",
    "admin.wrongpass": "Clave incorrecta.",
    "admin.nocrypto": "Este navegador no puede comprobar la clave.",
    "admin.notloaded": "Los repos aún no han cargado. Espera un momento.",
    "admin.count": "{n} marcados · se ven {v} y el resto en “Ver más”",
    "admin.countnone": "Sin marcar: salen todos",
    "admin.nodesc": "Sin descripción",

    "aria.lang": "Cambiar idioma",
    "aria.theme": "Cambiar tema",
    "aria.menu": "Abrir menú",
    "aria.scroll": "Ir a la sección Sobre mí",
    "aria.portal": "Portal privado",
    "aria.close": "Cerrar",
  },

  en: {
    "meta.title": "Andres Madrid | Software Developer",
    "meta.desc":
      "Portfolio of Andres Madrid, a software developer building scalable, secure and efficient websites.",

    "nav.home": "Home",
    "nav.about": "About",
    "nav.skills": "Skills",
    "nav.projects": "Projects",
    "nav.education": "Education",
    "nav.contact": "Contact",

    "hero.greet": "Hi, I'm",
    "hero.role": "Software Developer and VibeCoder",
    "hero.tagline": "I build scalable, secure and efficient websites",
    "hero.cta": "Get In Touch",
    "hero.work": "See projects",
    "hero.resume": "Download Resume", // sin usar: el botón está comentado en el HTML

    "about.title": "About Me",
    "about.subtitle":
      "Software engineer with experience as a Full Stack developer, specializing in JavaScript, TypeScript and Node.js.",
    "about.lead":
      "I design scalable, secure and efficient systems, with experience delivering solutions in highly regulated environments: construction, electrical maintenance, and insolvency and conciliation. I optimize system performance and support teams in raising their technical level.",
    "about.f1.title": "Frontend Development",
    "about.f1.text": "Working knowledge of JavaScript, HTML and CSS",
    "about.f2.title": "Cloud Solutions",
    "about.f2.text":
      "AWS services such as SQS, EventBridge, Lambda and Step Functions",
    "about.f3.title": "Team Leadership",
    "about.f3.text":
      "Coordinating development, design, DevOps and QA teams",
    "about.f4.title": "Remote Collaboration",
    "about.f4.text": "Coordinated work with distributed teams across Colombia",

    "skills.title": "Skills",
    "skills.subtitle": "My technical knowledge and tooling",
    "skills.frontend": "Frontend",
    "skills.backend": "Backend",
    "skills.database": "Databases",
    "skills.tools": "Tools",

    "projects.title": "Projects",
    "projects.subtitle": "A selection of my personal and professional projects",
    "projects.loading": "Loading projects from GitHub…",
    "projects.more": "Show more ({n})",
    "projects.less": "Show less",
    "projects.none": "No public repos yet at {url}",
    "projects.error": "Projects could not be loaded. See them at ",
    "project.nodesc": "No description yet.",

    "edu.title": "Education",
    "edu.subtitle": "My academic background",
    "edu.ongoing": "In progress",
    "edu.done": "Completed",
    "edu.e1.title": "Systems Engineering",
    "edu.e1.place": "Universidad de la Costa (2025 - Present)",
    "edu.e1.text":
      "Systems engineering degree focused on software development, algorithms, data structures and system design.",
    "edu.e2.title": "Technician in Software and Mobile App Development",
    "edu.e2.place": "Corporación Bolivariana del Norte (2022 - 2024)",
    "edu.e2.text":
      "Technical program focused on software and mobile app development, with hands-on work in programming, databases and deployment.",

    "contact.title": "Get In Touch",
    "contact.subtitle":
      "Have a project in mind or want to discuss an opportunity? Write to me.",
    "contact.name": "Name",
    "contact.name.ph": "Your name",
    "contact.email": "Email",
    "contact.email.ph": "Your email",
    "contact.subject": "Subject",
    "contact.subject.ph": "Subject of your message",
    "contact.message": "Message",
    "contact.message.ph": "Your message",
    "contact.send": "Send message",
    "contact.status.opening":
      "Opening your mail app with the message ready — just hit send. Didn't open? Write to {mail}",
    "contact.status.toolong":
      "The message is too long to open automatically. Copy it and send it to {mail}",
    "contact.mail.from": "Sent from the portfolio by",
    "contact.mail.reply": "Reply to",
    "contact.location": "Location",
    "contact.phone": "Phone",
    "contact.phone.value": "Available on request",
    "contact.connect": "Connect with me",
    "contact.connect.sub": "Find me on these platforms",

    "footer.rights": "All rights reserved.",

    "admin.title": "Portal",
    "admin.gate": "Enter the passphrase to choose which projects are published.",
    "admin.pass": "Passphrase",
    "admin.pick":
      'Tick the repos you want to publish. The first 6 are shown and the rest sit behind the "Show more" button. With none ticked, all of them show.',
    "admin.enter": "Enter",
    "admin.export": "Download projects.json",
    "admin.save": "Save",
    "admin.wrongpass": "Wrong passphrase.",
    "admin.nocrypto": "This browser cannot verify the passphrase.",
    "admin.notloaded": "Repos have not loaded yet. Give it a moment.",
    "admin.count": "{n} ticked · {v} shown, the rest under “Show more”",
    "admin.countnone": "None ticked: all of them show",
    "admin.nodesc": "No description",

    "aria.lang": "Change language",
    "aria.theme": "Toggle theme",
    "aria.menu": "Open menu",
    "aria.scroll": "Go to the About section",
    "aria.portal": "Private portal",
    "aria.close": "Close",
  },
};

/* El HTML manda en español.
   Antes de traducir nada, copia al diccionario lo que está escrito
   en el HTML. Así editas el texto en portafolio.html y se ve tal
   cual: el diccionario ya no lo pisa. El inglés sigue saliendo de
   I18N.en, que sí hay que actualizar a mano. */
function harvestBaseLang() {
  const base = I18N[DEFAULT_LANG];

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    base[el.dataset.i18n] = el.textContent.trim().replace(/\s+/g, " ");
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    base[el.dataset.i18nPh] = el.placeholder;
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    base[el.dataset.i18nAria] = el.getAttribute("aria-label");
  });

  base["meta.title"] = document.title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) base["meta.desc"] = desc.getAttribute("content");
}

/* Traduce una clave. {n} y {v} se sustituyen con vars. */
function t(key, vars) {
  let str = (I18N[lang] && I18N[lang][key]) || I18N[DEFAULT_LANG][key] || key;
  if (vars) {
    Object.keys(vars).forEach((k) => {
      str = str.split("{" + k + "}").join(vars[k]);
    });
  }
  return str;
}

function applyLang(next) {
  lang = I18N[next] ? next : DEFAULT_LANG;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {}

  document.documentElement.lang = lang;
  document.title = t("meta.title");
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", t("meta.desc"));

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });

  // El botón muestra el idioma al que se cambia, no el actual
  const other = lang === "es" ? "EN" : "ES";
  ["lang-code", "lang-code-mobile"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = other;
  });

  // Las tarjetas de proyecto se generan por JS: hay que repintarlas
  if (shownRepos.length) renderProjects(shownRepos);
}

/* =========================================================
   ANIMACIONES DE ENTRADA
   Función reutilizable: las tarjetas de GitHub se crean
   después de cargar, así que también hay que observarlas.
   ========================================================= */
let revealObserver = null;

function reveal(els) {
  if (!document.documentElement.classList.contains("js")) return;

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          setTimeout(
            () => el.classList.add("visible"),
            Number(el.dataset.delay) || 0
          );
          revealObserver.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
  }

  els.forEach((el) => {
    // Retraso escalonado para las tarjetas que están una al lado de otra
    const sibCards = [...el.parentElement.children].filter((c) =>
      c.classList.contains("card")
    );
    const idx = sibCards.indexOf(el);
    el.dataset.delay = idx > 0 ? Math.min(idx, 6) * 90 : 0;
    revealObserver.observe(el);
  });
}

/* =========================================================
   PROYECTOS DESDE GITHUB
   Usa la API pública (sin token: 60 peticiones/hora por IP).
   Solo lee repos públicos — nunca metas un token aquí, este
   archivo es visible para cualquiera que abra el sitio.
   ========================================================= */
const GH_CACHE_KEY = "gh-repos";
const GH_CACHE_TTL = 60 * 60 * 1000; // 1 hora
const GH_VISIBLE = 6; // tarjetas antes del botón "Ver más"
const SELECTION_KEY = "pf-selection";

let allRepos = []; // todos los repos traídos de la API
let shownRepos = []; // los que corresponden a la selección actual
let hiddenRepos = []; // los que esperan detrás de "Ver más"

const ICON_GITHUB =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>';
const ICON_LIVE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
const ICON_STAR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.5 3.2a.6.6 0 0 1 1 0l2.3 4.6 5.1.7a.6.6 0 0 1 .3 1l-3.7 3.6.9 5a.6.6 0 0 1-.9.7L12 16.5l-4.5 2.4a.6.6 0 0 1-.9-.7l.9-5-3.7-3.6a.6.6 0 0 1 .3-1l5.1-.7z"/></svg>';

/* Enlace "Code" / "Live" de una tarjeta */
function projectLink(href, label, icon) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.className = "btn btn-outline btn-sm";
  a.innerHTML = icon; // SVG fijo, no viene de la API
  a.appendChild(document.createTextNode(label));
  return a;
}

/* Construye una tarjeta. Todo lo que viene de la API se inserta
   con textContent, nunca con innerHTML. */
function buildProjectCard(repo) {
  const card = document.createElement("div");
  card.className = "card project-card card-accent";

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("h3");
  title.textContent = repo.name;
  body.appendChild(title);

  const desc = document.createElement("p");
  desc.className = "text-muted project-desc";
  desc.textContent = repo.description || t("project.nodesc");
  body.appendChild(desc);

  const topics = (repo.topics || []).slice(0, 3);
  const tags = topics.length ? topics : repo.language ? [repo.language] : [];
  if (tags.length) {
    const tagWrap = document.createElement("div");
    tagWrap.className = "project-tags";
    tags.forEach((tag) => {
      const el = document.createElement("span");
      el.className = "tag";
      el.textContent = tag;
      tagWrap.appendChild(el);
    });
    body.appendChild(tagWrap);
  }

  if (repo.stargazers_count > 0) {
    const meta = document.createElement("p");
    meta.className = "project-meta text-muted";
    meta.innerHTML = ICON_STAR;
    meta.appendChild(document.createTextNode(String(repo.stargazers_count)));
    body.appendChild(meta);
  }

  const links = document.createElement("div");
  links.className = "project-links";
  links.appendChild(projectLink(repo.html_url, "Code", ICON_GITHUB));
  if (repo.homepage) {
    links.appendChild(projectLink(repo.homepage, "Live", ICON_LIVE));
  }
  body.appendChild(links);

  card.appendChild(body);
  return card;
}

/* Trae los repos, con caché de 1 h para no gastar el límite */
async function fetchRepos(user) {
  try {
    const cached = JSON.parse(localStorage.getItem(GH_CACHE_KEY) || "null");
    if (cached && cached.user === user && Date.now() - cached.at < GH_CACHE_TTL) {
      return cached.data;
    }
  } catch (e) {}

  const res = await fetch(
    "https://api.github.com/users/" +
      encodeURIComponent(user) +
      "/repos?per_page=100&sort=updated"
  );
  if (!res.ok) throw new Error("GitHub respondió " + res.status);
  const data = await res.json();

  try {
    localStorage.setItem(
      GH_CACHE_KEY,
      JSON.stringify({ user: user, at: Date.now(), data: data })
    );
  } catch (e) {}
  return data;
}

/* Qué repos se publican.
   1. Borrador local (solo en TU navegador, lo escribe el portal)
   2. projects.json publicado (lo que ven las visitas)
   3. null = salen todos */
function localSelection() {
  try {
    const raw = JSON.parse(localStorage.getItem(SELECTION_KEY) || "null");
    if (raw && Array.isArray(raw.selected)) return raw.selected;
  } catch (e) {}
  return null;
}

async function publishedSelection() {
  try {
    const res = await fetch("projects.json", { cache: "no-cache" });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.selected) ? data.selected : null;
  } catch (e) {
    return null; // no existe el archivo todavía: normal
  }
}

/* Aplica la selección conservando su orden */
function applySelection(repos, selected) {
  if (!selected || !selected.length) return repos;
  return selected
    .map((name) => repos.find((r) => r.name === name))
    .filter(Boolean);
}

/* Pinta el grid: 6 tarjetas y el resto tras "Ver más" */
function renderProjects(repos) {
  const grid = document.getElementById("projects-grid");
  const more = document.getElementById("projects-more");
  const btn = document.getElementById("projects-more-btn");
  if (!grid) return;

  shownRepos = repos;
  grid.innerHTML = "";
  const visible = repos.slice(0, GH_VISIBLE);
  hiddenRepos = repos.slice(GH_VISIBLE);

  visible.forEach((repo) => grid.appendChild(buildProjectCard(repo)));
  reveal([...grid.children]);

  if (hiddenRepos.length) {
    more.hidden = false;
    btn.textContent = t("projects.more", { n: hiddenRepos.length });
    btn.dataset.expanded = "false";
  } else {
    more.hidden = true;
  }
}

function toggleMore() {
  const grid = document.getElementById("projects-grid");
  const btn = document.getElementById("projects-more-btn");

  if (btn.dataset.expanded === "true") {
    // Volver a 6
    [...grid.children].slice(GH_VISIBLE).forEach((c) => c.remove());
    btn.textContent = t("projects.more", { n: hiddenRepos.length });
    btn.dataset.expanded = "false";
    document.getElementById("projects").scrollIntoView({ block: "start" });
    return;
  }

  const nuevas = hiddenRepos.map((repo) => {
    const card = buildProjectCard(repo);
    grid.appendChild(card);
    return card;
  });
  reveal(nuevas);
  btn.textContent = t("projects.less");
  btn.dataset.expanded = "true";
}

async function loadGitHubProjects() {
  const grid = document.getElementById("projects-grid");
  const status = document.getElementById("projects-status");
  if (!grid) return;

  const user = grid.dataset.githubUser;
  const profile = "https://github.com/" + user;

  try {
    const repos = await fetchRepos(user);
    allRepos = repos
      .filter((r) => !r.fork && !r.archived)
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

    if (!allRepos.length) {
      status.textContent = t("projects.none", { url: profile });
      return;
    }

    const selected = localSelection() || (await publishedSelection());
    status.hidden = true;
    renderProjects(applySelection(allRepos, selected));
  } catch (e) {
    status.textContent = "";
    status.appendChild(document.createTextNode(t("projects.error")));
    const a = document.createElement("a");
    a.href = profile;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = profile.replace("https://", "");
    a.style.textDecoration = "underline";
    status.appendChild(a);
  }
}

/* =========================================================
   PORTAL PRIVADO
   La clave solo evita que un curioso abra el panel. NO es
   seguridad real: este archivo es público y cualquiera puede
   leerlo. Lo que de verdad protege el sitio es que publicar
   un cambio exige subir projects.json a tu repositorio —
   el panel por sí solo no puede tocar lo que ven las visitas.
   Cambiar la clave: en la consola del navegador ejecuta
   await hashText("tu-clave-nueva") y pega el resultado aquí.
   Clave por defecto: pixel-f1
   ========================================================= */
const ADMIN_HASH =
  "61adbce0bda68f1bcf8ab4534ec8458444a09cd9f19116b6fb94fc0939ff7e4a";

async function hashText(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function initAdminPortal() {
  const overlay = document.getElementById("admin-overlay");
  const gate = document.getElementById("admin-gate");
  const picker = document.getElementById("admin-picker");
  const list = document.getElementById("admin-repos");
  const pass = document.getElementById("admin-pass");
  const error = document.getElementById("admin-error");
  const count = document.getElementById("admin-count");
  const btnSubmit = document.getElementById("admin-submit");
  const btnSave = document.getElementById("admin-save");
  const btnExport = document.getElementById("admin-export");
  if (!overlay) return;

  function open() {
    overlay.hidden = false;
    gate.hidden = false;
    picker.hidden = true;
    btnSubmit.hidden = false;
    btnSave.hidden = true;
    btnExport.hidden = true;
    count.textContent = "";
    error.textContent = "";
    pass.value = "";
    pass.focus();
  }

  function close() {
    overlay.hidden = true;
    document.getElementById("admin-open").focus();
  }

  function chosen() {
    return [...list.querySelectorAll("input:checked")].map((i) => i.value);
  }

  function updateCount() {
    const n = chosen().length;
    count.textContent = n
      ? t("admin.count", { n: n, v: Math.min(n, GH_VISIBLE) })
      : t("admin.countnone");
  }

  function buildList() {
    const selected = localSelection() || [];
    list.innerHTML = "";

    allRepos.forEach((repo) => {
      const row = document.createElement("label");
      row.className = "repo-row";

      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = repo.name;
      box.checked = selected.includes(repo.name);
      row.classList.toggle("checked", box.checked);
      box.addEventListener("change", () => {
        row.classList.toggle("checked", box.checked);
        updateCount();
      });

      const text = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = repo.name;
      text.appendChild(name);

      const desc = document.createElement("span");
      desc.className = "repo-desc";
      desc.textContent = repo.description || t("admin.nodesc");
      text.appendChild(desc);

      row.appendChild(box);
      row.appendChild(text);
      list.appendChild(row);
    });

    updateCount();
  }

  async function submit() {
    error.textContent = "";
    try {
      const ok = (await hashText(pass.value)) === ADMIN_HASH;
      if (!ok) {
        error.textContent = t("admin.wrongpass");
        pass.select();
        return;
      }
    } catch (e) {
      error.textContent = t("admin.nocrypto");
      return;
    }

    if (!allRepos.length) {
      error.textContent = t("admin.notloaded");
      return;
    }

    gate.hidden = true;
    picker.hidden = false;
    btnSubmit.hidden = true;
    btnSave.hidden = false;
    btnExport.hidden = false;
    buildList();
  }

  function save() {
    const selected = chosen();
    try {
      localStorage.setItem(
        SELECTION_KEY,
        JSON.stringify({ selected: selected })
      );
    } catch (e) {}
    renderProjects(applySelection(allRepos, selected));
    close();
    document.getElementById("projects").scrollIntoView({ behavior: "smooth" });
  }

  /* Descarga projects.json para subirlo al repo: es lo único
     que hace que la selección la vean también las visitas. */
  function exportJson() {
    const data = {
      user: document.getElementById("projects-grid").dataset.githubUser,
      selected: chosen(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "projects.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById("admin-open").addEventListener("click", open);
  document.getElementById("admin-close").addEventListener("click", close);
  btnSubmit.addEventListener("click", submit);
  btnSave.addEventListener("click", save);
  btnExport.addEventListener("click", exportJson);

  pass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) close();
  });
}

/* =========================================================
   FORMULARIO DE CONTACTO
   No hay servidor detrás: al enviar se abre el correo del
   visitante con destinatario, asunto y cuerpo ya escritos.
   Solo tiene que pulsar "enviar" en su propio cliente.
   ========================================================= */
const MAILTO_MAX = 1800; // los clientes de correo cortan las URL largas

function initContactForm() {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("contact-status");
  if (!form) return;

  const to = form.dataset.mailto;

  form.addEventListener("submit", (e) => {
    e.preventDefault(); // nada de POST: abrimos el cliente de correo

    const data = new FormData(form);
    const name = (data.get("name") || "").trim();
    const email = (data.get("email") || "").trim();
    const subject = (data.get("subject") || "").trim();
    const message = (data.get("message") || "").trim();

    const body =
      message +
      "\n\n—\n" +
      t("contact.mail.from") +
      ": " +
      name +
      "\n" +
      t("contact.mail.reply") +
      ": " +
      email;

    const href =
      "mailto:" +
      encodeURIComponent(to) +
      "?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body);

    status.hidden = false;
    status.classList.remove("is-warn");

    if (href.length > MAILTO_MAX) {
      // Mensaje demasiado largo: el cliente lo cortaría sin avisar
      status.classList.add("is-warn");
      status.textContent = t("contact.status.toolong", { mail: to });
      return;
    }

    status.textContent = t("contact.status.opening", { mail: to });
    window.location.href = href;
  });
}

/* =========================================================
   STAR WARS
   Cada tanto pasa un caza TIE disparando, o aparece la
   Estrella de la Muerte, se queda quieta y explota.
   ========================================================= */
const TIE_SIZE = 34;
const DS_SIZE = 60;
const TIE_SPEED = 0.4; // px por milisegundo
const DS_STATIC_MS = 6500; // cuánto se queda quieta antes de explotar

function initSpaceFx() {
  const stage = document.getElementById("sw-fx");
  const tie = document.getElementById("tie-fighter");
  const star = document.getElementById("death-star");
  if (!stage || !tie || !star) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* Un rayo verde que sale del TIE hacia donde vuela */
  function laser(x, y, dx, dy) {
    const bolt = document.createElement("div");
    bolt.className = "tie-laser";
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const base = "translate(" + x + "px," + y + "px) rotate(" + angle + "deg)";
    bolt.style.transform = base;
    stage.appendChild(bolt);

    requestAnimationFrame(() => {
      bolt.style.transition = "transform 620ms linear, opacity 620ms linear";
      bolt.style.transform =
        "translate(" + (x + dx * 560) + "px," + (y + dy * 560) + "px) rotate(" + angle + "deg)";
      bolt.style.opacity = "0";
    });
    setTimeout(() => bolt.remove(), 700);
  }

  /* Vuelo del caza. Devuelve cuánto dura. */
  function flyTie() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const off = 80;

    // Solo vuelos horizontales, a una altura al azar
    const y = 90 + Math.random() * Math.max(1, h - 260);
    const routes = [
      // de izquierda a derecha
      { from: { x: -off, y: y }, dir: { x: 1, y: 0 }, rot: 0 },
      // de derecha a izquierda
      { from: { x: w + off, y: y }, dir: { x: -1, y: 0 }, rot: 0 },
    ];

    const r = routes[Math.floor(Math.random() * routes.length)];
    const dist = w + off * 2;
    const ms = dist / TIE_SPEED;
    const to = {
      x: r.from.x + r.dir.x * dist,
      y: r.from.y + r.dir.y * dist,
    };

    tie.style.transition = "none";
    tie.style.transform =
      "translate(" + r.from.x + "px," + r.from.y + "px) rotate(" + r.rot + "deg)";
    void tie.offsetWidth; // reflow para que arranque desde "from"

    tie.classList.add("flying");
    tie.style.transition = "transform " + ms + "ms linear";
    tie.style.transform =
      "translate(" + to.x + "px," + to.y + "px) rotate(" + r.rot + "deg)";

    // Dispara mientras cruza
    const shots = setInterval(() => {
      const box = tie.getBoundingClientRect();
      const cx = box.left + box.width / 2 + r.dir.x * (TIE_SIZE / 2 + 6);
      const cy = box.top + box.height / 2 + r.dir.y * (TIE_SIZE / 2 + 6);
      laser(cx, cy, r.dir.x, r.dir.y);
    }, 480);

    setTimeout(() => {
      clearInterval(shots);
      tie.classList.remove("flying");
    }, ms);

    return ms;
  }

  /* Aparece la Estrella, espera y explota. Devuelve cuánto dura. */
  function deathStarRun() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = 40 + Math.random() * Math.max(1, w - DS_SIZE - 80);
    const y = 90 + Math.random() * Math.max(1, h - DS_SIZE - 220);

    star.style.transform = "translate(" + x + "px," + y + "px)";
    star.classList.add("visible");

    const cx = x + DS_SIZE / 2;
    const cy = y + DS_SIZE / 2;

    setTimeout(() => {
      star.classList.add("exploding");

      const at = "translate(" + cx + "px," + cy + "px)";
      ["ds-flash", "ds-ring", "ds-ring flat"].forEach((cls) => {
        const fx = document.createElement("div");
        fx.className = cls;
        fx.style.transform = at;
        stage.appendChild(fx);
        setTimeout(() => fx.remove(), 1300);
      });

      setTimeout(() => {
        star.classList.remove("visible", "exploding");
      }, 950);
    }, DS_STATIC_MS);

    return DS_STATIC_MS + 1400;
  }

  function next() {
    // 60% caza, 40% Estrella de la Muerte
    const ms = Math.random() < 0.6 ? flyTie() : deathStarRun();
    setTimeout(next, ms + 18000 + Math.random() * 26000);
  }

  setTimeout(next, 6000);
}

/* =========================================================
   ARRANQUE
   ========================================================= */
document.addEventListener("DOMContentLoaded", function () {
  // ----- Idioma guardado -----
  harvestBaseLang(); // el HTML manda: debe ir ANTES de applyLang
  let startLang = DEFAULT_LANG;
  try {
    startLang = localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
  } catch (e) {}
  applyLang(startLang);

  function toggleLang() {
    applyLang(lang === "es" ? "en" : "es");
  }
  document.getElementById("lang-toggle").addEventListener("click", toggleLang);
  document
    .getElementById("lang-toggle-mobile")
    .addEventListener("click", toggleLang);

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
  document
    .getElementById("theme-toggle-mobile")
    .addEventListener("click", toggleTheme);

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

  // ----- Fondo glass del header + barra de progreso al hacer scroll -----
  const header = document.getElementById("site-header");
  const progress = document.getElementById("scroll-progress");

  function onScroll() {
    header.classList.toggle("scrolled", window.scrollY > 10);
    highlightActiveSection();

    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? window.scrollY / max : 0;
    progress.style.transform = "scaleX(" + Math.min(1, pct) + ")";
  }

  // requestAnimationFrame para no recalcular en cada píxel de scroll
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
    },
    { passive: true }
  );

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
  onScroll(); // primera pasada: ya existen sections y el DOM

  // ----- Animaciones de entrada -----
  reveal([...document.querySelectorAll(".section-head, .lead, .card")]);

  // ----- Proyectos, portal y Star Wars -----
  document
    .getElementById("projects-more-btn")
    .addEventListener("click", toggleMore);
  loadGitHubProjects();
  initAdminPortal();
  initContactForm();
  initSpaceFx();
});
