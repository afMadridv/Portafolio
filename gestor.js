/* =========================================================
   GESTOR DE PROYECTOS FREELANCE (admin.html)
   Tablero Pendiente / En marcha / Terminado, detalle con
   checklist y pagos, cotizaciones, entregas y clientes.

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
  view: "proyectos",
  search: "",
  drawer: null, // { type: "project" | "client" | "message", id }
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
      ? "Faltan tablas del panel. Corre supabase/schema.sql en Supabase → SQL Editor y recarga esta página."
      : "No se pudieron cargar los datos: " + r.error.message;
  });
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

  const banner = document.getElementById("down-banner");
  banner.hidden = !down.length;
  banner.textContent = down.length
    ? (down.length === 1 ? down[0].name + " está caída" : down.length + " webs caídas: " + down.map((x) => x.name).join(", ")) + " · ver Sitios"
    : "";

  // Facturado = lo cobrado este mes. Por cobrar = saldo de lo que ya está en marcha o terminado.
  const month = todayStr().slice(0, 7);
  const billed = G.payments.filter((p) => String(p.paid_on).startsWith(month)).reduce((n, p) => n + Number(p.amount), 0);
  const due = G.projects.filter((p) => p.status !== "pendiente").reduce((n, p) => n + dueOf(p), 0);
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
  table.appendChild(tableHead(["Cliente", "Contacto", "Correo", "Teléfono", "Proyectos", "Saldo"]));
  const tb = document.createElement("tbody");
  G.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((c) => {
    const own = G.projects.filter((p) => p.client_id === c.id);
    const tr = el("tr", "is-link");
    tr.appendChild(el("td", "", c.name));
    tr.appendChild(el("td", "", c.contact || "—"));
    tr.appendChild(el("td", "", c.email || "—"));
    tr.appendChild(el("td", "", c.phone || "—"));
    tr.appendChild(el("td", "num", String(own.length)));
    tr.appendChild(el("td", "num", money(own.filter((p) => p.status !== "pendiente").reduce((n, p) => n + dueOf(p), 0))));
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
  box.appendChild(field("Persona de contacto", textInput(c.contact, (v) => save({ contact: v || null }))));
  const two = el("div", "two");
  two.appendChild(field("Correo", textInput(c.email, (v) => save({ email: v || null }), "email")));
  two.appendChild(field("Teléfono", textInput(c.phone, (v) => save({ phone: v || null }), "tel")));
  two.appendChild(field("NIT o documento", textInput(c.tax_id, (v) => save({ tax_id: v || null }))));
  two.appendChild(field("Ciudad", textInput(c.city, (v) => save({ city: v || null }))));
  box.appendChild(two);
  box.appendChild(field("Notas", textArea(c.notes, (v) => save({ notes: v || null }), 3)));
  const danger = el("div", "drawer-danger");
  danger.appendChild(button("Borrar cliente", async () => {
    if (!window.confirm('¿Borrar "' + c.name + '"? Sus proyectos y cotizaciones se quedan, sin cliente.')) return;
    G.clients = G.clients.filter((o) => o.id !== c.id);
    G.projects.forEach((p) => { if (p.client_id === c.id) p.client_id = null; });
    G.quotes.forEach((q) => { if (q.client_id === c.id) q.client_id = null; });
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
  b.appendChild(el("h1", "qs-name", "Andrés Madrid"));
  b.appendChild(el("p", "qs-role", "Desarrollador de software · Colombia"));
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
  cotizar: ["Cotización", "is-blue"],
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

function renderSites() {
  const root = document.getElementById("view-sitios");
  root.innerHTML = "";
  const head = el("div", "view-head");
  head.appendChild(el("h1", "view-title", "Sitios"));
  const note = el("span", "q-save-note");
  head.appendChild(note);
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
  root.appendChild(el("p", "view-note", "Se revisan cada 5 minutos. Si una web falla dos veces seguidas te llega un correo, y otro cuando vuelve."));

  const form = el("form", "inline-add site-add");
  const name = textInput("", () => {});
  name.placeholder = "Nombre";
  name.setAttribute("aria-label", "Nombre de la web");
  const url = textInput("", () => {}, "url");
  url.placeholder = "https://…";
  url.setAttribute("aria-label", "Dirección de la web");
  const addBtn = el("button", "btn", "Añadir web");
  addBtn.type = "submit";
  form.appendChild(name);
  form.appendChild(url);
  form.appendChild(addBtn);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const link = /^https?:\/\//i.test(url.value.trim()) ? safeUrl(url.value.trim()) : "";
    if (!name.value.trim()) return name.focus();
    if (!link) return url.focus();
    const row = await safely(dbInsert("fl_sites", { name: name.value.trim(), url: link }));
    G.sites.push(row);
    renderAllViews();
  });
  root.appendChild(form);

  const wrap = el("div", "table-wrap");
  if (!G.sites.length) {
    wrap.appendChild(el("p", "empty", "Todavía no vigilas ninguna web. Añade una o impórtalas de tus proyectos."));
    return root.appendChild(wrap);
  }
  const table = el("table", "tbl");
  table.appendChild(tableHead(["Estado", "Web", "Última revisión", "Respuesta", "Vigilar", ""]));
  const tb = document.createElement("tbody");
  G.sites.slice().sort((a, b) => (a.status === "down" ? -1 : b.status === "down" ? 1 : a.name.localeCompare(b.name))).forEach((x) => {
    const tr = el("tr", x.status === "down" ? "is-down" : "");
    const st = SITE_STATUS[x.status] || SITE_STATUS.unknown;
    const c1 = el("td");
    c1.appendChild(el("span", "tag " + st[1], st[0]));
    tr.appendChild(c1);
    const c2 = el("td");
    c2.appendChild(el("strong", "", x.name));
    const a = el("a", "site-url", x.url);
    a.href = safeUrl(x.url) || "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    c2.appendChild(a);
    if (x.status === "down" && x.last_error) c2.appendChild(el("span", "site-err", x.last_error));
    tr.appendChild(c2);
    tr.appendChild(el("td", "", whenShort(x.last_checked_at)));
    tr.appendChild(el("td", "", x.last_ms != null ? x.last_ms + " ms" : "—"));
    const c5 = el("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = x.active;
    cb.setAttribute("aria-label", "Vigilar " + x.name);
    cb.addEventListener("change", async () => {
      x.active = cb.checked;
      paintSide();
      await safely(dbUpdate("fl_sites", x.id, { active: x.active }));
    });
    c5.appendChild(cb);
    tr.appendChild(c5);
    const c6 = el("td", "num");
    c6.appendChild(button("Quitar", async () => {
      if (!window.confirm('¿Dejar de vigilar "' + x.name + '" y borrar su historial?')) return;
      G.sites = G.sites.filter((o) => o.id !== x.id);
      G.events = G.events.filter((o) => o.site_id !== x.id);
      renderAllViews();
      await safely(dbDelete("fl_sites", x.id));
    }));
    tr.appendChild(c6);
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  wrap.appendChild(table);
  root.appendChild(wrap);

  const recent = G.events.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 15);
  if (recent.length) {
    root.appendChild(el("h2", "view-sub", "Historial"));
    const w2 = el("div", "table-wrap");
    const t2 = el("table", "tbl");
    t2.appendChild(tableHead(["Cuándo", "Web", "Qué pasó", "Detalle"]));
    const b2 = document.createElement("tbody");
    recent.forEach((ev) => {
      const tr = document.createElement("tr");
      const site = G.sites.find((o) => o.id === ev.site_id);
      tr.appendChild(el("td", "", whenShort(ev.at)));
      tr.appendChild(el("td", "", site ? site.name : "—"));
      const td = el("td");
      td.appendChild(el("span", "tag " + (ev.kind === "down" ? "is-hot" : "is-good"), ev.kind === "down" ? "Se cayó" : "Volvió"));
      tr.appendChild(td);
      tr.appendChild(el("td", "", ev.detail || "—"));
      b2.appendChild(tr);
    });
    t2.appendChild(b2);
    w2.appendChild(t2);
    root.appendChild(w2);
  }
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
   Con el panel cerrado avisa el correo. */
function toast(text, kind) {
  const box = document.getElementById("toasts");
  const t = el("div", "toast " + (kind || ""), text);
  box.appendChild(t);
  setTimeout(() => t.remove(), 7000);
  try {
    if (window.Notification && Notification.permission === "granted" && document.visibilityState !== "visible") {
      new Notification("AM Developer", { body: text });
    }
  } catch (e) {}
}

function paintNotifyButton() {
  const b = document.getElementById("notify-btn");
  if (!window.Notification || Notification.permission !== "default") b.hidden = true;
}

async function startGestorLive() {
  paintNotifyButton();
  document.getElementById("notify-btn").addEventListener("click", async () => {
    await Notification.requestPermission();
    paintNotifyButton();
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
    ["[Cotización] azul: solo el mensaje", "[Colaboración] verde: en qué y enlace", "[Empleo] morado: empresa y vacante", "[Contacto] gris: solo el mensaje", "[CAÍDA] rojo y [RESUELTO] verde: avisos del monitor", "Responder le contesta directo a quien escribió"]
  );
  root.appendChild(grid);
}

/* ---------- Estructura ---------- */
function showView(name) {
  G.view = name;
  document.querySelectorAll("#side-nav .side-link").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name));
  document.querySelectorAll(".shell-main > .view").forEach((v) => (v.hidden = v.id !== "view-" + name));
  if (!["proyectos", "clientes", "bandeja"].includes(name)) closeDrawerQuiet();
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
  const typingInSites = active && active.matches("input:not([type=checkbox])") && document.getElementById("view-sitios").contains(active);
  if (G.view === "sitios" && !typingInSites) renderSites();
}

function initShell() {
  document.getElementById("down-banner").addEventListener("click", () => showView("sitios"));
  document.getElementById("side-nav").addEventListener("click", (e) => {
    const b = e.target.closest(".side-link");
    if (!b) return;
    if (b.dataset.view !== "presupuestos" && G.editing) {
      G.editing = null;
      clearQuoteView();
    }
    showView(b.dataset.view);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && G.drawer) closeDrawer();
  });
}

/* Se llama al entrar con sesión de admin. adminUnlocked() puede repetirse: solo carga una vez. */
async function gestorStart() {
  if (G.started) return;
  G.started = true;
  const wanted = location.hash.slice(1);
  const known = ["proyectos", "bandeja", "presupuestos", "entregas", "clientes", "sitios", "formatos", "web"];
  await gestorLoad();
  showView(known.includes(wanted) ? wanted : "proyectos");
  startGestorLive().catch(() => {});
}
