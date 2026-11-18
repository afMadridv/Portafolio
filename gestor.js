/* =========================================================
   GESTOR DE PROYECTOS FREELANCE (admin.html)
   Tablero Pendiente / En marcha / Terminado, detalle con
   checklist y pagos, cotizaciones, entregas, clientes,
   licencias (CRM de Legajo) y monitor de sitios.

   Los datos viven en tablas fl_* de Supabase. Son privados:
   las reglas RLS de supabase/schema.sql solo dejan entrar a
   los correos de site_admins. Este archivo es público (el repo
   también): nunca escribas aquí datos de clientes.

   Solo en español: lo usa únicamente el dueño del portafolio.
   ========================================================= */
const G = {
  clients: [],
  projects: [],
  tasks: [],
  payments: [],
  quotes: [],
  sites: [],
  events: [],
  messages: [],
  licenses: [],
  licPayments: [],
  support: [],
  settingsRows: [],
  settings: {},
  licProduct: "", // filtro de producto en Licencias
  siteFolder: null, // carpeta abierta en Sitios
  siteMode: null, // "carpetas" o "todo"
  view: "proyectos",
  search: "",
  drawer: null, // { type: "project" | "client" | "message" | "license" | "site", id }
  started: false,
  editing: null, // cotización abierta en el editor
};

const STATUS = [
  ["pendiente", "Pendiente"],
  ["en_marcha", "En marcha"],
  ["terminado", "Terminado"],
];
const QUOTE_STATUS = [
  ["borrador", "Borrador"],
  ["enviada", "Enviada"],
  ["aceptada", "Aceptada"],
  ["rechazada", "Rechazada"],
];

/* La numeración sigue la de las cotizaciones hechas antes del
   gestor: en 2026 la última a mano fue la 006. */
const QUOTE_FLOOR = { 2026: 6 };

/* ---------- Fechas y dinero ---------- */
const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const parseDay = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const daysUntil = (s) => Math.round((parseDay(s) - parseDay(todayStr())) / 86400000);
const longDate = (s) =>
  s ? parseDay(s).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "—";
const shortDate = (s) =>
  s ? parseDay(s).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "—";
const money = (n) => Math.round(Number(n) || 0).toLocaleString("es-CO") + " COP";
const plainNum = (n) => Math.round(Number(n) || 0).toLocaleString("es-CO");

/* ---------- Base de datos ---------- */
function gestorWarn(text, bad) {
  const box = document.getElementById("gestor-warn");
  box.hidden = !text;
  box.textContent = text || "";
  box.classList.toggle("is-bad", !!bad);
}

async function dbInsert(table, row) {
  const sb = await getSupabase();
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function dbUpdate(table, id, patch) {
  const sb = await getSupabase();
  const { data, error } = await sb.from(table).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function dbDelete(table, id) {
  const sb = await getSupabase();
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) throw error;
}

/* Guarda sin bloquear la pantalla; si falla, lo dice arriba */
function safely(promise) {
  return Promise.resolve(promise)
    .then((r) => {
      gestorWarn("");
      return r;
    })
    .catch((e) => {
      gestorWarn("No se pudo guardar: " + ((e && e.message) || "error desconocido"), true);
      throw e;
    });
}

async function gestorLoad() {
  const sb = await getSupabase();
  const names = {
    clients: "fl_clients",
    projects: "fl_projects",
    tasks: "fl_tasks",
    payments: "fl_payments",
    quotes: "fl_quotes",
    sites: "fl_sites",
    events: "fl_site_events",
    messages: "fl_messages",
    licenses: "fl_licenses",
    licPayments: "fl_license_payments",
    support: "fl_support",
    settingsRows: "fl_settings",
  };
  const keys = Object.keys(names);
  const results = await Promise.all(keys.map((k) => sb.from(names[k]).select("*")));
  let warn = "";
  keys.forEach((k, i) => {
    const r = results[i];
    if (!r.error) {
      G[k] = r.data || [];
      return;
    }
    // Una tabla que falta no tumba las demás
    warn = /PGRST205|42P01/.test(r.error.code || "")
      ? "Faltan tablas del panel. Corre supabase/licencias.sql (o schema.sql) en Supabase → SQL Editor y recarga esta página."
      : "No se pudieron cargar los datos: " + r.error.message;
  });
  G.settings = Object.fromEntries(G.settingsRows.map((r) => [r.key, r.value]));
  gestorWarn(warn, !!warn);
  return !warn;
}

/* ---------- Cuentas ---------- */
const clientOf = (id) => G.clients.find((c) => c.id === id) || null;
const clientName = (id) => {
  const c = clientOf(id);
  return c ? c.name : "Sin cliente";
};
const tasksOf = (id) =>
  G.tasks.filter((t) => t.project_id === id).sort((a, b) => a.position - b.position || String(a.created_at).localeCompare(String(b.created_at)));
const paymentsOf = (id) =>
  G.payments.filter((p) => p.project_id === id).sort((a, b) => String(a.paid_on).localeCompare(String(b.paid_on)));
const paidOf = (id) => paymentsOf(id).reduce((n, p) => n + Number(p.amount), 0);
const dueOf = (p) => Math.max(0, Number(p.amount) - paidOf(p.id));

/* El avance sale del checklist, nunca se escribe a mano */
function progressOf(id) {
  const list = tasksOf(id);
  if (!list.length) return null;
  return Math.round((list.filter((t) => t.done).length / list.length) * 100);
}

function tagOf(p) {
  if (p.status === "terminado") {
    return dueOf(p) > 0 ? ["Por cobrar", "is-warn"] : ["Cobrado", "is-good"];
  }
  if (p.due_date) {
    const d = daysUntil(p.due_date);
    if (d < 0) return ["Vencido", "is-hot"];
    if (d === 0) return ["Entrega hoy", "is-hot"];
    if (d <= 7) return ["Entrega en " + d + " d", "is-warn"];
  }
  return p.label ? [p.label, ""] : null;
}

function paintSide() {
  const open = G.projects.filter((p) => p.status !== "terminado");
  document.getElementById("count-proyectos").textContent = open.length || "";
  document.getElementById("count-presupuestos").textContent =
    G.quotes.filter((q) => q.status === "borrador" || q.status === "enviada").length || "";
  document.getElementById("count-entregas").textContent = upcomingDeliveries().filter((d) => d.days <= 7).length || "";
  document.getElementById("count-clientes").textContent = G.clients.length || "";
  const unread = G.messages.filter((m) => !m.read).length;
  const dueCount = followDue().filter((m) => m.read).length;
  document.getElementById("count-bandeja").textContent = unread + dueCount || "";
  const down = G.sites.filter((x) => x.active && x.status === "down");
  const countSites = document.getElementById("count-sitios");
  countSites.textContent = down.length || "";
  countSites.classList.toggle("is-alert", down.length > 0);
  document.title = (unread + down.length ? "(" + (unread + down.length) + ") " : "") + "Panel · AM Developer";
  // Globo sobre el icono de la app
  try {
    const pending = unread + dueCount + down.length;
    if (pending && navigator.setAppBadge) navigator.setAppBadge(pending).catch(() => {});
    else if (!pending && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch (e) {}
  document.querySelectorAll("#tabbar [data-view]").forEach((tab) => {
    const count = document.getElementById("count-" + tab.dataset.view);
    const b = tab.querySelector("b");
    b.textContent = count.textContent;
    b.classList.toggle("is-alert", count.classList.contains("is-alert"));
  });

  const banner = document.getElementById("down-banner");
  banner.hidden = !down.length;
  banner.textContent = down.length
    ? (down.length === 1 ? down[0].name + " está caída" : down.length + " webs caídas: " + down.map((x) => x.name).join(", ")) + " · ver Sitios"
    : "";

  // Licencias con algo por cobrar hoy
  const licDue = G.licenses.map(licenseDue);
  const licAlert = licDue.filter((n) => n > 0).length;
  const countLic = document.getElementById("count-licencias");
  countLic.textContent = licAlert || "";
  countLic.classList.toggle("is-alert", licAlert > 0);

  // Facturado = lo cobrado este mes, en proyectos y licencias.
  // Por cobrar = saldo de proyectos en marcha o terminados + lo vencido de licencias.
  const month = todayStr().slice(0, 7);
  const billed = G.payments.concat(G.licPayments).filter((p) => String(p.paid_on).startsWith(month)).reduce((n, p) => n + Number(p.amount), 0);
  const due = G.projects.filter((p) => p.status !== "pendiente").reduce((n, p) => n + dueOf(p), 0) + licDue.reduce((n, x) => n + x, 0);
  document.getElementById("side-month").textContent = new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  document.getElementById("money-billed").textContent = money(billed);
  document.getElementById("money-due").textContent = money(due);
}

/* ---------- Ayudantes de formulario ---------- */
function field(label, input) {
  const wrap = el("div", "field");
  const lab = el("label", "", label);
  const id = "f" + Math.random().toString(36).slice(2, 9);
  lab.htmlFor = id;
  input.id = id;
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return wrap;
}

function textInput(value, onChange, type, evt) {
  const i = document.createElement("input");
  i.className = "input";
  i.type = type || "text";
  i.value = value == null ? "" : value;
  i.addEventListener(evt || "change", () => onChange(i.value));
  return i;
}

function textArea(value, onChange, rows, evt) {
  const i = document.createElement("textarea");
  i.className = "input";
  i.rows = rows || 3;
  i.value = value == null ? "" : value;
  i.addEventListener(evt || "change", () => onChange(i.value));
  return i;
}

function selectInput(options, value, onChange) {
  const s = document.createElement("select");
  s.className = "input";
  options.forEach(([v, label]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = label;
    s.appendChild(o);
  });
  s.value = value == null ? "" : value;
  s.addEventListener("change", () => onChange(s.value));
  return s;
}

const clientOptions = () => [["", "Sin cliente"]].concat(G.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.id, c.name]));
const projectOptions = () => [["", "Sin proyecto"]].concat(G.projects.map((p) => [p.id, p.title]));

function button(text, onClick, cls) {
  const b = el("button", "btn" + (cls ? " " + cls : ""), text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/* ---------- Tablero ---------- */
function renderProjects() {
  const root = document.getElementById("view-proyectos");
  root.innerHTML = "";

  const week = G.projects.filter((p) => p.status !== "terminado" && p.due_date && daysUntil(p.due_date) >= 0 && daysUntil(p.due_date) <= 7).length;
  const late = G.projects.filter((p) => p.status !== "terminado" && p.due_date && daysUntil(p.due_date) < 0).length;
  if (week || late) {
    const bits = [];
    if (week) bits.push(week + (week === 1 ? " entrega esta semana" : " entregas esta semana"));
    if (late) bits.push(late + (late === 1 ? " vencida" : " vencidas"));
    root.appendChild(el("p", "alert-week", bits.join(" · ")));
  }

  const head = el("div", "view-head");
  head.appendChild(el("h1", "view-title", "Proyectos"));
  const search = textInput(G.search, (v) => {
    G.search = v;
    fillBoard(board);
  }, "search", "input");
  search.placeholder = "Buscar proyecto o cliente";
  search.setAttribute("aria-label", "Buscar proyecto o cliente");
  head.appendChild(search);
  head.appendChild(button("+ Proyecto", newProject, "btn-primary"));
  root.appendChild(head);

  const board = el("div", "board");
  root.appendChild(board);
  fillBoard(board);
}

function fillBoard(board) {
  board.innerHTML = "";
  const q = G.search.trim().toLowerCase();
  STATUS.forEach(([status, label]) => {
    const list = G.projects
      .filter((p) => p.status === status)
      .filter((p) => !q || (p.title + " " + clientName(p.client_id)).toLowerCase().includes(q))
      .sort((a, b) => a.position - b.position || String(b.created_at).localeCompare(String(a.created_at)));

    const col = el("div", "col");
    col.dataset.status = status;
    const h = el("p", "col-head");
    h.appendChild(el("span", "", label));
    h.appendChild(el("span", "", String(list.length)));
    col.appendChild(h);
    list.forEach((p) => col.appendChild(projectCard(p)));

    // Arrastrar una tarjeta cambia su estado (también se puede en el detalle)
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("is-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("is-over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("is-over");
      const id = e.dataTransfer.getData("text/plain");
      if (id) setProject(id, { status });
    });
    board.appendChild(col);
  });
}

function projectCard(p) {
  const card = el("button", "card");
  card.type = "button";
  card.draggable = true;
  card.classList.toggle("is-open", !!(G.drawer && G.drawer.type === "project" && G.drawer.id === p.id));
  card.appendChild(el("span", "card-title", p.title));
  card.appendChild(el("span", "card-client", clientName(p.client_id)));
  const row = el("span", "card-row");
  row.appendChild(el("span", "card-money", money(p.amount)));
  const tag = tagOf(p);
  if (tag) row.appendChild(el("span", "tag " + tag[1], tag[0]));
  card.appendChild(row);
  const pct = progressOf(p.id);
  if (pct !== null) {
    const bar = el("span", "bar");
    bar.style.display = "block";
    const fill = document.createElement("i");
    fill.style.width = pct + "%";
    bar.appendChild(fill);
    card.appendChild(bar);
  }
  card.addEventListener("click", () => openDrawer("project", p.id));
  card.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", p.id));
  return card;
}

async function newProject() {
  const row = await safely(dbInsert("fl_projects", { title: "Proyecto nuevo", status: "pendiente" }));
  G.projects.push(row);
  renderAllViews();
  openDrawer("project", row.id);
}

async function setProject(id, patch) {
  const p = G.projects.find((x) => x.id === id);
  if (!p) return;
  Object.assign(p, patch);
  renderAllViews();
  const saved = await safely(dbUpdate("fl_projects", id, patch));
  Object.assign(p, saved);
}

/* ---------- Detalle ---------- */
function openDrawer(type, id) {
  G.drawer = { type, id };
  renderDrawer();
  if (G.view === "proyectos") renderProjects();
}

function closeDrawer() {
  G.drawer = null;
  document.getElementById("drawer").hidden = true;
  if (G.view === "proyectos") renderProjects();
}

function renderDrawer() {
  const box = document.getElementById("drawer");
  box.innerHTML = "";
  if (!G.drawer) return (box.hidden = true);
  box.hidden = false;
  if (G.drawer.type === "project") projectDrawer(box);
  else if (G.drawer.type === "message") messageDrawer(box);
  else if (G.drawer.type === "license") licenseDrawer(box);
  else if (G.drawer.type === "site") siteDrawer(box);
  else clientDrawer(box);
}

function drawerTop(box, title) {
  const top = el("div", "drawer-top");
  top.appendChild(el("h2", "", title));
  top.appendChild(button("Cerrar", closeDrawer));
  box.appendChild(top);
}

function projectDrawer(box) {
  const p = G.projects.find((x) => x.id === G.drawer.id);
  if (!p) return closeDrawer();
  drawerTop(box, clientName(p.client_id));

  box.appendChild(field("Proyecto", textInput(p.title, (v) => setProject(p.id, { title: v.trim() || "Sin título" }))));
  box.appendChild(field("Cliente", selectInput(clientOptions(), p.client_id, (v) => { setProject(p.id, { client_id: v || null }); renderDrawer(); })));
  const two = el("div", "two");
  two.appendChild(field("Estado", selectInput(STATUS, p.status, (v) => setProject(p.id, { status: v }))));
  two.appendChild(field("Etiqueta", textInput(p.label, (v) => setProject(p.id, { label: v.trim() || null }))));
  two.appendChild(field("Valor (COP)", textInput(p.amount, (v) => { setProject(p.id, { amount: Math.max(0, Number(v) || 0) }); renderDrawer(); }, "number")));
  two.appendChild(field("Entrega", textInput(p.due_date, (v) => setProject(p.id, { due_date: v || null }), "date")));
  box.appendChild(two);
  box.appendChild(field("Notas", textArea(p.notes, (v) => setProject(p.id, { notes: v || null }), 2)));

  // Checklist: el porcentaje sale solo
  box.appendChild(el("h3", "", "Entregables"));
  const pct = progressOf(p.id);
  const line = el("div", "pct");
  line.appendChild(el("span", "", pct === null ? "Sin entregables todavía" : "Avance"));
  if (pct !== null) line.appendChild(el("span", "", pct + " %"));
  box.appendChild(line);
  if (pct !== null) {
    const bar = el("div", "bar");
    const fill = document.createElement("i");
    fill.style.width = pct + "%";
    bar.appendChild(fill);
    box.appendChild(bar);
  }
  const list = el("ul", "check-list");
  tasksOf(p.id).forEach((t) => {
    const li = el("li", t.done ? "is-done" : "");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = t.done;
    cb.setAttribute("aria-label", t.title);
    cb.addEventListener("change", async () => {
      t.done = cb.checked;
      renderDrawer();
      renderAllViews();
      await safely(dbUpdate("fl_tasks", t.id, { done: t.done }));
    });
    li.appendChild(cb);
    li.appendChild(el("span", "tx", t.title));
    const when = t.due_date ? tagForDay(t.due_date, t.done) : null;
    if (when) li.appendChild(el("span", "tag " + when[1], when[0]));
    const x = el("button", "x", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "Quitar " + t.title);
    x.addEventListener("click", async () => {
      G.tasks = G.tasks.filter((o) => o.id !== t.id);
      renderDrawer();
      renderAllViews();
      await safely(dbDelete("fl_tasks", t.id));
    });
    li.appendChild(x);
    list.appendChild(li);
  });
  if (list.children.length) box.appendChild(list);

  const add = el("form", "inline-add");
  const name = textInput("", () => {});
  name.placeholder = "Nuevo entregable";
  name.setAttribute("aria-label", "Nuevo entregable");
  const day = textInput("", () => {}, "date");
  day.setAttribute("aria-label", "Fecha del entregable");
  day.style.flex = "0 0 120px";
  add.appendChild(name);
  add.appendChild(day);
  const addBtn = el("button", "btn", "Añadir");
  addBtn.type = "submit";
  add.appendChild(addBtn);
  add.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = name.value.trim();
    if (!title) return name.focus();
    const row = await safely(
      dbInsert("fl_tasks", { project_id: p.id, title, due_date: day.value || null, position: tasksOf(p.id).length })
    );
    G.tasks.push(row);
    renderDrawer();
    renderAllViews();
  });
  box.appendChild(add);

  // Pagos: de aquí salen Facturado y Por cobrar
  box.appendChild(el("h3", "", "Pagos"));
  const sum = el("p", "pay-sum");
  sum.textContent = "Cobrado " + money(paidOf(p.id)) + " de " + money(p.amount) + " · saldo " + money(dueOf(p));
  box.appendChild(sum);
  const pays = el("ul", "check-list");
  paymentsOf(p.id).forEach((pay) => {
    const li = el("li");
    li.appendChild(el("span", "tx", shortDate(pay.paid_on) + " · " + money(pay.amount) + (pay.note ? " · " + pay.note : "")));
    const x = el("button", "x", "✕");
    x.type = "button";
    x.setAttribute("aria-label", "Quitar pago");
    x.addEventListener("click", async () => {
      if (!window.confirm("¿Borrar este pago?")) return;
      G.payments = G.payments.filter((o) => o.id !== pay.id);
      renderDrawer();
      renderAllViews();
      await safely(dbDelete("fl_payments", pay.id));
    });
    li.appendChild(x);
    pays.appendChild(li);
  });
  if (pays.children.length) box.appendChild(pays);
  const payForm = el("form", "inline-add");
  const amount = textInput("", () => {}, "number");
  amount.placeholder = "Valor";
  amount.min = "1";
  amount.setAttribute("aria-label", "Valor del pago");
  const paidOn = textInput(todayStr(), () => {}, "date");
  paidOn.setAttribute("aria-label", "Fecha del pago");
  paidOn.style.flex = "0 0 120px";
  payForm.appendChild(amount);
  payForm.appendChild(paidOn);
  const payBtn = el("button", "btn", "Registrar");
  payBtn.type = "submit";
  payForm.appendChild(payBtn);
  payForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = Number(amount.value);
    if (!(val > 0)) return amount.focus();
    const row = await safely(dbInsert("fl_payments", { project_id: p.id, amount: val, paid_on: paidOn.value || todayStr() }));
    G.payments.push(row);
    renderDrawer();
    renderAllViews();
  });
  box.appendChild(payForm);

  // Cotizaciones del proyecto
  box.appendChild(el("h3", "", "Cotizaciones"));
  const linked = G.quotes.filter((q) => q.project_id === p.id);
  const qList = el("div", "inline-add");
  qList.style.flexWrap = "wrap";
  linked.forEach((q) => qList.appendChild(button(q.number, () => editQuote(q))));
  qList.appendChild(button("+ Cotizar este proyecto", () => newQuote("horas", { client_id: p.client_id, project_id: p.id, subject: p.title })));
  box.appendChild(qList);

  const danger = el("div", "drawer-danger");
  danger.appendChild(button("Borrar proyecto", async () => {
    if (!window.confirm('¿Borrar "' + p.title + '" con sus entregables y pagos? No se puede deshacer.')) return;
    G.projects = G.projects.filter((o) => o.id !== p.id);
    G.tasks = G.tasks.filter((o) => o.project_id !== p.id);
    G.payments = G.payments.filter((o) => o.project_id !== p.id);
    closeDrawer();
    renderAllViews();
    await safely(dbDelete("fl_projects", p.id));
  }));
  box.appendChild(danger);
}

function tagForDay(day, done) {
  if (done) return null;
  const d = daysUntil(day);
  if (d < 0) return ["Vencido", "is-hot"];
  if (d === 0) return ["Hoy", "is-hot"];
  if (d === 1) return ["Mañana", "is-warn"];
  if (d <= 7) return ["En " + d + " d", "is-warn"];
  return [shortDate(day), ""];
}

/* ---------- Entregas ---------- */
function upcomingDeliveries() {
  const rows = [];
  G.projects.filter((p) => p.status !== "terminado").forEach((p) => {
    if (p.due_date) rows.push({ kind: "Proyecto", title: p.title, project: p, day: p.due_date, days: daysUntil(p.due_date) });
    tasksOf(p.id).filter((t) => !t.done && t.due_date).forEach((t) => {
      rows.push({ kind: "Entregable", title: t.title, project: p, day: t.due_date, days: daysUntil(t.due_date) });
    });
  });
  return rows.sort((a, b) => a.days - b.days);
}

function renderDeliveries() {
  const root = document.getElementById("view-entregas");
  root.innerHTML = "";
  root.appendChild(el("h1", "view-title", "Entregas"));
  const rows = upcomingDeliveries();
  const wrap = el("div", "table-wrap");
  if (!rows.length) {
    wrap.appendChild(el("p", "empty", "Sin fechas de entrega pendientes. Pon una fecha en un proyecto o en un entregable."));
    return root.appendChild(wrap);
  }
  const table = el("table", "tbl");
  table.appendChild(tableHead(["Fecha", "Qué", "Tipo", "Proyecto", "Cliente", ""]));
  const tb = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = el("tr", "is-link");
    tr.appendChild(el("td", "", shortDate(r.day)));
    tr.appendChild(el("td", "", r.title));
    tr.appendChild(el("td", "", r.kind));
    tr.appendChild(el("td", "", r.project.title));
    tr.appendChild(el("td", "", clientName(r.project.client_id)));
    const td = el("td", "num");
    const tag = tagForDay(r.day, false);
    td.appendChild(el("span", "tag " + tag[1], tag[0]));
    tr.appendChild(td);
    tr.addEventListener("click", () => {
      showView("proyectos");
      openDrawer("project", r.project.id);
    });
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  wrap.appendChild(table);
  root.appendChild(wrap);
}

function tableHead(cols) {
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  cols.forEach((c) => tr.appendChild(el("th", "", c)));
  thead.appendChild(tr);
  return thead;
}

/* ---------- Clientes ---------- */
function renderClients() {
  const root = document.getElementById("view-clientes");
  root.innerHTML = "";
  const head = el("div", "view-head");
  head.appendChild(el("h1", "view-title", "Clientes"));
  head.appendChild(button("+ Cliente", async () => {
    const row = await safely(dbInsert("fl_clients", { name: "Cliente nuevo" }));
    G.clients.push(row);
    renderAllViews();
    openDrawer("client", row.id);
  }, "btn-primary"));
  root.appendChild(head);

  const wrap = el("div", "table-wrap");
  if (!G.clients.length) {
    wrap.appendChild(el("p", "empty", "Todavía no hay clientes."));
    return root.appendChild(wrap);
  }
  const table = el("table", "tbl");
  table.appendChild(tableHead(["Cliente", "Tipo", "Contacto", "Correo", "Teléfono", "Proyectos", "Saldo"]));
  const tb = document.createElement("tbody");
  G.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => {
    const own = G.projects.filter((p) => p.client_id === c.id);
    const tr = el("tr", "is-link");
    tr.appendChild(el("td", "", c.name));
    tr.appendChild(el("td", "", c.kind || "—"));
    tr.appendChild(el("td", "", c.contact || "—"));
    tr.appendChild(el("td", "", c.email || "—"));
    tr.appendChild(el("td", "", c.phone || "—"));
    tr.appendChild(el("td", "num", String(own.length)));
    const licSaldo = G.licenses.filter((l) => l.client_id === c.id).reduce((n, l) => n + licenseDue(l), 0);
    tr.appendChild(el("td", "num", money(own.filter((p) => p.status !== "pendiente").reduce((n, p) => n + dueOf(p), 0) + licSaldo)));
    tr.addEventListener("click", () => openDrawer("client", c.id));
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  wrap.appendChild(table);
  root.appendChild(wrap);
}

function clientDrawer(box) {
  const c = G.clients.find((x) => x.id === G.drawer.id);
  if (!c) return closeDrawer();
  drawerTop(box, "Cliente");
  const save = (patch) => {
    Object.assign(c, patch);
    renderAllViews();
    safely(dbUpdate("fl_clients", c.id, patch));
  };
  box.appendChild(field("Nombre o empresa", textInput(c.name, (v) => save({ name: v.trim() || "Sin nombre" }))));
  const kind = textInput(c.kind, (v) => save({ kind: v.trim() || null }));
  const kindField = field("Tipo", kind);
  kindField.appendChild(attachList(kind, CLIENT_KINDS));
  box.appendChild(kindField);
  box.appendChild(field("Persona de contacto", textInput(c.contact, (v) => save({ contact: v || null }))));
  const two = el("div", "two");
  two.appendChild(field("Correo", textInput(c.email, (v) => save({ email: v || null }), "email")));
  two.appendChild(field("Teléfono", textInput(c.phone, (v) => save({ phone: v || null }), "tel")));
  two.appendChild(field("NIT o documento", textInput(c.tax_id, (v) => save({ tax_id: v || null }))));
  two.appendChild(field("Ciudad", textInput(c.city, (v) => save({ city: v || null }))));
  box.appendChild(two);
  box.appendChild(field("Notas", textArea(c.notes, (v) => save({ notes: v || null }), 3)));

  box.appendChild(el("h3", "", "Suscripciones"));
  const lics = G.licenses.filter((l) => l.client_id === c.id);
  if (lics.length) {
    const ul = el("ul", "check-list");
    lics.forEach((l) => {
      const li = document.createElement("li");
      const m = maintState(l);
      li.appendChild(el("span", "tx", (l.product || "Legajo") + " · " + planText(l)));
      li.appendChild(el("span", "tag " + m.cls, m.label));
      li.appendChild(button("Abrir", () => {
        goToView("licencias");
        openDrawer("license", l.id);
      }));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  box.appendChild(button("+ Suscripción para este cliente", () => newLicense({ client_id: c.id })));

  const danger = el("div", "drawer-danger");
  danger.appendChild(button("Borrar cliente", async () => {
    if (!window.confirm('¿Borrar "' + c.name + '"? Sus proyectos y cotizaciones se quedan, sin cliente.')) return;
    G.clients = G.clients.filter((o) => o.id !== c.id);
    G.projects.forEach((p) => { if (p.client_id === c.id) p.client_id = null; });
    G.quotes.forEach((q) => { if (q.client_id === c.id) q.client_id = null; });
    G.licenses.forEach((l) => { if (l.client_id === c.id) l.client_id = null; });
    closeDrawer();
    renderAllViews();
    await safely(dbDelete("fl_clients", c.id));
  }));
  box.appendChild(danger);
}

/* =========================================================
   COTIZACIONES
   Dos formatos sobre la misma hoja: por horas (horas × tarifa)
   y a precio fijo (conceptos con su valor). El contenido se
   guarda como JSON en fl_quotes.content.
   ========================================================= */
const QUOTE_TEXT = {
  profile:
    "Desarrollador de software full-stack enfocado en la arquitectura y construcción de sistemas escalables, seguros y de alto rendimiento. Tengo experiencia práctica entregando soluciones a la medida para entornos operativos y normativos complejos, donde optimizo procesos administrativos, legales y de gestión documental.\nCombino ingeniería de software, modelado de bases de datos y desarrollo integral para convertir flujos de trabajo tradicionales en herramientas digitales eficientes y seguras.",
  tech:
    "Web: JavaScript, TypeScript, HTML5, CSS3, Tailwind CSS · app instalable (PWA), Web Push, WebRTC\nDatos y servidor: Supabase (PostgreSQL, PL/pgSQL, RLS, Auth, Storage, Realtime, Edge Functions en Deno) · MySQL\nApps: Kotlin y Jetpack Compose (Android) · Java 17, Swing y Maven (escritorio)\nHerramientas: Git, GitHub, Node.js, Python, Figma, Vercel",
  education:
    "Ingeniería de Sistemas, Universidad de la Costa (en curso) · Técnico en Desarrollo de Software y Aplicaciones Móviles, Corporación Bolivariana del Norte (2022–2024)",
  includes:
    "Licencia de uso no exclusiva y perpetua del software, para la operación interna del cliente.\nCódigo fuente y documentación técnica.\nPublicación del software funcionando, con sus usuarios creados.\nAcompañamiento en la entrega al equipo que lo reciba.\nCorrección de fallas del código entregado.\nServicios en la nube: si se necesita un plan de pago, lo paga el cliente.",
  legal:
    "En Colombia el software se protege por derecho de autor, no por patente (Decisión Andina 486, artículo 15).\nAndrés Felipe Madrid Villar conserva la titularidad de los derechos patrimoniales y morales. El cliente recibe una licencia de uso, que debe constar por escrito (Ley 23 de 1982).\nLos derechos morales de autor son irrenunciables e intransferibles (Ley 23 de 1982, artículo 30).\nEl autor puede mostrar el trabajo en su portafolio, sin datos del cliente ni de sus usuarios.",
};

function blankContent(kind) {
  return {
    validDays: 30,
    intro: "",
    groups: [{ title: "", items: "" }],
    evidenceRepo: "",
    evidence: [],
    hoursLabel: kind === "horas" ? "Horas estimadas" : "",
    hoursNote: "",
    hours: kind === "horas" ? [{ area: "", hours: "" }] : [],
    rateNote: "Cotizo como desarrollador junior, por debajo del mercado.",
    rateLow: kind === "horas" ? 35000 : "",
    rateHigh: kind === "horas" ? 37000 : "",
    items: kind === "fijo" ? [{ concept: "", value: "" }] : [],
    valueNote: "Es un pago único por el software y su licencia de uso, sin mensualidades.",
    includes: QUOTE_TEXT.includes,
    pay5050: true,
    pay3: true,
    legal: QUOTE_TEXT.legal,
    profile: QUOTE_TEXT.profile,
    tech: QUOTE_TEXT.tech,
    education: QUOTE_TEXT.education,
  };
}

function nextQuoteNumber() {
  const year = new Date().getFullYear();
  const prefix = "AM-" + year + "-";
  const top = G.quotes.reduce((max, q) => {
    if (!String(q.number).startsWith(prefix)) return max;
    return Math.max(max, parseInt(String(q.number).slice(prefix.length), 10) || 0);
  }, QUOTE_FLOOR[year] || 0);
  return prefix + String(top + 1).padStart(3, "0");
}

const hoursTotal = (c) => (c.hours || []).reduce((n, r) => n + (Number(r.hours) || 0), 0);

function quoteTotal(q) {
  const c = q.content || {};
  if (q.kind === "horas") return hoursTotal(c) * (Number(c.rateHigh) || 0);
  return (c.items || []).reduce((n, r) => n + (Number(r.value) || 0), 0);
}

/* Número en letras, en pesos: 7.770.000 -> SIETE MILLONES SETECIENTOS SETENTA MIL PESOS */
function numberToWords(value) {
  const n = Math.round(Number(value) || 0);
  if (n === 0) return "CERO PESOS";
  const U = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
  const D = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const C = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
  const under1000 = (x) => {
    if (x === 0) return "";
    if (x === 100) return "CIEN";
    const out = [];
    const c = Math.floor(x / 100);
    const r = x % 100;
    if (c) out.push(C[c]);
    if (r) {
      if (r < 30) out.push(U[r]);
      else {
        const d = Math.floor(r / 10);
        const u = r % 10;
        out.push(u ? D[d] + " Y " + U[u] : D[d]);
      }
    }
    return out.join(" ");
  };
  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (millions) parts.push(millions === 1 ? "UN MILLÓN" : under1000(millions) + " MILLONES");
  if (thousands) parts.push(thousands === 1 ? "MIL" : under1000(thousands) + " MIL");
  if (rest) parts.push(under1000(rest));
  // "un millón de pesos" solo cuando no sigue nada más
  return parts.join(" ") + (millions && !thousands && !rest ? " DE PESOS" : " PESOS");
}

/* ---------- La hoja ---------- */
function buildQuoteSheet(q, root) {
  root.innerHTML = "";
  const c = q.content || {};
  const client = clientOf(q.client_id);
  const clientLabel = client ? client.name : "Cliente por definir";
  const total = quoteTotal(q);
  const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

  const sheet = el("div", "qs");
  const table = el("table", "qs-table");
  const thead = document.createElement("thead");
  const headTd = document.createElement("td");
  const run = el("div", "qs-run");
  run.appendChild(el("span", "", "Cotización " + q.number + " · Andrés Madrid"));
  run.appendChild(el("span", "", (q.subject ? String(q.subject).slice(0, 44) + " · " : "") + clientLabel));
  headTd.appendChild(run);
  const headTr = document.createElement("tr");
  headTr.appendChild(headTd);
  thead.appendChild(headTr);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  const bodyTr = document.createElement("tr");
  const b = document.createElement("td");
  bodyTr.appendChild(b);
  tbody.appendChild(bodyTr);
  table.appendChild(tbody);
  sheet.appendChild(table);

  b.appendChild(el("p", "qs-kicker", "Cotización de servicios de software"));
  const brand = el("div", "qs-brand");
  const logo = document.createElement("img");
  logo.className = "qs-logo";
  logo.src = "amd.svg";
  logo.alt = "AMD";
  brand.appendChild(logo);
  const who = el("div");
  who.appendChild(el("h1", "qs-name", "Andrés Madrid"));
  who.appendChild(el("p", "qs-role", "Desarrollador de software · Colombia"));
  brand.appendChild(who);
  b.appendChild(brand);
  const links = el("div", "qs-links");
  ["andresmadrid.vercel.app", EMAIL, "github.com/" + GITHUB_USER, "LinkedIn"].forEach((l) => links.appendChild(el("span", "", l)));
  b.appendChild(links);

  const facts = el("div", "qs-facts");
  const fact = (k, v, cls) => {
    facts.appendChild(el("div", "k", k));
    facts.appendChild(el("div", cls || "", v));
  };
  fact("Cotización", q.number, "mono");
  fact("Fecha", longDate(q.issue_date));
  if (Number(c.validDays) > 0) fact("Validez", c.validDays + " días");
  fact("Dirigida a", clientLabel, "strong");
  if (q.subject) fact("Objeto", q.subject);
  b.appendChild(facts);

  const about = el("div", "qs-about");
  const aboutRow = (k, fill) => {
    about.appendChild(el("div", "k", k));
    const v = el("div");
    fill(v);
    about.appendChild(v);
  };
  if (c.profile) aboutRow("Perfil", (v) => lines(c.profile).forEach((p) => v.appendChild(el("p", "", p))));
  if (c.tech) {
    aboutRow("Tecnologías", (v) =>
      lines(c.tech).forEach((p) => {
        const para = el("p");
        const i = p.indexOf(":");
        if (i > 0) {
          para.appendChild(el("strong", "", p.slice(0, i + 1)));
          para.appendChild(document.createTextNode(p.slice(i + 1)));
        } else para.textContent = p;
        v.appendChild(para);
      })
    );
  }
  if (c.education) aboutRow("Formación", (v) => v.appendChild(el("p", "", c.education)));
  b.appendChild(about);

  let n = 0;
  const section = (title) => {
    n++;
    b.appendChild(el("h2", "", n + ". " + title));
  };
  const bullets = (text) => {
    const ul = document.createElement("ul");
    lines(text).forEach((l) => ul.appendChild(el("li", "", l)));
    b.appendChild(ul);
  };
  const grid = (cols, rows, opts) => {
    const t = el("table", "qs-grid");
    const hd = document.createElement("thead");
    const hr = document.createElement("tr");
    cols.forEach(([label, right]) => hr.appendChild(el("th", right ? "r" : "", label)));
    hd.appendChild(hr);
    t.appendChild(hd);
    const tb = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = el("tr", r.cls || "");
      r.cells.forEach((cell, i) => tr.appendChild(el("td", cols[i][1] ? "r" : "", cell)));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    b.appendChild(t);
    return opts;
  };

  if (c.intro) {
    section("Qué se cotiza");
    lines(c.intro).forEach((p) => b.appendChild(el("p", "", p)));
  }

  const groups = (c.groups || []).filter((g) => lines(g.items).length);
  if (groups.length) {
    section("Qué se entrega");
    groups.forEach((g) => {
      if (g.title) b.appendChild(el("h3", "", g.title));
      bullets(g.items);
    });
  }

  const evidence = (c.evidence || []).filter((r) => r.stage);
  if (evidence.length) {
    section("Evidencia del trabajo");
    if (c.evidenceRepo) b.appendChild(el("p", "", "El historial de desarrollo queda registrado en " + c.evidenceRepo + "."));
    grid(
      [["Etapa"], ["Período"], ["Entregas", 1], ["Líneas", 1]],
      evidence.map((r) => ({ cells: [r.stage, r.period || "", r.deliveries || "", r.lines || ""] }))
    );
  }

  let valueLabel = "";
  if (q.kind === "horas") {
    const hrs = (c.hours || []).filter((r) => r.area);
    const sumH = hoursTotal(c);
    if (hrs.length) {
      section(c.hoursLabel || "Horas");
      b.appendChild(el("p", "", "Total: " + sumH + " horas" + (c.hoursNote ? " " + c.hoursNote : "") + "."));
      const rows = hrs.map((r) => ({ cells: [r.area, String(r.hours || 0)] }));
      rows.push({ cells: ["Total", sumH + " h"], cls: "total" });
      grid([["Área de trabajo"], ["Horas", 1]], rows);
    }
    section("Tarifa y cálculo");
    if (c.rateNote) b.appendChild(el("p", "", c.rateNote));
    const rateRows = [];
    if (Number(c.rateLow) > 0 && Number(c.rateLow) !== Number(c.rateHigh)) {
      rateRows.push({ cells: [plainNum(c.rateLow) + " COP", String(sumH), plainNum(c.rateLow * sumH) + " COP"] });
    }
    rateRows.push({ cells: [plainNum(c.rateHigh) + " COP (propuesta)", String(sumH), plainNum(total) + " COP"], cls: "is-pick" });
    grid([["Tarifa por hora"], ["Horas", 1], ["Valor", 1]], rateRows);
    valueLabel = " · Tarifa de " + plainNum(c.rateHigh) + " COP por hora";
  } else {
    const items = (c.items || []).filter((r) => r.concept);
    if (items.length) {
      section("Detalle y valor");
      const rows = items.map((r) => ({ cells: [r.concept, plainNum(r.value) + " COP"] }));
      rows.push({ cells: ["Total", plainNum(total) + " COP"], cls: "total" });
      grid([["Concepto"], ["Valor", 1]], rows);
    }
  }

  n++;
  const val = el("div", "qs-value");
  val.appendChild(el("p", "l", n + ". Valor propuesto" + valueLabel));
  val.appendChild(el("p", "n", plainNum(total) + " COP"));
  val.appendChild(el("p", "w", numberToWords(total)));
  if (c.valueNote) val.appendChild(el("p", "t", c.valueNote));
  b.appendChild(val);

  section("Condiciones");
  if (lines(c.includes).length) {
    b.appendChild(el("h3", "", "Qué incluye"));
    bullets(c.includes);
  }
  const payRows = [];
  if (c.pay5050) payRows.push({ cells: ["50 % a la firma y 50 % a la entrega", "2 × " + plainNum(total / 2)] });
  if (c.pay3) payRows.push({ cells: ["Tres cuotas mensuales", "3 × " + plainNum(total / 3)] });
  if (payRows.length) {
    b.appendChild(el("h3", "", "Forma de pago"));
    grid([["Modalidad"], ["Valor", 1]], payRows);
  }
  if (lines(c.legal).length) {
    b.appendChild(el("h3", "", "Notas legales"));
    bullets(c.legal);
  }

  const sign = el("div", "qs-sign");
  const me = el("div");
  me.appendChild(el("strong", "", "Andrés Felipe Madrid Villar"));
  me.appendChild(el("div", "", "Desarrollador de software · Colombia"));
  me.appendChild(el("div", "", "andresmadrid.vercel.app"));
  const them = el("div");
  them.appendChild(el("strong", "", "Aceptación del cliente"));
  them.appendChild(el("div", "", clientLabel));
  them.appendChild(el("div", "", "Nombre, firma y fecha"));
  sign.appendChild(me);
  sign.appendChild(them);
  b.appendChild(sign);

  root.appendChild(sheet);
}

/* "Guardar como PDF": imprime solo la hoja. El título propone el nombre del archivo. */
function printQuote(q) {
  buildQuoteSheet(q, document.getElementById("quote-print"));
  const before = document.title;
  const client = clientOf(q.client_id);
  document.title = "Cotizacion-" + q.number + (client ? "-" + client.name : "");
  document.documentElement.classList.add("is-printing-quote");
  const done = () => {
    document.documentElement.classList.remove("is-printing-quote");
    document.title = before;
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/* ---------- Lista ---------- */
function renderQuotes() {
  if (G.editing) return renderQuoteEditor();
  const root = document.getElementById("view-presupuestos");
  root.innerHTML = "";
  const head = el("div", "view-head");
  head.appendChild(el("h1", "view-title", "Presupuestos"));
  head.appendChild(button("+ Por horas", () => newQuote("horas"), "btn-primary"));
  head.appendChild(button("+ Precio fijo", () => newQuote("fijo")));
  root.appendChild(head);

  const wrap = el("div", "table-wrap");
  if (!G.quotes.length) {
    wrap.appendChild(el("p", "empty", "Todavía no hay cotizaciones en el gestor. La siguiente será la " + nextQuoteNumber() + "."));
    return root.appendChild(wrap);
  }
  const table = el("table", "tbl");
  table.appendChild(tableHead(["Número", "Cliente", "Objeto", "Fecha", "Total", "Estado", ""]));
  const tb = document.createElement("tbody");
  G.quotes.slice().sort((a, b) => String(b.number).localeCompare(String(a.number))).forEach((q) => {
    const tr = document.createElement("tr");
    tr.appendChild(el("td", "", q.number));
    tr.appendChild(el("td", "", clientName(q.client_id)));
    tr.appendChild(el("td", "", q.subject || "—"));
    tr.appendChild(el("td", "", shortDate(q.issue_date)));
    tr.appendChild(el("td", "num", money(q.total)));
    const st = el("td");
    st.appendChild(selectInput(QUOTE_STATUS, q.status, async (v) => {
      q.status = v;
      renderAllViews();
      await safely(dbUpdate("fl_quotes", q.id, { status: v }));
    }));
    tr.appendChild(st);
    const acts = el("td");
    const box = el("div", "acts");
    box.appendChild(button("Editar", () => editQuote(q)));
    box.appendChild(button("PDF", () => printQuote(q)));
    if (q.status === "aceptada" && !q.project_id) {
      box.appendChild(button("Crear proyecto", () => projectFromQuote(q), "btn-primary"));
    }
    acts.appendChild(box);
    tr.appendChild(acts);
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  wrap.appendChild(table);
  root.appendChild(wrap);
}

/* Cotización aceptada -> proyecto con su valor y cliente */
async function projectFromQuote(q) {
  const row = await safely(
    dbInsert("fl_projects", {
      title: q.subject || "Proyecto " + q.number,
      client_id: q.client_id,
      amount: q.total,
      status: "pendiente",
      label: q.number,
    })
  );
  G.projects.push(row);
  q.project_id = row.id;
  await safely(dbUpdate("fl_quotes", q.id, { project_id: row.id }));
  showView("proyectos");
  openDrawer("project", row.id);
}

function newQuote(kind, preset) {
  G.editing = Object.assign(
    { id: null, number: nextQuoteNumber(), kind, status: "borrador", client_id: null, project_id: null, issue_date: todayStr(), subject: "", content: blankContent(kind), total: 0 },
    preset || {}
  );
  clearQuoteView();
  closeDrawerQuiet();
  showView("presupuestos");
}

function editQuote(q) {
  G.editing = JSON.parse(JSON.stringify(q));
  G.editing.content = Object.assign(blankContent(q.kind), q.content || {});
  clearQuoteView();
  closeDrawerQuiet();
  showView("presupuestos");
}

/* Limpia el editor anterior antes de abrir otra cotización */
function clearQuoteView() {
  document.getElementById("view-presupuestos").innerHTML = "";
}

function closeDrawerQuiet() {
  G.drawer = null;
  document.getElementById("drawer").hidden = true;
}

/* ---------- Editor con la hoja al lado ---------- */
function renderQuoteEditor() {
  const q = G.editing;
  const c = q.content;
  const root = document.getElementById("view-presupuestos");
  root.innerHTML = "";

  const head = el("div", "view-head");
  head.appendChild(el("h1", "view-title", (q.id ? "Editar " : "Nueva ") + q.number + (q.kind === "horas" ? " · por horas" : " · precio fijo")));
  const note = el("span", "q-save-note");
  head.appendChild(note);
  head.appendChild(button("Volver", () => {
    G.editing = null;
    clearQuoteView();
    renderQuotes();
  }));
  head.appendChild(button("Guardar como PDF", () => {
    q.total = quoteTotal(q);
    printQuote(q);
  }));
  const saveBtn = button("Guardar", saveQuote, "btn-primary");
  head.appendChild(saveBtn);
  root.appendChild(head);

  const wrap = el("div", "q-editor");
  const form = el("div", "q-form");
  const preview = el("div", "q-preview");
  wrap.appendChild(form);
  wrap.appendChild(preview);
  root.appendChild(wrap);

  let timer = null;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildQuoteSheet(q, preview), 120);
  };
  const live = (obj, key) => (v) => {
    obj[key] = v;
    refresh();
  };
  const text = (label, obj, key, type) => field(label, textInput(obj[key], live(obj, key), type, "input"));
  const area = (label, obj, key, rows) => field(label, textArea(obj[key], live(obj, key), rows, "input"));
  const set = (title) => {
    const f = document.createElement("fieldset");
    f.appendChild(el("legend", "", title));
    form.appendChild(f);
    return f;
  };

  const data = set("Datos");
  const two = el("div", "two");
  two.appendChild(text("Número", q, "number"));
  two.appendChild(text("Fecha", q, "issue_date", "date"));
  two.appendChild(field("Cliente", selectInput(clientOptions(), q.client_id, (v) => { q.client_id = v || null; refresh(); })));
  two.appendChild(field("Proyecto", selectInput(projectOptions(), q.project_id, (v) => { q.project_id = v || null; })));
  two.appendChild(field("Estado", selectInput(QUOTE_STATUS, q.status, (v) => { q.status = v; })));
  two.appendChild(text("Validez (días)", c, "validDays", "number"));
  data.appendChild(two);
  data.appendChild(area("Objeto", q, "subject", 2));

  const scope = set("Qué se cotiza y qué se entrega");
  scope.appendChild(area("Qué se cotiza (un párrafo por línea)", c, "intro", 3));
  c.groups.forEach((g, i) => {
    scope.appendChild(text("Grupo de entregables " + (i + 1) + " (título)", g, "title"));
    scope.appendChild(area("Entregables (uno por línea)", g, "items", 4));
  });
  scope.appendChild(button("+ Grupo", () => {
    c.groups.push({ title: "", items: "" });
    renderQuoteEditor();
  }, "q-add"));

  if (q.kind === "horas") {
    const hours = set("Horas y tarifa");
    hours.appendChild(text("Título de la sección", c, "hoursLabel"));
    hours.appendChild(text("Nota del total (p. ej. entre julio y octubre de 2026)", c, "hoursNote"));
    c.hours.forEach((r, i) => hours.appendChild(rowEditor(r, "area", "hours", "Área de trabajo", "Horas", () => {
      c.hours.splice(i, 1);
      renderQuoteEditor();
    }, refresh)));
    hours.appendChild(button("+ Fila", () => {
      c.hours.push({ area: "", hours: "" });
      renderQuoteEditor();
    }, "q-add"));
    hours.appendChild(area("Nota de la tarifa", c, "rateNote", 2));
    const rates = el("div", "two");
    rates.appendChild(text("Tarifa baja por hora", c, "rateLow", "number"));
    rates.appendChild(text("Tarifa propuesta por hora", c, "rateHigh", "number"));
    hours.appendChild(rates);
  } else {
    const items = set("Conceptos y valor");
    c.items.forEach((r, i) => items.appendChild(rowEditor(r, "concept", "value", "Concepto", "Valor COP", () => {
      c.items.splice(i, 1);
      renderQuoteEditor();
    }, refresh)));
    items.appendChild(button("+ Concepto", () => {
      c.items.push({ concept: "", value: "" });
      renderQuoteEditor();
    }, "q-add"));
  }

  const cond = set("Valor y condiciones");
  cond.appendChild(area("Nota bajo el valor", c, "valueNote", 2));
  cond.appendChild(area("Qué incluye (uno por línea)", c, "includes", 5));
  [["pay5050", "Ofrecer 50 % a la firma y 50 % a la entrega"], ["pay3", "Ofrecer tres cuotas mensuales"]].forEach(([key, label]) => {
    const lab = el("label", "check");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!c[key];
    cb.addEventListener("change", () => {
      c[key] = cb.checked;
      refresh();
    });
    lab.appendChild(cb);
    lab.appendChild(el("span", "", label));
    cond.appendChild(lab);
  });
  cond.appendChild(area("Notas legales (una por línea)", c, "legal", 5));

  const who = set("Quién cotiza (se repite en todas)");
  who.appendChild(area("Perfil", c, "profile", 5));
  who.appendChild(area("Tecnologías (Título: lista, una por línea)", c, "tech", 5));
  who.appendChild(area("Formación", c, "education", 2));

  buildQuoteSheet(q, preview);

  async function saveQuote() {
    q.total = quoteTotal(q);
    if (!String(q.number).trim()) return (note.textContent = "Falta el número.");
    const row = {
      number: String(q.number).trim(),
      kind: q.kind,
      status: q.status,
      client_id: q.client_id,
      project_id: q.project_id,
      issue_date: q.issue_date || todayStr(),
      subject: q.subject || null,
      content: q.content,
      total: q.total,
    };
    saveBtn.disabled = true;
    note.textContent = "Guardando…";
    try {
      const saved = q.id ? await dbUpdate("fl_quotes", q.id, row) : await dbInsert("fl_quotes", row);
      const i = G.quotes.findIndex((x) => x.id === saved.id);
      if (i >= 0) G.quotes[i] = saved;
      else G.quotes.push(saved);
      q.id = saved.id;
      note.textContent = "Guardada.";
      paintSide();
    } catch (e) {
      note.textContent =
        e && e.code === "23505" ? "Ese número ya existe: usa otro." : "No se pudo guardar: " + ((e && e.message) || "error");
    } finally {
      saveBtn.disabled = false;
    }
  }
}

function rowEditor(row, keyA, keyB, phA, phB, onRemove, refresh) {
  const box = el("div", "q-row");
  const a = textInput(row[keyA], (v) => { row[keyA] = v; refresh(); }, "text", "input");
  a.placeholder = phA;
  a.setAttribute("aria-label", phA);
  const b = textInput(row[keyB], (v) => { row[keyB] = v; refresh(); }, "number", "input");
  b.placeholder = phB;
  b.setAttribute("aria-label", phB);
  const x = el("button", "x", "✕");
  x.type = "button";
  x.setAttribute("aria-label", "Quitar fila");
  x.addEventListener("click", onRemove);
  box.appendChild(a);
  box.appendChild(b);
  box.appendChild(x);
  return box;
}

/* =========================================================
   BANDEJA: lo que llega por el formulario de Contacto
   ========================================================= */
const MOTIVE_INFO = {
  cotizar: ["Cotización", "is-accent"],
  colaborar: ["Colaboración", "is-good"],
  empleo: ["Empleo", "is-violet"],
  otro: ["Contacto", ""],
};
const EXTRA_LABELS = {
  projectType: "Proyecto",
  budget: "Presupuesto",
  deadline: "Para cuándo",
  collabArea: "En qué",
  company: "Empresa",
  link: "Enlace",
};
const FOLLOW_STATUS = [
  ["nuevo", "Nuevo"],
  ["contactado", "Contactado"],
  ["seguimiento", "En seguimiento"],
  ["ganado", "Ganado"],
  ["descartado", "Descartado"],
];
const followLabel = (m) => (FOLLOW_STATUS.find(([k]) => k === (m.follow_status || "nuevo")) || FOLLOW_STATUS[0])[1];
const followOpen = (m) => !["ganado", "descartado"].includes(m.follow_status);
/* Pendientes: con fecha de seguimiento de hoy o ya pasada */
const followDue = () => G.messages.filter((m) => followOpen(m) && m.follow_up_on && daysUntil(m.follow_up_on) <= 0);
const whenShort = (iso) =>
  iso ? new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

function renderInbox() {
  const root = document.getElementById("view-bandeja");
  root.innerHTML = "";
  const head = el("div", "view-head");
  head.appendChild(el("h1", "view-title", "Bandeja"));
  const mailNote = el("span", "q-save-note");
  head.appendChild(mailNote);
  const testBtn = button("Probar correo", async () => {
    testBtn.disabled = true;
    mailNote.classList.remove("is-bad");
    mailNote.textContent = "Enviando prueba…";
    try {
      const sb = await getSupabase();
      const { data } = await sb.auth.getSession();
      const r = await fetch("/api/monitor?test=mail", {
        method: "POST",
        headers: { Authorization: "Bearer " + (data.session ? data.session.access_token : "") },
      });
      const out = await r.json().catch(() => ({}));
      if (out.ok) mailNote.textContent = "Brevo la aceptó. Revisa tu correo, también spam.";
      else {
        mailNote.classList.add("is-bad");
        mailNote.textContent = "No salió: " + (out.error || "respuesta " + r.status);
      }
    } catch (e) {
      mailNote.classList.add("is-bad");
      mailNote.textContent = "No se pudo probar: " + e.message;
    } finally {
      testBtn.disabled = false;
    }
  });
  head.appendChild(testBtn);
  root.appendChild(head);
  root.appendChild(el("p", "view-note", "Cada envío del formulario llega aquí y a tu correo. Abre un mensaje para anotar su estado y cuándo volver a escribirle."));

  const due = followDue();
  if (due.length) {
    root.appendChild(el("p", "alert-week", due.length + (due.length === 1 ? " seguimiento para hoy: " : " seguimientos para hoy: ") + due.map((m) => m.name).join(", ")));
  }

  const filters = el("div", "inbox-filters");
  [["abiertos", "Abiertos"], ["pendientes", "Con seguimiento"], ["todos", "Todos"]].forEach(([k, label]) => {
    const b = button(label, () => {
      G.inboxFilter = k;
      renderInbox();
    });
    b.classList.toggle("is-on", (G.inboxFilter || "abiertos") === k);
    filters.appendChild(b);
  });
  root.appendChild(filters);

  const wrap = el("div", "table-wrap");
  if (!G.messages.length) {
    wrap.appendChild(el("p", "empty", "Todavía no ha llegado ningún mensaje."));
    return root.appendChild(wrap);
  }
  const table = el("table", "tbl");
  table.appendChild(tableHead(["Motivo", "De", "Asunto", "Estado", "Seguimiento", "Recibido"]));
  const tb = document.createElement("tbody");
  const filter = G.inboxFilter || "abiertos";
  const shown = G.messages
    .filter((m) => filter === "todos" || (filter === "abiertos" ? followOpen(m) : followOpen(m) && m.follow_up_on))
    .sort((a, b) =>
      filter === "pendientes"
        ? String(a.follow_up_on).localeCompare(String(b.follow_up_on))
        : String(b.created_at).localeCompare(String(a.created_at))
    );
  if (!shown.length) {
    wrap.appendChild(el("p", "empty", "Nada por aquí con este filtro."));
    return root.appendChild(wrap);
  }
  shown.forEach((m) => {
    const tr = el("tr", "is-link" + (m.read ? "" : " is-unread"));
    const info = MOTIVE_INFO[m.motive] || MOTIVE_INFO.otro;
    const td = el("td");
    td.appendChild(el("span", "tag " + info[1], info[0]));
    if (m.mail_error) td.appendChild(el("span", "tag is-hot mail-tag", "Correo no salió"));
    tr.appendChild(td);
    tr.appendChild(el("td", "", m.name));
    tr.appendChild(el("td", "", m.subject));
    tr.appendChild(el("td", "", followLabel(m)));
    const fu = el("td");
    const fuTag = m.follow_up_on && followOpen(m) ? tagForDay(m.follow_up_on, false) : null;
    if (fuTag) fu.appendChild(el("span", "tag " + fuTag[1], fuTag[0]));
    else fu.textContent = "—";
    tr.appendChild(fu);
    tr.appendChild(el("td", "", whenShort(m.created_at)));
    tr.addEventListener("click", () => openMessage(m));
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  wrap.appendChild(table);
  root.appendChild(wrap);
}

function openMessage(m) {
  if (!m.read) {
    m.read = true;
    safely(dbUpdate("fl_messages", m.id, { read: true }));
    paintSide();
  }
  openDrawer("message", m.id);
  if (G.view === "bandeja") renderInbox();
}

function messageDrawer(box) {
  const m = G.messages.find((x) => x.id === G.drawer.id);
  if (!m) return closeDrawer();
  const info = MOTIVE_INFO[m.motive] || MOTIVE_INFO.otro;
  drawerTop(box, info[0]);
  box.appendChild(el("h3", "msg-subject", m.subject));
  const dl = el("dl", "msg-facts");
  const add = (k, v) => {
    dl.appendChild(el("dt", "", k));
    dl.appendChild(el("dd", "", v));
  };
  add("De", m.name);
  add("Correo", m.email);
  Object.keys(m.extra || {}).forEach((k) => add(EXTRA_LABELS[k] || k, m.extra[k]));
  add("Recibido", whenShort(m.created_at));
  box.appendChild(dl);
  if (m.mail_error) box.appendChild(el("p", "gestor-warn is-bad", "El correo no salió: " + m.mail_error));
  box.appendChild(el("div", "msg-body", m.message));

  // Seguimiento: estado, próxima fecha y notas
  box.appendChild(el("h3", "", "Seguimiento"));
  const saveFollow = (patch) => {
    Object.assign(m, patch);
    renderAllViews();
    safely(dbUpdate("fl_messages", m.id, patch));
  };
  const two = el("div", "two");
  two.appendChild(field("Estado", selectInput(FOLLOW_STATUS, m.follow_status || "nuevo", (v) => saveFollow({ follow_status: v }))));
  two.appendChild(field("Volver a escribir", textInput(m.follow_up_on, (v) => saveFollow({ follow_up_on: v || null }), "date")));
  box.appendChild(two);
  box.appendChild(field("Notas", textArea(m.follow_notes, (v) => saveFollow({ follow_notes: v || null }), 3)));

  const acts = el("div", "msg-acts");
  const answer = el("a", "btn btn-primary", "Responder");
  answer.href = "mailto:" + encodeURIComponent(m.email).replace("%40", "@") + "?subject=" + encodeURIComponent("Re: " + m.subject);
  acts.appendChild(answer);
  acts.appendChild(button("Crear cliente y proyecto", async () => {
    const extra = m.extra || {};
    const client =
      G.clients.find((c) => c.email && c.email.toLowerCase() === m.email.toLowerCase()) ||
      (await safely(dbInsert("fl_clients", { name: extra.company || m.name, contact: m.name, email: m.email })));
    if (!G.clients.includes(client)) G.clients.push(client);
    const project = await safely(
      dbInsert("fl_projects", { title: extra.projectType || m.subject, client_id: client.id, status: "pendiente", notes: m.message })
    );
    G.projects.push(project);
    m.follow_status = "ganado";
    safely(dbUpdate("fl_messages", m.id, { follow_status: "ganado" }));
    showView("proyectos");
    openDrawer("project", project.id);
  }));
  acts.appendChild(button("Borrar", async () => {
    if (!window.confirm("¿Borrar este mensaje? No se puede deshacer.")) return;
    G.messages = G.messages.filter((o) => o.id !== m.id);
    closeDrawer();
    renderAllViews();
    await safely(dbDelete("fl_messages", m.id));
  }));
  box.appendChild(acts);
}

/* =========================================================
   SITIOS: monitor de mis webs. Las revisa api/monitor.js cada
   5 minutos (cron de Supabase); aquí se ve el estado en vivo.
   ========================================================= */
const SITE_STATUS = {
  up: ["Arriba", "is-good"],
  down: ["Caída", "is-hot"],
  unknown: ["Sin revisar", ""],
};

/* ---------- Carpetas, disponibilidad y causas de caída ---------- */
const SITE_VIEW_KEY = "panel-sitios-vista";

function siteMode() {
  if (!G.siteMode) {
    try {
      G.siteMode = localStorage.getItem(SITE_VIEW_KEY) || "carpetas";
    } catch (e) {
      G.siteMode = "carpetas";
    }
  }
  return G.siteMode;
}

function setSiteMode(mode) {
  G.siteMode = mode;
  try {
    localStorage.setItem(SITE_VIEW_KEY, mode);
  } catch (e) {}
  renderSites();
}

const siteGroups = () =>
  [...new Set(G.sites.map((x) => x.grp).concat(G.settings.carpetas || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
const licenseOfSite = (id) => G.licenses.find((l) => l.site_id === id) || null;
const hostOf = (url) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch (e) {
    return String(url || "");
  }
};

/* Certificado SSL: avisa desde 21 días antes */
function sslState(x) {
  if (!x.ssl_expires_on) return null;
  const d = daysUntil(x.ssl_expires_on);
  if (d < 0) return ["SSL vencido", "is-hot"];
  if (d <= 7) return ["SSL vence en " + d + " d", "is-hot"];
  if (d <= 21) return ["SSL vence en " + d + " d", "is-warn"];
  return null;
}

function siteRank(x) {
  if (x.active && x.status === "down") return 0;
  const ssl = sslState(x);
  if (ssl) return ssl[1] === "is-hot" ? 1 : 2;
  return x.active ? 3 : 4;
}
const siteOrder = (a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || siteRank(a) - siteRank(b) || a.name.localeCompare(b.name);

/* Tiempo caído en la ventana de días, a partir del historial de caídas */
function uptimeOf(site, days) {
  const now = Date.now();
  const from = Math.max(now - days * 86400000, new Date(site.created_at || now).getTime());
  const evs = G.events
    .filter((e) => e.site_id === site.id)
    .map((e) => ({ kind: e.kind, t: new Date(e.at).getTime() }))
    .sort((a, b) => a.t - b.t);
  const before = evs.filter((e) => e.t < from).pop();
  let downSince = before && before.kind === "down" ? from : null;
  let downMs = 0;
  let outages = 0;
  evs.filter((e) => e.t >= from).forEach((e) => {
    if (e.kind === "down") {
      if (downSince === null) {
        downSince = e.t;
        outages++;
      }
    } else if (downSince !== null) {
      downMs += e.t - downSince;
      downSince = null;
    }
  });
  if (downSince !== null) downMs += now - downSince;
  return { pct: Math.max(0, 100 - (downMs / Math.max(1, now - from)) * 100), outages, downMs, known: !!site.last_checked_at };
}

const pctText = (p) => (p >= 99.995 ? "100" : p.toFixed(2).replace(".", ",")) + " %";

function durationText(ms) {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60);
  if (h < 48) return h + " h" + (min % 60 ? " " + (min % 60) + " min" : "");
  return Math.floor(h / 24) + " d " + (h % 24) + " h";
}

/* El monitor (api/monitor.js) escribe el problema; aquí, qué suele significar */
function outageCause(err) {
  const e = String(err || "");
  if (!e) return "";
  if (/^HTTP 5/.test(e)) return "el servidor responde con error: falla de la aplicación, de la base de datos o del hosting.";
  if (/Sin respuesta/.test(e)) return "el servidor no contesta a tiempo: apagado, saturado o sin memoria.";
  if (/DNS|[Dd]ominio/.test(e)) return "el dominio no resuelve: venció el dominio o cambiaron los DNS.";
  if (/rechaz/.test(e)) return "el equipo está encendido pero el servicio web no corre.";
  if (/[Cc]ertificado/.test(e)) return "el certificado SSL venció o no es válido: los navegadores bloquean la web.";
  if (/cort|inalcanzable/.test(e)) return "la conexión se cae: red inestable o servidor reiniciándose.";
  return "no hay conexión con el servidor: hosting caído o problema de red.";
}

function attachList(input, values) {
  const dl = document.createElement("datalist");
  dl.id = "dl" + Math.random().toString(36).slice(2, 9);
  values.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    dl.appendChild(o);
  });
  input.setAttribute("list", dl.id);
  return dl;
}

function checkField(label, checked, onChange) {
  const wrap = el("label", "check-inline");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!checked;
  cb.addEventListener("change", () => onChange(cb.checked));
  wrap.appendChild(cb);
  wrap.appendChild(el("span", "", label));
  return wrap;
}

/* ---------- Cuadros ---------- */
function siteCard(x) {
  const st = SITE_STATUS[x.status] || SITE_STATUS.unknown;
  const down = x.active && x.status === "down";
  const card = el("button", "site-card" + (down ? " is-down" : "") + (x.active ? "" : " is-off") + (x.is_main ? " is-main" : ""));
  card.type = "button";
  const top = el("span", "sc-top");
  top.appendChild(el("span", "tag " + (x.active ? st[1] : ""), x.active ? st[0] : "Sin vigilar"));
  if (x.last_ms != null && x.status === "up") top.appendChild(el("span", "sc-ms", x.last_ms + " ms"));
  card.appendChild(top);
  if (x.is_main) card.appendChild(el("span", "sc-main", "Sitio principal"));
  card.appendChild(el("span", "sc-name", x.name));
  card.appendChild(el("span", "sc-url", hostOf(x.url)));
  const lic = licenseOfSite(x.id);
  if (lic) {
    const row = el("span", "sc-lic");
    row.appendChild(el("span", "", clientName(lic.client_id)));
    if (lic.blocked) row.appendChild(el("span", "tag is-hot", "Bloqueado"));
    const m = maintState(lic);
    if (m.cls === "is-hot" && !lic.blocked) row.appendChild(el("span", "tag is-hot", isSub(lic) ? "Pago vencido" : "Mant. vencido"));
    else if (m.cls === "is-warn") row.appendChild(el("span", "tag is-warn", m.label));
    card.appendChild(row);
  }
  if (down && x.last_error) card.appendChild(el("span", "site-err", x.last_error));
  const ssl = sslState(x);
  if (ssl) card.appendChild(el("span", "tag sc-ssl " + ssl[1], ssl[0]));
  const up = uptimeOf(x, 30);
  card.appendChild(
    el("span", "sc-meta", up.known ? pctText(up.pct) + " en 30 días" + (up.outages ? " · " + up.outages + (up.outages === 1 ? " caída" : " caídas") : "") : "Sin datos todavía")
  );
  card.addEventListener("click", () => openDrawer("site", x.id));
  return card;
}

function folderCard(name) {
  const list = G.sites.filter((x) => x.grp === name);
  const active = list.filter((x) => x.active);
  const down = active.filter((x) => x.status === "down").length;
  const up = active.filter((x) => x.status === "up").length;
  const card = el("button", "folder-card" + (down ? " is-down" : ""));
  card.type = "button";
  const icon = el("span", "fc-icon");
  icon.innerHTML = pixelSvg(PIXELS.folder); // dibujo fijo de PIXELS, nunca datos de afuera
  card.appendChild(icon);
  const body = el("span", "fc-body");
  body.appendChild(el("span", "sc-name", name));
  const main = list.find((x) => x.is_main);
  if (main) body.appendChild(el("span", "sc-url", hostOf(main.url)));
  const others = list.length - (main ? 1 : 0);
  body.appendChild(el("span", "sc-meta", list.length ? (main ? "Principal + " : "") + others + (others === 1 ? " sitio" : " sitios") : "Vacía"));
  const tags = el("span", "fc-tags");
  if (down) tags.appendChild(el("span", "tag is-hot", down + (down === 1 ? " caída" : " caídas")));
  else if (active.length && up === active.length) tags.appendChild(el("span", "tag is-good", "Todo arriba"));
  else if (active.length) tags.appendChild(el("span", "tag", up + " arriba"));
  const ssl = list.filter(sslState).length;
  if (ssl) tags.appendChild(el("span", "tag is-warn", "SSL: " + ssl));
  const lics = G.licenses.filter((l) => l.product === name);
  if (lics.length) tags.appendChild(el("span", "tag", lics.length + (lics.length === 1 ? " suscripción" : " suscripciones")));
  const locked = lics.filter((l) => l.blocked).length;
  if (locked) tags.appendChild(el("span", "tag is-hot", locked + (locked === 1 ? " bloqueado" : " bloqueados")));
  body.appendChild(tags);
  card.appendChild(body);
  card.addEventListener("click", () => {
    G.siteFolder = name;
    renderSites();
    window.scrollTo(0, 0);
  });
  return card;
}

const SITE_PAGE = 16; // 4 columnas × 4 filas

function pagedGrid(nodes, key) {
  G.sitePages = G.sitePages || {};
  const pages = Math.max(1, Math.ceil(nodes.length / SITE_PAGE));
  const page = Math.min(G.sitePages[key] || 0, pages - 1);
  const wrap = el("div", "site-paged");
  const grid = el("div", "site-grid");
  nodes.slice(page * SITE_PAGE, (page + 1) * SITE_PAGE).forEach((n) => grid.appendChild(n));
  wrap.appendChild(grid);
  if (pages > 1) {
    const go = (n) => () => {
      G.sitePages[key] = n;
      renderSites();
      wrap.scrollIntoView({ block: "start" });
    };
    const pager = el("div", "site-pager");
    const prev = button("← Anterior", go(page - 1));
    prev.disabled = page === 0;
    const next = button("Siguiente →", go(page + 1));
    next.disabled = page >= pages - 1;
    pager.appendChild(prev);
    pager.appendChild(el("span", "", "Página " + (page + 1) + " de " + pages + " · " + nodes.length + " cuadros"));
    pager.appendChild(next);
    wrap.appendChild(pager);
  }
  return wrap;
}

function siteGrid(list, key) {
  return pagedGrid(list.map(siteCard), key || "lista");
}

/* Carpeta nueva: un nombre y, si quieres, su sitio principal */
async function newFolder() {
  const name = (window.prompt("Nombre de la carpeta (por ejemplo, Legajo):") || "").trim();
  if (!name) return;
  const url = (window.prompt("Dirección del sitio principal de " + name + " (opcional, https://…):") || "").trim();
  if (url) {
    const link = /^https?:\/\//i.test(url) ? safeUrl(url) : "";
    if (!link) toast("La dirección debe empezar por https://. Creé la carpeta sin sitio principal.", "is-bad");
    else G.sites.push(await safely(dbInsert("fl_sites", { name, url: link, grp: name, is_main: true })));
  }
  const list = G.settings.carpetas || [];
  if (!list.includes(name)) await saveSetting("carpetas", list.concat(name));
  G.siteMode = "carpetas";
  G.siteFolder = name;
  renderAllViews();
}

async function dropFolder(name) {
  if (G.sites.some((x) => x.grp === name)) return toast("La carpeta tiene sitios: muévelos o quítalos primero.", "is-bad");
  await saveSetting("carpetas", (G.settings.carpetas || []).filter((n) => n !== name));
  G.siteFolder = null;
  renderAllViews();
}

function siteAddForm() {
  const form = el("form", "inline-add site-add");
  const name = textInput("", () => {});
  name.placeholder = "Nombre";
  name.setAttribute("aria-label", "Nombre de la web");
  const url = textInput("", () => {}, "url");
  url.placeholder = "https://…";
  url.setAttribute("aria-label", "Dirección de la web");
  const grp = textInput(G.siteFolder || "", () => {});
  grp.placeholder = "Carpeta (opcional)";
  grp.setAttribute("aria-label", "Carpeta");
  const addBtn = el("button", "btn", "Añadir web");
  addBtn.type = "submit";
  form.appendChild(name);
  form.appendChild(url);
  form.appendChild(grp);
  form.appendChild(attachList(grp, siteGroups()));
  form.appendChild(addBtn);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const link = /^https?:\/\//i.test(url.value.trim()) ? safeUrl(url.value.trim()) : "";
    if (!name.value.trim()) return name.focus();
    if (!link) return url.focus();
    const folder = grp.value.trim();
    // El primer sitio de una carpeta sin principal queda como principal
    const main = !!folder && !G.sites.some((s) => s.grp === folder && s.is_main);
    const row = await safely(
      dbInsert("fl_sites", Object.assign({ name: name.value.trim(), url: link }, folder ? { grp: folder } : {}, main ? { is_main: true } : {}))
    );
    G.sites.push(row);
    renderAllViews();
  });
  return form;
}

function renderSites() {
  const root = document.getElementById("view-sitios");
  root.innerHTML = "";
  const head = el("div", "view-head");
  head.appendChild(el("h1", "view-title", "Sitios"));
  const note = el("span", "q-save-note");
  head.appendChild(note);
  head.appendChild(button("+ Carpeta", newFolder));
  head.appendChild(button("Importar de mis proyectos", importSites));
  const check = button("Revisar ahora", async () => {
    check.disabled = true;
    note.textContent = "Revisando…";
    try {
      const sb = await getSupabase();
      const { data } = await sb.auth.getSession();
      const r = await fetch("/api/monitor", {
        method: "POST",
        headers: { Authorization: "Bearer " + (data.session ? data.session.access_token : "") },
      });
      if (r.status === 503) throw new Error("falta SUPABASE_SECRET_KEY en Vercel");
      if (!r.ok) throw new Error("el monitor respondió " + r.status);
      await refreshSites();
      note.textContent = "Revisado.";
    } catch (e) {
      note.textContent = "No se pudo revisar: " + e.message;
    } finally {
      check.disabled = false;
    }
  }, "btn-primary");
  head.appendChild(check);
  root.appendChild(head);
  root.appendChild(
    el("p", "view-note", "Se revisan cada 5 minutos. Si una web falla dos veces seguidas te llega un aviso, y otro cuando vuelve. Agrupa en carpetas las webs de un producto, como Legajo y las notarías que lo usan.")
  );

  const active = G.sites.filter((x) => x.active);
  const sum = el("div", "site-sum");
  const chip = (text, cls) => sum.appendChild(el("span", "tag " + (cls || ""), text));
  chip(G.sites.length + (G.sites.length === 1 ? " web" : " webs"));
  chip(active.filter((x) => x.status === "up").length + " arriba", "is-good");
  const downN = active.filter((x) => x.status === "down").length;
  if (downN) chip(downN + (downN === 1 ? " caída" : " caídas"), "is-hot");
  const sslN = G.sites.filter(sslState).length;
  if (sslN) chip(sslN + " con SSL por vencer", "is-warn");
  root.appendChild(sum);

  const tools = el("div", "site-tools");
  const modes = el("div", "inbox-filters");
  [["carpetas", "Carpetas"], ["todo", "Todo"]].forEach(([k, label]) => {
    const b = button(label, () => setSiteMode(k));
    b.classList.toggle("is-on", siteMode() === k);
    modes.appendChild(b);
  });
  tools.appendChild(modes);
  tools.appendChild(siteAddForm());
  root.appendChild(tools);

  if (!G.sites.length && !siteGroups().length) {
    root.appendChild(el("p", "empty", "Todavía no vigilas ninguna web. Crea una carpeta, añade una web o impórtalas de tus proyectos."));
    return;
  }

  const groups = siteGroups();
  if (G.siteFolder && !groups.includes(G.siteFolder)) G.siteFolder = null;
  let scope = G.sites;
  if (siteMode() === "carpetas" && G.siteFolder) {
    scope = G.sites.filter((x) => x.grp === G.siteFolder);
    const crumb = el("div", "site-crumb");
    crumb.appendChild(button("← Todas", () => {
      G.siteFolder = null;
      renderSites();
    }));
    crumb.appendChild(el("h2", "view-sub", G.siteFolder));
    const folder = G.siteFolder;
    const lics = G.licenses.filter((l) => l.product === folder).length;
    if (lics) {
      crumb.appendChild(button("Ver suscripciones (" + lics + ")", () => {
        G.licProduct = folder;
        G.licFilter = "";
        goToView("licencias");
      }));
    }
    if (!scope.length) crumb.appendChild(button("Borrar carpeta", () => dropFolder(folder)));
    root.appendChild(crumb);
    if (!scope.length) root.appendChild(el("p", "empty", "Carpeta vacía. Añade arriba el sitio principal y luego los demás: el formulario ya trae el nombre de la carpeta."));
    else root.appendChild(siteGrid(scope.slice().sort(siteOrder), "carpeta:" + folder));
  } else if (siteMode() === "carpetas") {
    root.appendChild(pagedGrid(groups.map(folderCard).concat(G.sites.filter((x) => !x.grp).sort(siteOrder).map(siteCard)), "raiz"));
  } else {
    groups.concat(G.sites.some((x) => !x.grp) ? [""] : []).forEach((g) => {
      const list = G.sites.filter((x) => (x.grp || "") === g).sort(siteOrder);
      const down = list.filter((x) => x.active && x.status === "down").length;
      root.appendChild(
        el("h2", "view-sub site-group-title", (g || "Sin carpeta") + " · " + list.length + (list.length === 1 ? " web" : " webs") + (down ? " · " + down + (down === 1 ? " caída" : " caídas") : ""))
      );
      root.appendChild(list.length ? siteGrid(list, "todo:" + g) : el("p", "empty", "Carpeta vacía."));
    });
  }

  const ids = new Set(scope.map((x) => x.id));
  const recent = G.events.filter((ev) => ids.has(ev.site_id)).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 15);
  if (recent.length) {
    root.appendChild(el("h2", "view-sub", "Historial"));
    const w2 = el("div", "table-wrap");
    const t2 = el("table", "tbl");
    t2.appendChild(tableHead(["Cuándo", "Web", "Qué pasó", "Detalle"]));
    const b2 = document.createElement("tbody");
    recent.forEach((ev) => {
      const tr = el("tr", "is-link");
      const site = G.sites.find((o) => o.id === ev.site_id);
      tr.appendChild(el("td", "", whenShort(ev.at)));
      tr.appendChild(el("td", "", site ? site.name : "—"));
      const td = el("td");
      td.appendChild(el("span", "tag " + (ev.kind === "down" ? "is-hot" : "is-good"), ev.kind === "down" ? "Se cayó" : "Volvió"));
      tr.appendChild(td);
      tr.appendChild(el("td", "", ev.detail || "—"));
      if (site) tr.addEventListener("click", () => openDrawer("site", site.id));
      b2.appendChild(tr);
    });
    t2.appendChild(b2);
    w2.appendChild(t2);
    root.appendChild(w2);
  }
}

/* ---------- Detalle de un sitio ---------- */
function siteDrawer(box) {
  const x = G.sites.find((o) => o.id === G.drawer.id);
  if (!x) return closeDrawer();
  drawerTop(box, x.grp ? "Carpeta " + x.grp : "Sitio");
  const save = (patch) => {
    Object.assign(x, patch);
    renderAllViews();
    safely(dbUpdate("fl_sites", x.id, patch));
  };

  box.appendChild(el("h3", "msg-subject", x.name));
  const st = SITE_STATUS[x.status] || SITE_STATUS.unknown;
  const line = el("p", "site-line");
  line.appendChild(el("span", "tag " + (x.active ? st[1] : ""), x.active ? st[0] : "Sin vigilar"));
  line.appendChild(
    el("span", "", [x.last_http ? "HTTP " + x.last_http : "", x.last_ms != null ? x.last_ms + " ms" : "", x.last_checked_at ? "revisada " + whenShort(x.last_checked_at) : "sin revisar"].filter(Boolean).join(" · "))
  );
  box.appendChild(line);
  if (x.status === "down" && x.last_error) {
    box.appendChild(el("p", "gestor-warn is-bad", x.last_error));
    box.appendChild(el("p", "site-cause", "Causa probable: " + outageCause(x.last_error)));
  }
  const a = el("a", "site-url", x.url);
  a.href = safeUrl(x.url) || "#";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  box.appendChild(a);

  const u7 = uptimeOf(x, 7);
  const u30 = uptimeOf(x, 30);
  const dl = el("dl", "msg-facts");
  const fact = (k, v) => {
    dl.appendChild(el("dt", "", k));
    dl.appendChild(el("dd", "", v));
  };
  fact("Disponible 7 días", u7.known ? pctText(u7.pct) : "Sin datos");
  fact("Disponible 30 días", u30.known ? pctText(u30.pct) : "Sin datos");
  fact("Caídas en 30 días", String(u30.outages) + (u30.downMs ? " · " + durationText(u30.downMs) + " en total" : ""));
  const lastDown = G.events.filter((e) => e.site_id === x.id && e.kind === "down").sort((p, q) => String(q.at).localeCompare(String(p.at)))[0];
  fact("Última caída", lastDown ? whenShort(lastDown.at) + (lastDown.detail ? " · " + lastDown.detail : "") : "Ninguna registrada");
  const ssl = sslState(x);
  fact(
    "Certificado SSL",
    x.ssl_expires_on ? (ssl ? ssl[0] : "Vigente") + " · " + longDate(x.ssl_expires_on) : /^https:/i.test(x.url) ? "Sin revisar todavía" : "La web no usa HTTPS"
  );
  box.appendChild(dl);

  box.appendChild(el("h3", "", "Datos"));
  box.appendChild(field("Nombre", textInput(x.name, (v) => save({ name: v.trim() || x.name }))));
  box.appendChild(field("Dirección", textInput(x.url, (v) => {
    const link = /^https?:\/\//i.test(v.trim()) ? safeUrl(v.trim()) : "";
    if (!link) return toast("La dirección debe empezar por https://", "is-bad");
    save({ url: link });
  }, "url")));
  const grp = textInput(x.grp, (v) => save({ grp: v.trim() || null }));
  const grpField = field("Carpeta", grp);
  grpField.appendChild(attachList(grp, siteGroups()));
  box.appendChild(grpField);
  box.appendChild(checkField("Vigilar esta web", x.active, (v) => save({ active: v })));
  if (x.grp) {
    box.appendChild(checkField("Sitio principal de " + x.grp, x.is_main, (v) => {
      if (v) {
        G.sites
          .filter((s) => s.grp === x.grp && s.id !== x.id && s.is_main)
          .forEach((s) => {
            s.is_main = false;
            safely(dbUpdate("fl_sites", s.id, { is_main: false }));
          });
      }
      save({ is_main: v });
    }));
  }

  const lic = licenseOfSite(x.id);
  const licOpts = [["", "Sin suscripción"]].concat(G.licenses.map((l) => [l.id, (l.product || "Legajo") + " · " + clientName(l.client_id)]));
  box.appendChild(field("Suscripción o licencia", selectInput(licOpts, lic ? lic.id : "", (v) => {
    const before = licenseOfSite(x.id);
    if (before) {
      before.site_id = null;
      safely(dbUpdate("fl_licenses", before.id, { site_id: null }));
    }
    const next = G.licenses.find((l) => l.id === v);
    if (next) {
      next.site_id = x.id;
      safely(dbUpdate("fl_licenses", next.id, { site_id: x.id }));
    }
    renderAllViews();
    renderDrawer();
  })));
  if (lic) {
    const acts = el("div", "msg-acts");
    if (lic.status !== "cancelada") acts.appendChild(button(lic.blocked ? "Desbloquear portal" : "Bloquear portal", () => setBlocked(lic, !lic.blocked), lic.blocked ? "btn-primary" : ""));
    acts.appendChild(button("Abrir suscripción", () => {
      goToView("licencias");
      openDrawer("license", lic.id);
    }));
    box.appendChild(acts);
  }

  const evs = G.events.filter((e) => e.site_id === x.id).sort((p, q) => String(q.at).localeCompare(String(p.at))).slice(0, 20);
  if (evs.length) {
    box.appendChild(el("h3", "", "Historial"));
    const ul = el("ul", "check-list");
    evs.forEach((ev) => {
      const li = document.createElement("li");
      li.appendChild(el("span", "tag " + (ev.kind === "down" ? "is-hot" : "is-good"), ev.kind === "down" ? "Se cayó" : "Volvió"));
      li.appendChild(el("span", "tx", whenShort(ev.at) + (ev.detail ? " · " + ev.detail : "")));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  const danger = el("div", "drawer-danger");
  danger.appendChild(button("Quitar web", async () => {
    if (!window.confirm('¿Dejar de vigilar "' + x.name + '" y borrar su historial?')) return;
    G.sites = G.sites.filter((o) => o.id !== x.id);
    G.events = G.events.filter((o) => o.site_id !== x.id);
    G.licenses.forEach((l) => {
      if (l.site_id === x.id) l.site_id = null;
    });
    closeDrawer();
    renderAllViews();
    await safely(dbDelete("fl_sites", x.id));
  }));
  box.appendChild(danger);
}

/* =========================================================
   LICENCIAS (CRM): licencias de uso de mis productos (Legajo)
   para notarías, centros de conciliación y otros clientes.
   Cada una lleva su forma de pago (contado o cuotas), su
   mantenimiento con vencimiento y el soporte por horas.
   ========================================================= */
const LIC_STATUS = [
  ["activa", "Activa"],
  ["suspendida", "Suspendida"],
  ["cancelada", "Cancelada"],
];
const MAINT_PERIODS = [
  ["mensual", "Mensual"],
  ["trimestral", "Trimestral"],
  ["anual", "Anual"],
];
const PERIOD_MONTHS = { mensual: 1, trimestral: 3, anual: 12 };
const PAY_CONCEPTS = [
  ["licencia", "Licencia"],
  ["mantenimiento", "Mantenimiento"],
  ["soporte", "Soporte"],
];
const CLIENT_KINDS = ["Notaría", "Centro de conciliación", "Empresa", "Entidad pública", "Persona"];
/* Tarifa sugerida: la hora de desarrollo de las cotizaciones (35.000 a
   37.000 COP); urgente o fuera de horario, 50 % más; mínimo una hora. */
const SUPPORT_DEFAULTS = { rate: 37000, urgentPct: 50, minHours: 1 };

const supportRates = () => Object.assign({}, SUPPORT_DEFAULTS, G.settings.soporte || {});
const dayStr = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dayYear = (s) => (s ? parseDay(s).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "—");
const licenseProducts = () => [...new Set(["Legajo"].concat(G.licenses.map((l) => l.product)).concat(siteGroups()).filter(Boolean))];

function addMonths(day, n) {
  const d = parseDay(day);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return dayStr(target);
}

/* Meses completos de a hasta b */
function monthsBetween(a, b) {
  const x = parseDay(a);
  const y = parseDay(b);
  return (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth()) - (y.getDate() < x.getDate() ? 1 : 0);
}

const licPaid = (l, concept) =>
  G.licPayments.filter((p) => p.license_id === l.id && (!concept || p.concept === concept)).reduce((n, p) => n + Number(p.amount), 0);

/* Licencia de uso: de contado o en cuotas mensuales desde la fecha de inicio */
function licenseFeeState(l) {
  if (isSub(l)) return { label: "Suscripción", cls: "", due: 0, balance: 0, paid: 0 };
  const price = Number(l.price) || 0;
  const paid = licPaid(l, "licencia");
  if (price <= 0) return { label: "Sin valor", cls: "", due: 0, balance: 0, paid };
  const balance = Math.max(0, price - paid);
  if (balance < 1) return { label: "Pagada", cls: "is-good", due: 0, balance: 0, paid };
  const n = Math.max(1, Number(l.installments) || 1);
  const cuota = price / n;
  const started = daysUntil(l.start_date) <= 0;
  const dueCount = started ? Math.min(n, monthsBetween(l.start_date, todayStr()) + 1) : 0;
  const due = Math.max(0, Math.min(balance, cuota * dueCount - paid));
  const paidCount = Math.min(n, Math.floor(paid / cuota + 1e-6));
  const next = paidCount < n ? addMonths(l.start_date, paidCount) : null;
  const base = { due: due < 1 ? 0 : due, balance, paid, cuota, n, paidCount, next };
  if (due >= 1) return Object.assign(base, { label: n === 1 ? "Por pagar" : "Cuota vencida", cls: "is-hot" });
  if (n === 1) return Object.assign(base, { label: "Pago el " + shortDate(l.start_date), cls: "is-warn" });
  return Object.assign(base, { label: "Al día · " + paidCount + " de " + n, cls: "is-violet" });
}

/* Mantenimiento: maint_until es la fecha hasta la que está pagado */
function maintState(l) {
  const fee = Number(l.maint_fee) || 0;
  if (fee <= 0) return { label: isSub(l) ? "Sin valor" : "Sin mantenimiento", cls: "", due: 0 };
  if (!l.maint_until) return { label: "Sin fecha", cls: "is-warn", due: 0 };
  const d = daysUntil(l.maint_until);
  if (d < 0) {
    const months = PERIOD_MONTHS[l.maint_period] || 12;
    const owed = Math.floor(monthsBetween(l.maint_until, todayStr()) / months) + 1;
    return { label: (isSub(l) ? "Vencida hace " : "Vencido hace ") + -d + " d", cls: "is-hot", due: owed * fee, owed, days: d };
  }
  if (d <= 30) return { label: d === 0 ? "Vence hoy" : "Vence en " + d + " d", cls: "is-warn", due: 0, days: d };
  return { label: "Hasta " + dayYear(l.maint_until), cls: "is-good", due: 0, days: d };
}

const supportDue = (l) => G.support.filter((s) => s.license_id === l.id && !s.covered && !s.paid_on).reduce((n, s) => n + Number(s.charge), 0);

/* Lo que se puede cobrar hoy. Una licencia cancelada ya no genera mantenimiento. */
function licenseDue(l) {
  const maint = l.status === "cancelada" ? 0 : maintState(l).due;
  return licenseFeeState(l).due + maint + supportDue(l);
}

const coveredOn = (l, day) => Number(l.maint_fee) > 0 && !!l.maint_until && day <= l.maint_until && l.status !== "cancelada";

function supportCharge(hours, urgent, covered) {
  if (covered) return 0;
  const r = supportRates();
  return Math.round(Math.max(Number(hours) || 0, r.minHours) * r.rate * (urgent ? 1 + r.urgentPct / 100 : 1));
}

function feeDetail(l, f) {
  if (!(Number(l.price) > 0)) return "Pon el valor de la licencia";
  if (!f.balance) return money(l.price) + " pagados";
  const parts = [];
  if (f.due) parts.push("Debe " + money(f.due));
  else if (f.next && f.n > 1) parts.push("Próxima " + shortDate(f.next) + ": " + money(Math.min(f.cuota, f.balance)));
  parts.push("Saldo " + money(f.balance));
  return parts.join(" · ");
}

function maintDetail(l, m) {
  if (!(Number(l.maint_fee) > 0)) return "Pon el valor por periodo";
  if (!l.maint_until) return "Pon hasta cuándo está pagado";
  if (m.due) return "Debe " + (m.owed > 1 ? m.owed + " periodos: " : "") + money(m.due);
  return "Pagado hasta " + longDate(l.maint_until);
}

/* Correo de cobro con lo pendiente, para revisar y enviar desde tu correo */
function reminderHref(l, client) {
  const f = licenseFeeState(l);
  const m = maintState(l);
  const sup = supportDue(l);
  const lines = ["Hola" + (client.contact ? " " + client.contact : "") + ",", "", "Te comparto el estado de " + (l.product || "la licencia") + " para " + client.name + ":", ""];
  if (f.due) lines.push("- Licencia de uso" + (f.n > 1 ? " (cuotas vencidas)" : "") + ": " + money(f.due));
  const what = isSub(l) ? "Suscripción (" + modulesText(l) + ")" : "Mantenimiento";
  if (m.due) lines.push("- " + what + ": venció el " + longDate(l.maint_until) + ". Valor: " + money(m.due));
  else if (m.cls === "is-warn" && l.maint_until) lines.push("- " + what + ": vence el " + longDate(l.maint_until) + ". Valor: " + money(l.maint_fee));
  if (sup) lines.push("- Soporte y arreglos: " + money(sup));
  const total = licenseDue(l) || (m.cls === "is-warn" ? Number(l.maint_fee) || 0 : 0);
  lines.push("", "Total: " + money(total), "", "Quedo atento a cualquier duda.", "", "Andrés Madrid · AM Developer");
  return "mailto:" + client.email + "?subject=" + encodeURIComponent((l.product || "Licencia") + " · " + client.name + " · estado de pagos") + "&body=" + encodeURIComponent(lines.join("\n"));
}

async function saveSetting(key, value) {
  G.settings[key] = value;
  const sb = await getSupabase();
  await safely(
    sb
      .from("fl_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) throw error;
      })
  );
}

async function newLicense(preset) {
  let clientId = preset && preset.client_id;
  if (!clientId) {
    const name = window.prompt("¿Para qué cliente? Escribe el nombre de la notaría, fundación o centro. Puedes dejarlo vacío y elegirlo después.");
    if (name === null) return;
    if (name.trim()) {
      let client = G.clients.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
      if (!client) {
        client = await safely(dbInsert("fl_clients", { name: name.trim() }));
        G.clients.push(client);
      }
      clientId = client.id;
    }
  }
  const row = await safely(dbInsert("fl_licenses", { client_id: clientId || null, product: G.licProduct || "Legajo" }));
  G.licenses.push(row);
  if (G.view !== "licencias") goToView("licencias");
  renderAllViews();
  openDrawer("license", row.id);
}

function ratesBox() {
  const r = supportRates();
  // Plegado una vez guardada la tarifa: abierta solo la primera vez
  const box = el("details", "rates-box");
  box.open = !G.settings.soporte;
  const summary = el("summary", "");
  summary.appendChild(el("h2", "", "Tarifa de soporte"));
  const current = el("span", "rates-now");
  summary.appendChild(current);
  box.appendChild(summary);
  box.appendChild(
    el("p", "", "Lo que cobras por hora para arreglar una falla del sistema. Con la suscripción o el mantenimiento al día el arreglo queda cubierto; si venció o no lo tiene, se cobra con esta tarifa.")
  );
  const row = el("div", "rates-row");
  const example = el("p", "rates-example");
  const paint = () => {
    const v = supportRates();
    current.textContent = money(v.rate) + " por hora · urgente +" + v.urgentPct + " %";
    example.textContent =
      "Ejemplo: 2 h normales = " + money(2 * v.rate) + " · 2 h urgentes = " + money(2 * v.rate * (1 + v.urgentPct / 100)) + " · mínimo " + v.minHours + " h por arreglo.";
  };
  const put = (patch) => {
    saveSetting("soporte", Object.assign(supportRates(), patch));
    paint();
  };
  row.appendChild(field("Hora normal (COP)", textInput(r.rate, (v) => put({ rate: Math.max(0, Number(v) || 0) }), "number")));
  row.appendChild(field("Recargo urgente (%)", textInput(r.urgentPct, (v) => put({ urgentPct: Math.max(0, Number(v) || 0) }), "number")));
  row.appendChild(field("Mínimo de horas", textInput(r.minHours, (v) => put({ minHours: Math.max(0, Number(v) || 0) }), "number")));
  box.appendChild(row);
  paint();
  box.appendChild(example);
  return box;
}

/* ---------- Suscripciones: módulos, bloqueo del portal ---------- */
const MODULES = [
  ["conciliacion", "Conciliación"],
  ["insolvencia", "Insolvencia"],
];
const BILLING = [
  ["suscripcion", "Suscripción"],
  ["licencia", "Licencia de uso"],
];
const PERIOD_SHORT = { mensual: "mes", trimestral: "trimestre", anual: "año" };
const isSub = (l) => (l.billing || "suscripcion") === "suscripcion";
const modulesText = (l) => (l.modules || []).map((k) => (MODULES.find(([m]) => m === k) || [k, k])[1]).join(" + ") || "Sin módulos";
const payConcepts = (l) => (isSub(l) ? [["mantenimiento", "Suscripción"], ["soporte", "Soporte"]] : PAY_CONCEPTS);

function planText(l) {
  const fee = Number(l.maint_fee) || 0;
  const per = fee ? money(fee) + " / " + (PERIOD_SHORT[l.maint_period] || "periodo") : "sin valor";
  return isSub(l) ? modulesText(l) + " · " + per : "Licencia de uso" + (fee ? " · mant. " + per : "");
}

/* El portal del cliente consulta /api/estado con su clave: bloqueado, muestra el aviso */
async function setBlocked(l, blocked) {
  const who = clientName(l.client_id);
  const ask = blocked
    ? "¿Bloquear el portal de " + who + "?\n\nMonitor y admin verán Falta de pago a pantalla completa, sin poder cerrarlo. admin_am verá solo una advertencia. Los procesos y los demás usuarios siguen funcionando."
    : "¿Desbloquear el portal de " + who + "?";
  if (!window.confirm(ask)) return;
  const patch = { blocked, blocked_at: blocked ? new Date().toISOString() : null };
  Object.assign(l, patch);
  renderAllViews();
  if (G.drawer) renderDrawer();
  await safely(dbUpdate("fl_licenses", l.id, patch));
  toast(blocked ? "Portal de " + who + " bloqueado." : "Portal de " + who + " desbloqueado.", blocked ? "is-bad" : "is-good");
}

function portalTag(l) {
  if (l.status === "cancelada") return ["Cancelada", ""];
  if (l.blocked) return ["Bloqueado", "is-hot"];
  return ["Activo", "is-good"];
}

/* Código que va en el portal del cliente (Legajo), una vez. Bloqueado:
   monitor y admin ven "Falta de pago" a pantalla completa, sin poder
   cerrarlo; admin_am ve una advertencia que sí se cierra. Los demás
   usuarios y los procesos del portal siguen funcionando. Si este
   servidor no responde, no pasa nada. */
const PORTAL_BLOCKED_ROLES = ["monitor", "admin"];
const PORTAL_WARN_ONLY = ["admin_am"];

function portalSnippet(l) {
  return `// Suscripción de Legajo · AM Developer
// Pega esto una vez en el portal y llama, después de iniciar sesión:
//   amRevisarSuscripcion({ rol: usuario.rol, usuario: usuario.nombre });
// y al cerrar sesión: amRevisarSuscripcion(null);
// Bloqueado: monitor y admin ven "Falta de pago" a pantalla completa y no pueden cerrarlo.
// admin_am solo ve una advertencia. Los demás usuarios y los procesos siguen funcionando.
(function () {
  var URL_ESTADO = "${location.origin}/api/estado?key=${l.access_key}";
  var BLOQUEA = ${JSON.stringify(PORTAL_BLOCKED_ROLES)};
  var SOLO_AVISO = ${JSON.stringify(PORTAL_WARN_ONLY)};
  var NOTA = "Los procesos del portal y los demás usuarios siguen funcionando.";
  var sesion = null, capa = null, bloqueo = false, vigia = null, reloj = null, avisoCerrado = false;

  function quitar() {
    bloqueo = false;
    if (vigia) vigia.disconnect();
    vigia = null;
    if (capa) capa.remove();
    capa = null;
  }

  function texto(tag, txt, css) {
    var n = document.createElement(tag);
    n.textContent = txt;
    if (css) n.style.cssText = css;
    return n;
  }

  // Monitor y admin: pantalla completa, sin botón de cerrar
  function bloquear(s) {
    quitar();
    bloqueo = true;
    capa = document.createElement("div");
    capa.setAttribute("role", "alertdialog");
    capa.setAttribute("aria-modal", "true");
    capa.setAttribute("aria-label", "Falta de pago");
    capa.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;background:#0b0b0b;color:#fff;font:16px/1.5 system-ui,sans-serif;text-align:center";
    capa.appendChild(texto("strong", "Falta de pago", "font-size:30px;color:#ff6b6b"));
    capa.appendChild(texto("p", s.message, "max-width:560px;margin:0"));
    capa.appendChild(texto("p", NOTA, "max-width:560px;margin:0;font-size:14px;opacity:.7"));
    document.body.appendChild(capa);
    // Si alguien lo quita de la página, vuelve a aparecer
    vigia = new MutationObserver(function () {
      if (bloqueo && capa && !capa.isConnected) document.body.appendChild(capa);
    });
    vigia.observe(document.body, { childList: true });
  }

  // admin_am: advertencia arriba, se puede cerrar
  function advertir(s) {
    quitar();
    if (avisoCerrado) return;
    capa = document.createElement("div");
    capa.setAttribute("role", "alert");
    capa.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 16px;background:#7a0f0f;color:#fff;font:14px/1.4 system-ui,sans-serif";
    capa.appendChild(texto("span", "Advertencia: falta de pago. Monitor y admin ven el portal bloqueado. " + NOTA, "flex:1 1 280px"));
    var cerrar = texto("button", "Entendido", "padding:6px 12px;border:1px solid #fff;border-radius:6px;background:transparent;color:#fff;cursor:pointer");
    cerrar.type = "button";
    cerrar.onclick = function () {
      avisoCerrado = true;
      quitar();
    };
    capa.appendChild(cerrar);
    document.body.appendChild(capa);
  }

  // Con el bloqueo puesto, el teclado no llega al portal (Escape, Tab, atajos)
  document.addEventListener("keydown", function (e) {
    if (!bloqueo) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  function revisar() {
    if (!sesion) return quitar();
    fetch(URL_ESTADO)
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (!s.ok || s.active) return quitar();
        var rol = String(sesion.rol || "").toLowerCase();
        var usuario = String(sesion.usuario || "").toLowerCase();
        if (SOLO_AVISO.indexOf(rol) >= 0 || SOLO_AVISO.indexOf(usuario) >= 0) return advertir(s);
        if (BLOQUEA.indexOf(rol) >= 0) return bloquear(s);
        quitar();
      })
      .catch(function () {});
  }

  window.amRevisarSuscripcion = function (datos) {
    sesion = datos || null;
    avisoCerrado = false;
    clearInterval(reloj);
    revisar();
    // Cada 5 minutos: si pagan y lo desbloqueas, el aviso se va solo
    if (sesion) reloj = setInterval(revisar, 300000);
  };
})();`;
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done, "is-good");
  } catch (e) {
    window.prompt("Copia el texto:", text);
  }
}

function renderLicenses() {
  const root = document.getElementById("view-licencias");
  root.innerHTML = "";
  const head = el("div", "view-head");
  head.appendChild(el("h1", "view-title", "Suscripciones"));
  head.appendChild(button("+ Suscripción", () => newLicense(), "btn-primary"));
  root.appendChild(head);
  root.appendChild(
    el(
      "p",
      "view-note",
      "Legajo por suscripción en Conciliación e Insolvencia, y licencias de uso. Por cobrar suma periodos vencidos, cuotas vencidas y arreglos sin pagar. Desde aquí bloqueas o desbloqueas el portal de cada cliente."
    )
  );

  const products = [...new Set(G.licenses.map((l) => l.product || "Legajo"))].sort((a, b) => a.localeCompare(b));
  if (G.licProduct && !products.includes(G.licProduct)) G.licProduct = "";
  const filters = el("div", "inbox-filters");
  const chip = (key, label, onPick, on) => {
    const b = button(label, onPick);
    b.classList.toggle("is-on", on);
    filters.appendChild(b);
  };
  const pick = (k) => () => {
    G.licFilter = k;
    renderLicenses();
  };
  const f = G.licFilter || "";
  chip("", "Todas", pick(""), !f);
  MODULES.forEach(([k, label]) => chip(k, label, pick(k), f === k));
  chip("vencidas", "Vencidas", pick("vencidas"), f === "vencidas");
  chip("bloqueadas", "Bloqueadas", pick("bloqueadas"), f === "bloqueadas");
  if (products.length > 1) {
    products.forEach((p) =>
      chip(p, p, () => {
        G.licProduct = G.licProduct === p ? "" : p;
        renderLicenses();
      }, G.licProduct === p)
    );
  }
  root.appendChild(filters);

  const all = G.licenses.filter((l) => !G.licProduct || (l.product || "Legajo") === G.licProduct);
  const list = all.filter((l) => {
    if (!f) return true;
    if (f === "vencidas") return maintState(l).cls === "is-hot" || licenseFeeState(l).cls === "is-hot";
    if (f === "bloqueadas") return !!l.blocked;
    return (l.modules || []).includes(f);
  });

  const due = all.reduce((n, l) => n + licenseDue(l), 0);
  const late = all.filter((l) => l.status !== "cancelada" && maintState(l).cls === "is-hot").length;
  const blocked = all.filter((l) => l.blocked).length;
  const stats = el("div", "stat-row");
  const stat = (label, value, cls) => {
    const s = el("div", "stat" + (cls ? " " + cls : ""));
    s.appendChild(el("span", "", label));
    s.appendChild(el("strong", "", value));
    stats.appendChild(s);
  };
  stat("Activas", String(all.filter((l) => l.status === "activa" && !l.blocked).length));
  stat("Por cobrar hoy", money(due), due ? "is-hot" : "");
  stat("Vencidas", String(late), late ? "is-hot" : "");
  stat("Portales bloqueados", String(blocked), blocked ? "is-warn" : "");
  root.appendChild(stats);
  root.appendChild(ratesBox());

  const wrap = el("div", "table-wrap");
  if (!list.length) {
    wrap.appendChild(el("p", "empty", all.length ? "Nada con este filtro." : "Todavía no hay suscripciones. Crea una por cada notaría, fundación o centro que use Legajo."));
    return root.appendChild(wrap);
  }
  const table = el("table", "tbl");
  table.appendChild(tableHead(["Cliente", "Plan", "Pago", "Portal", "Sitio", "Por cobrar", ""]));
  const tb = document.createElement("tbody");
  list
    .slice()
    .sort((a, b) => licenseDue(b) - licenseDue(a) || (maintState(a).days ?? 9999) - (maintState(b).days ?? 9999) || clientName(a.client_id).localeCompare(clientName(b.client_id)))
    .forEach((l) => {
      const tr = el("tr", "is-link" + (l.status === "cancelada" ? " is-off" : "") + (l.blocked ? " is-blocked" : ""));
      const c1 = el("td");
      c1.appendChild(el("strong", "", clientName(l.client_id)));
      const client = clientOf(l.client_id);
      if (client && client.kind) c1.appendChild(el("span", "lic-client", client.kind));
      tr.appendChild(c1);
      tr.appendChild(el("td", "", planText(l)));
      const c3 = el("td");
      const m = maintState(l);
      if (!isSub(l)) {
        const fee = licenseFeeState(l);
        c3.appendChild(el("span", "tag " + fee.cls, fee.label));
        c3.appendChild(document.createTextNode(" "));
      }
      c3.appendChild(el("span", "tag " + m.cls, m.label));
      tr.appendChild(c3);
      const pt = portalTag(l);
      const c4 = el("td");
      c4.appendChild(el("span", "tag " + pt[1], pt[0]));
      tr.appendChild(c4);
      const site = G.sites.find((s) => s.id === l.site_id);
      const c5 = el("td");
      if (site) {
        const st = SITE_STATUS[site.status] || SITE_STATUS.unknown;
        c5.appendChild(el("span", "tag " + st[1], st[0]));
      } else c5.textContent = "—";
      tr.appendChild(c5);
      const d = licenseDue(l);
      tr.appendChild(el("td", "num" + (d ? " is-due" : ""), d ? money(d) : "—"));
      const c7 = el("td", "num");
      if (l.status !== "cancelada") {
        const b = button(l.blocked ? "Desbloquear" : "Bloquear", (e) => {
          e.stopPropagation();
          setBlocked(l, !l.blocked);
        }, l.blocked ? "btn-primary" : "");
        c7.appendChild(b);
      }
      tr.appendChild(c7);
      tr.addEventListener("click", () => openDrawer("license", l.id));
      tb.appendChild(tr);
    });
  table.appendChild(tb);
  wrap.appendChild(table);
  root.appendChild(wrap);
}

async function addLicPayment(l, concept, amount, day) {
  amount = Math.round(Number(amount) || 0);
  if (amount <= 0) return toast("Pon un valor mayor que cero.", "is-bad");
  const row = await safely(dbInsert("fl_license_payments", { license_id: l.id, concept, amount, paid_on: day || todayStr() }));
  G.licPayments.push(row);
  // Cada periodo pagado corre la fecha de vencimiento del mantenimiento
  if (concept === "mantenimiento" && Number(l.maint_fee) > 0) {
    const periods = Math.floor(amount / Number(l.maint_fee) + 1e-6);
    if (periods > 0) {
      const until = addMonths(l.maint_until || l.start_date || day, periods * (PERIOD_MONTHS[l.maint_period] || 12));
      l.maint_until = until;
      await safely(dbUpdate("fl_licenses", l.id, { maint_until: until }));
      toast("Mantenimiento pagado hasta el " + longDate(until) + ".", "is-good");
    } else toast("El valor no completa un periodo: la fecha de mantenimiento no cambió.", "is-info");
  }
  // Un pago de soporte salda los arreglos pendientes, del más viejo al más nuevo
  if (concept === "soporte") {
    let left = amount;
    const pending = G.support
      .filter((s) => s.license_id === l.id && !s.covered && !s.paid_on)
      .sort((a, b) => String(a.happened_on).localeCompare(String(b.happened_on)));
    for (const s of pending) {
      if (Number(s.charge) > left + 0.5) break;
      left -= Number(s.charge);
      s.paid_on = row.paid_on;
      await safely(dbUpdate("fl_support", s.id, { paid_on: row.paid_on }));
    }
  }
  renderAllViews();
  renderDrawer();
}

function defaultPayAmount(l, concept) {
  if (concept === "mantenimiento") return (Number(l.maint_fee) || 0) * Math.max(1, maintState(l).owed || 1);
  if (concept === "soporte") return supportDue(l);
  const f = licenseFeeState(l);
  return f.due || Math.min(f.cuota || 0, f.balance || 0);
}

async function markSupportPaid(l, s) {
  const day = todayStr();
  if (Number(s.charge) > 0) {
    const pay = await safely(dbInsert("fl_license_payments", { license_id: l.id, concept: "soporte", amount: s.charge, paid_on: day, note: String(s.description).slice(0, 120) }));
    G.licPayments.push(pay);
  }
  s.paid_on = day;
  await safely(dbUpdate("fl_support", s.id, { paid_on: day }));
  renderAllViews();
  renderDrawer();
}

function licenseDrawer(box) {
  const l = G.licenses.find((x) => x.id === G.drawer.id);
  if (!l) return closeDrawer();
  const sub = isSub(l);
  drawerTop(box, (l.product || "Legajo") + " · " + (sub ? "suscripción" : "licencia de uso"));
  const sum = el("div", "lic-sum");
  // Los campos de texto solo repintan el resumen: repintar todo movería el foco
  const save = (patch, redraw) => {
    Object.assign(l, patch);
    renderAllViews();
    if (redraw) renderDrawer();
    else paintSum();
    safely(dbUpdate("fl_licenses", l.id, patch));
  };
  const paintSum = () => {
    sum.innerHTML = "";
    const line = (label, tagText, cls, detail) => {
      const r = el("div", "lic-line");
      r.appendChild(el("span", "lic-k", label));
      const v = el("span", "lic-v");
      if (tagText) v.appendChild(el("span", "tag " + (cls || ""), tagText));
      if (detail) v.appendChild(el("span", "lic-d", detail));
      r.appendChild(v);
      sum.appendChild(r);
    };
    const m = maintState(l);
    const sup = supportDue(l);
    if (!sub) {
      const f = licenseFeeState(l);
      line("Licencia", f.label, f.cls, feeDetail(l, f));
    }
    line(sub ? "Suscripción" : "Mantenimiento", m.label, m.cls, maintDetail(l, m));
    line("Soporte", sup ? "Por cobrar" : "Al día", sup ? "is-hot" : "is-good", sup ? money(sup) : "");
    const site = G.sites.find((s) => s.id === l.site_id);
    if (site) {
      const st = SITE_STATUS[site.status] || SITE_STATUS.unknown;
      line("Sitio", st[0], st[1], hostOf(site.url));
    }
    const due = licenseDue(l);
    const total = el("div", "lic-total" + (due ? " is-due" : ""));
    total.appendChild(el("span", "", "Por cobrar hoy"));
    total.appendChild(el("strong", "", money(due)));
    sum.appendChild(total);
  };

  box.appendChild(el("h3", "msg-subject", clientName(l.client_id)));

  // Bloqueo del portal, arriba: es lo que se usa cuando no pagan
  const pt = portalTag(l);
  const bar = el("div", "lic-block" + (l.blocked ? " is-blocked" : ""));
  const info = el("span", "lic-block-text");
  info.appendChild(el("span", "tag " + pt[1], "Portal " + pt[0].toLowerCase()));
  if (l.blocked && l.blocked_at) info.appendChild(el("span", "", "desde " + whenShort(l.blocked_at)));
  bar.appendChild(info);
  if (l.status !== "cancelada") bar.appendChild(button(l.blocked ? "Desbloquear portal" : "Bloquear portal", () => setBlocked(l, !l.blocked), l.blocked ? "btn-primary" : ""));
  box.appendChild(bar);
  if (l.blocked) {
    box.appendChild(field("Mensaje que ve el cliente", textArea(l.block_note, (v) => save({ block_note: v.trim() || null }), 2)));
  }

  paintSum();
  box.appendChild(sum);

  box.appendChild(field("Cliente", selectInput(clientOptions(), l.client_id, (v) => save({ client_id: v || null }, true))));
  const two = el("div", "two");
  two.appendChild(field("Modelo", selectInput(BILLING, l.billing || "suscripcion", (v) => save({ billing: v }, true))));
  two.appendChild(field("Estado", selectInput(LIC_STATUS, l.status, (v) => save({ status: v }, true))));
  box.appendChild(two);
  if (sub) {
    const mods = el("div", "lic-mods");
    mods.appendChild(el("span", "lic-k", "Módulos"));
    MODULES.forEach(([k, label]) => {
      mods.appendChild(checkField(label, (l.modules || []).includes(k), (on) => {
        const next = MODULES.map(([m]) => m).filter((m) => (m === k ? on : (l.modules || []).includes(m)));
        save({ modules: next });
      }));
    });
    box.appendChild(mods);
  }
  const two2 = el("div", "two");
  const prod = textInput(l.product, (v) => save({ product: v.trim() || "Legajo" }));
  const prodField = field("Producto", prod);
  prodField.appendChild(attachList(prod, licenseProducts()));
  two2.appendChild(prodField);
  const siteOpts = [["", "Sin sitio"]].concat(
    G.sites
      .slice()
      .sort((a, b) => String(a.grp || "").localeCompare(String(b.grp || "")) || a.name.localeCompare(b.name))
      .map((s) => [s.id, (s.grp ? s.grp + " / " : "") + s.name])
  );
  two2.appendChild(field("Sitio vigilado", selectInput(siteOpts, l.site_id, (v) => save({ site_id: v || null }, true))));
  box.appendChild(two2);

  if (!sub) {
    box.appendChild(el("h3", "", "Licencia de uso"));
    const t1 = el("div", "two");
    t1.appendChild(field("Valor total (COP)", textInput(l.price, (v) => save({ price: Math.max(0, Number(v) || 0) }), "number")));
    t1.appendChild(field("Cuotas mensuales", textInput(l.installments, (v) => save({ installments: Math.min(60, Math.max(1, Math.round(Number(v) || 1))) }), "number")));
    t1.appendChild(field("Fecha de inicio", textInput(l.start_date, (v) => v && save({ start_date: v }), "date")));
    box.appendChild(t1);
    box.appendChild(el("p", "pay-sum", "1 cuota es de contado. Con más, la primera se paga en la fecha de inicio y las demás cada mes."));
  }

  box.appendChild(el("h3", "", sub ? "Suscripción" : "Mantenimiento"));
  const t2 = el("div", "two");
  t2.appendChild(field("Valor por periodo (COP)", textInput(l.maint_fee, (v) => save({ maint_fee: Math.max(0, Number(v) || 0) }), "number")));
  t2.appendChild(field("Periodo", selectInput(MAINT_PERIODS, l.maint_period, (v) => save({ maint_period: v }))));
  if (sub) t2.appendChild(field("Inicio", textInput(l.start_date, (v) => v && save({ start_date: v }), "date")));
  t2.appendChild(field("Pagado hasta", textInput(l.maint_until, (v) => save({ maint_until: v || null }), "date")));
  box.appendChild(t2);
  box.appendChild(button("Registrar pago de un periodo", () => {
    if (!(Number(l.maint_fee) > 0)) return toast("Primero pon el valor por periodo.", "is-bad");
    addLicPayment(l, "mantenimiento", Number(l.maint_fee), todayStr());
  }));

  // ----- Soporte -----
  box.appendChild(el("h3", "", "Soporte y arreglos"));
  const incidents = G.support.filter((s) => s.license_id === l.id).sort((a, b) => String(b.happened_on).localeCompare(String(a.happened_on)));
  if (incidents.length) {
    const ul = el("ul", "check-list");
    incidents.forEach((s) => {
      const li = document.createElement("li");
      const hrs = String(Number(s.hours)).replace(".", ",") + " h" + (s.urgent ? " urgente" : "");
      li.appendChild(el("span", "tx", shortDate(s.happened_on) + " · " + s.description + " · " + hrs));
      const tag = s.covered ? ["Cubierto", "is-good"] : s.paid_on ? ["Cobrado", "is-violet"] : ["Por cobrar " + money(s.charge), "is-hot"];
      li.appendChild(el("span", "tag " + tag[1], tag[0]));
      if (!s.covered && !s.paid_on) li.appendChild(button("Cobrado", () => markSupportPaid(l, s)));
      const x = el("button", "x", "×");
      x.type = "button";
      x.setAttribute("aria-label", "Borrar arreglo");
      x.addEventListener("click", async () => {
        if (!window.confirm("¿Borrar este arreglo?")) return;
        G.support = G.support.filter((o) => o.id !== s.id);
        renderAllViews();
        renderDrawer();
        await safely(dbDelete("fl_support", s.id));
      });
      li.appendChild(x);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  const supBox = el("div", "mini-add");
  const desc = textInput("", () => {});
  desc.placeholder = "Qué se arregló";
  desc.setAttribute("aria-label", "Qué se arregló");
  const hours = textInput("", () => {}, "number");
  hours.placeholder = "Horas";
  hours.step = "0.5";
  hours.min = "0";
  hours.setAttribute("aria-label", "Horas");
  const day = textInput(todayStr(), () => {}, "date");
  day.setAttribute("aria-label", "Fecha del arreglo");
  let urgent = false;
  let covered = coveredOn(l, todayStr());
  const preview = el("span", "note");
  const paintPreview = () => {
    preview.textContent = covered ? "Cubierto: no se cobra." : "Valor: " + money(supportCharge(hours.value, urgent, false));
  };
  const coveredBox = checkField(sub ? "Cubierto por la suscripción" : "Cubierto por el mantenimiento", covered, (v) => {
    covered = v;
    paintPreview();
  });
  hours.addEventListener("input", paintPreview);
  day.addEventListener("change", () => {
    covered = coveredOn(l, day.value);
    coveredBox.querySelector("input").checked = covered;
    paintPreview();
  });
  const r1 = el("div", "row");
  r1.appendChild(desc);
  supBox.appendChild(r1);
  const r2 = el("div", "row");
  r2.appendChild(hours);
  r2.appendChild(day);
  supBox.appendChild(r2);
  supBox.appendChild(checkField("Urgente o fuera de horario", false, (v) => {
    urgent = v;
    paintPreview();
  }));
  supBox.appendChild(coveredBox);
  paintPreview();
  supBox.appendChild(preview);
  supBox.appendChild(button("Agregar arreglo", async () => {
    const h = Number(hours.value);
    if (!desc.value.trim()) return desc.focus();
    if (!(h > 0)) return hours.focus();
    const r = supportRates();
    const row = await safely(
      dbInsert("fl_support", {
        license_id: l.id,
        happened_on: day.value || todayStr(),
        description: desc.value.trim(),
        hours: h,
        rate: Math.round(r.rate * (urgent ? 1 + r.urgentPct / 100 : 1)),
        urgent,
        covered,
        charge: supportCharge(h, urgent, covered),
      })
    );
    G.support.push(row);
    renderAllViews();
    renderDrawer();
  }));
  box.appendChild(supBox);

  // ----- Pagos -----
  const concepts = payConcepts(l);
  box.appendChild(el("h3", "", "Pagos"));
  box.appendChild(el("p", "pay-sum", "Cobrado en total: " + money(licPaid(l))));
  const pays = G.licPayments.filter((p) => p.license_id === l.id).sort((a, b) => String(b.paid_on).localeCompare(String(a.paid_on)));
  if (pays.length) {
    const ul = el("ul", "check-list");
    pays.forEach((p) => {
      const li = document.createElement("li");
      li.appendChild(el("span", "tx", dayYear(p.paid_on) + " · " + money(p.amount) + (p.note ? " · " + p.note : "")));
      li.appendChild(el("span", "tag", (concepts.find(([k]) => k === p.concept) || PAY_CONCEPTS.find(([k]) => k === p.concept) || ["", p.concept])[1]));
      const x = el("button", "x", "×");
      x.type = "button";
      x.setAttribute("aria-label", "Borrar pago");
      x.addEventListener("click", async () => {
        if (!window.confirm("¿Borrar este pago? Si era de un periodo, revisa a mano la fecha Pagado hasta.")) return;
        G.licPayments = G.licPayments.filter((o) => o.id !== p.id);
        renderAllViews();
        renderDrawer();
        await safely(dbDelete("fl_license_payments", p.id));
      });
      li.appendChild(x);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  const pay = el("div", "mini-add");
  const amount = textInput(defaultPayAmount(l, concepts[0][0]) || "", () => {}, "number");
  amount.setAttribute("aria-label", "Valor del pago");
  const concept = selectInput(concepts, concepts[0][0], (v) => {
    amount.value = defaultPayAmount(l, v) || "";
  });
  concept.setAttribute("aria-label", "Concepto del pago");
  const payDay = textInput(todayStr(), () => {}, "date");
  payDay.setAttribute("aria-label", "Fecha del pago");
  const pr = el("div", "row");
  pr.appendChild(concept);
  pr.appendChild(amount);
  pr.appendChild(payDay);
  pay.appendChild(pr);
  pay.appendChild(button("Registrar pago", () => addLicPayment(l, concept.value, amount.value, payDay.value)));
  box.appendChild(pay);

  // ----- Conexión con el portal -----
  box.appendChild(el("h3", "", "Conexión con el portal"));
  if (l.access_key) {
    box.appendChild(
      el("p", "pay-sum", "Pega el código una vez en el portal de Legajo del cliente. Al bloquear, monitor y admin ven Falta de pago a pantalla completa, sin poder cerrarlo; admin_am ve una advertencia. Los procesos y los demás usuarios siguen funcionando.")
    );
    box.appendChild(el("code", "lic-key", l.access_key));
    const keyActs = el("div", "msg-acts");
    keyActs.appendChild(button("Copiar código para el portal", () => copyText(portalSnippet(l), "Código copiado.")));
    keyActs.appendChild(button("Copiar clave", () => copyText(l.access_key, "Clave copiada.")));
    box.appendChild(keyActs);
  } else {
    box.appendChild(el("p", "pay-sum", "Falta la clave: corre supabase/licencias.sql en Supabase y recarga el panel."));
  }

  box.appendChild(field("Notas", textArea(l.notes, (v) => save({ notes: v || null }), 3)));

  const acts = el("div", "msg-acts");
  const client = clientOf(l.client_id);
  if (client && client.email) {
    const a = el("a", "btn btn-primary", "Recordar por correo");
    a.href = reminderHref(l, client);
    acts.appendChild(a);
  }
  if (client) acts.appendChild(button("Ver cliente", () => openDrawer("client", client.id)));
  box.appendChild(acts);
  if (client && !client.email) box.appendChild(el("p", "pay-sum", "Pon el correo del cliente para enviarle recordatorios de pago."));

  const danger = el("div", "drawer-danger");
  danger.appendChild(button(sub ? "Borrar suscripción" : "Borrar licencia", async () => {
    if (!window.confirm("¿Borrar con sus pagos y arreglos? No se puede deshacer.")) return;
    G.licenses = G.licenses.filter((o) => o.id !== l.id);
    G.licPayments = G.licPayments.filter((o) => o.license_id !== l.id);
    G.support = G.support.filter((o) => o.license_id !== l.id);
    closeDrawer();
    renderAllViews();
    await safely(dbDelete("fl_licenses", l.id));
  }));
  box.appendChild(danger);
}

/* Trae las webs de los repos que tienen Website en GitHub */
async function importSites() {
  const have = new Set(G.sites.map((x) => x.url.replace(/\/+$/, "").toLowerCase()));
  const fresh = allRepos
    .map((r) => ({ name: r.name, url: safeUrl(r.homepage) }))
    .filter((r) => /^https?:/i.test(r.url) && !have.has(r.url.replace(/\/+$/, "").toLowerCase()));
  if (!fresh.length) return window.alert("No hay webs nuevas en tus repos de GitHub.");
  for (const r of fresh) G.sites.push(await safely(dbInsert("fl_sites", r)));
  renderAllViews();
}

async function refreshSites() {
  const sb = await getSupabase();
  const [a, b] = await Promise.all([sb.from("fl_sites").select("*"), sb.from("fl_site_events").select("*")]);
  if (!a.error) G.sites = a.data || [];
  if (!b.error) G.events = b.data || [];
  renderAllViews();
}

/* ---------- Avisos en vivo mientras el panel está abierto ----------
   Con el panel cerrado avisan el push (sw.js y api/_push.js) y el correo. */
function toast(text, kind) {
  const box = document.getElementById("toasts");
  const t = el("div", "toast " + (kind || ""), text);
  box.appendChild(t);
  setTimeout(() => t.remove(), 7000);
  try {
    // Con push activo el aviso ya llega por el servicio: no se repite
    if (!G.pushOn && G.swReg && window.Notification && Notification.permission === "granted" && document.visibilityState !== "visible") {
      G.swReg.showNotification("AM Developer", { body: text, icon: "amd.png", badge: "amd-badge.png" }).catch(() => {});
    }
  } catch (e) {}
}

/* ---------- App en la pantalla de inicio y avisos push ---------- */
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const canPushHere = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const IOS_INSTALL_TIP = "En Safari: botón Compartir, luego Añadir a inicio. Abre la app desde ese icono para activar los avisos.";

function paintInstallButton() {
  const b = document.getElementById("install-btn");
  b.hidden = isStandalone() || !(G.installEvent || isIos());
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  G.installEvent = e;
  paintInstallButton();
});
window.addEventListener("appinstalled", () => {
  G.installEvent = null;
  paintInstallButton();
});

function installApp() {
  if (!G.installEvent) return toast(IOS_INSTALL_TIP);
  G.installEvent.prompt();
  G.installEvent.userChoice.finally(() => {
    G.installEvent = null;
    paintInstallButton();
  });
}

function paintNotifyButton() {
  const b = document.getElementById("notify-btn");
  let state = "on";
  if (!canPushHere()) state = isIos() && !isStandalone() ? "ios" : "";
  else if (Notification.permission === "denied") state = "blocked";
  else if (G.pushOn) state = "test";
  b.hidden = !state;
  b.dataset.state = state;
  b.textContent = state === "test" ? "Probar aviso" : state === "blocked" ? "Avisos bloqueados" : "Activar avisos";
}

async function savePushSub(sub) {
  const j = sub.toJSON();
  const sb = await getSupabase();
  const { error } = await sb
    .from("fl_push_subs")
    .upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
  if (error) throw error;
}

async function enablePush() {
  if ((await Notification.requestPermission()) !== "granted") return paintNotifyButton();
  if (!G.swReg) return toast("No se pudo preparar este dispositivo. Recarga el panel.", "is-bad");
  const { key } = await (await fetch("/api/push")).json();
  if (!key) {
    paintNotifyButton();
    return toast("Faltan las claves VAPID en Vercel. Por ahora solo hay avisos con el panel abierto.", "is-bad");
  }
  // Una suscripción con otra clave no se puede reutilizar
  const old = await G.swReg.pushManager.getSubscription();
  if (old) await old.unsubscribe();
  const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
  const sub = await G.swReg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
  });
  await savePushSub(sub);
  G.pushOn = true;
  paintNotifyButton();
  toast("Avisos activos en este dispositivo.", "is-good");
}

async function testPush() {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  const r = await fetch("/api/push", {
    method: "POST",
    headers: { Authorization: "Bearer " + (data.session ? data.session.access_token : "") },
  });
  const out = await r.json().catch(() => ({}));
  if (out.ok) toast("Aviso enviado a " + out.sent + (out.sent === 1 ? " dispositivo." : " dispositivos."), "is-good");
  else toast("No salió: " + (out.error || "ningún dispositivo lo aceptó"), "is-bad");
}

async function onNotifyClick() {
  const b = document.getElementById("notify-btn");
  const state = b.dataset.state;
  if (state === "ios") return toast(IOS_INSTALL_TIP);
  if (state === "blocked") return toast("Están bloqueados. Actívalos en los ajustes del navegador o del dispositivo para este panel.", "is-bad");
  b.disabled = true;
  try {
    await (state === "test" ? testPush() : enablePush());
  } catch (e) {
    toast("No se pudieron activar los avisos: " + e.message, "is-bad");
  } finally {
    b.disabled = false;
  }
}

/* Registra el service worker y, si ya había permiso, renueva la suscripción */
async function startDevice() {
  if ("serviceWorker" in navigator) {
    G.swReg = await navigator.serviceWorker.register("/sw.js", { scope: "/admin" });
    if (canPushHere() && Notification.permission === "granted") {
      const sub = await G.swReg.pushManager.getSubscription();
      if (sub) {
        await savePushSub(sub);
        G.pushOn = true;
      }
    }
  }
}

/* Al cerrar sesión este dispositivo deja de recibir avisos */
async function pushOff() {
  if (!G.swReg) return;
  const sub = await G.swReg.pushManager.getSubscription();
  if (!sub) return;
  const sb = await getSupabase();
  await sb.from("fl_push_subs").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
  G.pushOn = false;
  paintNotifyButton();
}

async function startGestorLive() {
  paintInstallButton();
  paintNotifyButton();
  document.getElementById("install-btn").addEventListener("click", installApp);
  document.getElementById("notify-btn").addEventListener("click", onNotifyClick);
  startDevice()
    .catch((e) => console.error("Service worker:", e.message))
    .finally(paintNotifyButton);

  // En el celular la app pasa horas en segundo plano: al volver, datos frescos
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > 60000 && !G.drawer && !G.editing) {
      await gestorLoad();
      renderAllViews();
    }
  });

  const sb = await getSupabase();
  sb.channel("panel")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "fl_messages" }, (p) => {
      G.messages.push(p.new);
      const info = MOTIVE_INFO[p.new.motive] || MOTIVE_INFO.otro;
      toast("Nuevo mensaje · " + info[0] + " · " + p.new.name, "is-info");
      renderAllViews();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fl_sites" }, (p) => {
      const i = G.sites.findIndex((x) => x.id === p.new.id);
      const before = i >= 0 ? G.sites[i].status : null;
      if (i >= 0) G.sites[i] = p.new;
      if (before && before !== p.new.status && p.new.status === "down") toast(p.new.name + " está caída", "is-bad");
      if (before === "down" && p.new.status === "up") toast(p.new.name + " volvió", "is-good");
      renderAllViews();
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "fl_site_events" }, (p) => {
      G.events.push(p.new);
      if (G.view === "sitios") renderSites();
    })
    .subscribe();
}

/* ---------- Guía de formatos ---------- */
function renderFormats() {
  const root = document.getElementById("view-formatos");
  root.innerHTML = "";
  root.appendChild(el("h1", "view-title", "Formatos"));
  root.appendChild(el("p", "view-note", "Los documentos y correos que salen de aquí siempre tienen la misma forma. Esta es la guía."));
  const grid = el("div", "fmt-grid");
  const card = (title, intro, list, action) => {
    const c = el("div", "fmt-card");
    c.appendChild(el("h2", "", title));
    c.appendChild(el("p", "", intro));
    const ul = document.createElement("ul");
    list.forEach((l) => ul.appendChild(el("li", "", l)));
    c.appendChild(ul);
    if (action) c.appendChild(action);
    grid.appendChild(c);
  };
  card(
    "Cotización por horas",
    "Para software a la medida o trabajo ya hecho. El valor sale de horas × tarifa.",
    ["Encabezado, datos, perfil, tecnologías y formación", "1. Qué se cotiza · 2. Qué se entrega · Evidencia (opcional)", "Horas por área · Tarifa y cálculo", "Valor propuesto, en cifras y en letras", "Condiciones: qué incluye, forma de pago, notas legales", "Firmas"],
    button("Nueva por horas", () => newQuote("horas"), "btn-primary")
  );
  card(
    "Cotización a precio fijo",
    "Para trabajos cerrados: una web, un ajuste, un paquete. El valor es la suma de los conceptos.",
    ["La misma hoja, sin horas ni tarifa", "Detalle y valor: concepto + valor", "Valor propuesto, condiciones y firmas"],
    button("Nueva a precio fijo", () => newQuote("fijo"))
  );
  card(
    "Numeración",
    "AM-AÑO-NNN, consecutivo por año. El gestor propone el siguiente y la base de datos no deja repetir.",
    ["La siguiente: " + nextQuoteNumber(), "Las hechas a mano llegan hasta la 006 de 2026", "PDF: Cotizacion-AM-2026-007-Cliente.pdf"]
  );
  card(
    "Correo desde la web",
    "El formulario de Contacto pide un motivo. El correo te llega con el motivo en el asunto y su ficha.",
    ["[Cotización] rojo: solo el mensaje", "[Colaboración] verde: en qué y enlace", "[Empleo] morado: empresa y vacante", "[Contacto] gris: solo el mensaje", "[CAÍDA] rojo y [RESUELTO] verde: avisos del monitor", "Responder le contesta directo a quien escribió"]
  );
  card(
    "Suscripciones y licencias",
    "Cómo se calcula lo que se cobra en Suscripciones.",
    [
      "Legajo por suscripción: módulos Conciliación e Insolvencia, valor por periodo",
      "Cada pago de un periodo corre la fecha Pagado hasta",
      "Sin pago, Bloquear portal: el portal del cliente muestra el aviso de suspensión",
      "Licencia de uso: de contado o en cuotas mensuales, con mantenimiento aparte",
      "Arreglos: horas × tarifa de soporte, con mínimo de horas",
      "Urgente o fuera de horario: recargo de la tarifa",
      "Con mantenimiento vigente el arreglo queda cubierto",
      "Recordar por correo arma el mensaje con lo que se debe",
    ],
    button("Ir a Suscripciones", () => goToView("licencias"))
  );
  root.appendChild(grid);
}

/* ---------- Estructura ---------- */
function showView(name) {
  G.view = name;
  document.querySelectorAll("#side-nav .side-link, #tabbar [data-view]").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name));
  document.getElementById("tab-menu").classList.toggle("is-active", !document.querySelector('#tabbar [data-view="' + name + '"]'));
  document.querySelectorAll(".shell-main > .view").forEach((v) => (v.hidden = v.id !== "view-" + name));
  if (!["proyectos", "clientes", "bandeja", "licencias", "sitios"].includes(name)) closeDrawerQuiet();
  try {
    history.replaceState(null, "", "#" + name);
  } catch (e) {}
  renderAllViews();
  window.scrollTo(0, 0);
}

function renderAllViews() {
  paintSide();
  if (G.view === "proyectos") renderProjects();
  // Un aviso en vivo no debe repintar el editor ni un formulario a medio escribir
  const editorOpen = G.editing && document.querySelector("#view-presupuestos .q-editor");
  if (G.view === "presupuestos" && !editorOpen) renderQuotes();
  if (G.view === "entregas") renderDeliveries();
  if (G.view === "clientes") renderClients();
  if (G.view === "formatos") renderFormats();
  if (G.view === "bandeja") renderInbox();
  const active = document.activeElement;
  // Un aviso en vivo no repinta una vista mientras escribes en ella
  const typingIn = (id) => active && active.matches("input:not([type=checkbox]), textarea, select") && document.getElementById(id).contains(active);
  if (G.view === "sitios" && !typingIn("view-sitios")) renderSites();
  if (G.view === "licencias" && !typingIn("view-licencias")) renderLicenses();
}

const PANEL_VIEWS = ["proyectos", "bandeja", "presupuestos", "licencias", "entregas", "clientes", "sitios", "formatos", "web"];

function goToView(name) {
  if (name !== "presupuestos" && G.editing) {
    G.editing = null;
    clearQuoteView();
  }
  setMenu(false);
  showView(name);
}

/* En tablets y celulares la barra lateral es un menú que entra por un lado */
const compactLayout = window.matchMedia("(max-width: 820px)");

function setMenu(open) {
  document.getElementById("app-shell").classList.toggle("is-menu-open", open);
  document.getElementById("side-scrim").hidden = !open;
  document.getElementById("tab-menu").setAttribute("aria-expanded", String(open));
  document.querySelector(".side").inert = compactLayout.matches && !open;
}

/* Las tablas se vuelven tarjetas en el celular: cada dato lleva el título de su columna */
function labelTables() {
  document.querySelectorAll(".shell-main .tbl").forEach((table) => {
    const heads = Array.from(table.querySelectorAll("thead th"), (th) => th.textContent);
    table.querySelectorAll("tr").forEach((tr) => {
      Array.from(tr.children).forEach((cell, i) => {
        if (cell.tagName === "TD" && cell.dataset.label !== (heads[i] || "")) cell.dataset.label = heads[i] || "";
      });
    });
  });
}

function initShell() {
  document.getElementById("down-banner").addEventListener("click", () => showView("sitios"));
  document.getElementById("side-nav").addEventListener("click", (e) => {
    const b = e.target.closest(".side-link");
    if (b) goToView(b.dataset.view);
  });
  // Los iconos son los dibujos fijos de PIXELS, nunca datos de afuera
  document.querySelectorAll("#tabbar [data-icon]").forEach((tab) => {
    tab.insertAdjacentHTML("afterbegin", pixelSvg(PIXELS[tab.dataset.icon]));
  });
  document.getElementById("tabbar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (b) goToView(b.dataset.view);
  });
  document.getElementById("tab-menu").addEventListener("click", () => {
    setMenu(!document.getElementById("app-shell").classList.contains("is-menu-open"));
  });
  document.getElementById("side-scrim").addEventListener("click", () => setMenu(false));
  compactLayout.addEventListener("change", () => setMenu(false));
  setMenu(false);
  new MutationObserver(labelTables).observe(document.querySelector(".shell-main"), { childList: true, subtree: true });
  // Un aviso tocado con la app abierta solo cambia el #
  window.addEventListener("hashchange", () => {
    const wanted = location.hash.slice(1);
    if (G.started && PANEL_VIEWS.includes(wanted) && wanted !== G.view) goToView(wanted);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.getElementById("app-shell").classList.contains("is-menu-open")) setMenu(false);
    else if (G.drawer) closeDrawer();
  });
}

/* Se llama al entrar con sesión de admin. adminUnlocked() puede repetirse: solo carga una vez. */
async function gestorStart() {
  if (G.started) return;
  G.started = true;
  const wanted = location.hash.slice(1);
  await gestorLoad();
  showView(PANEL_VIEWS.includes(wanted) ? wanted : "proyectos");
  startGestorLive().catch(() => {});
}
