/* =========================================================
   PANEL DE ADMINISTRACIÓN (admin.html)
   Página aparte: se abre en otra pestaña desde Inicio. Usa las
   funciones globales de script.js (config, t, el, getSupabase…)
   y el gestor freelance de gestor.js. Las visitas del portafolio
   no descargan nada de esto.
   ========================================================= */

/* =========================================================
   PORTAL DE ADMINISTRACIÓN
   Se entra con una cuenta de Supabase (correo y contraseña).
   La seguridad real está en la base de datos: las reglas RLS
   de supabase/schema.sql solo dejan publicar a los correos de
   la tabla site_admins. Sin eso, aunque alguien abriera este
   panel desde la consola, Supabase rechazaría el cambio.
   ========================================================= */
let editingId = null;

function showAdminGate(message) {
  document.getElementById("admin-gate").hidden = false;
  document.getElementById("app-shell").hidden = true;
  document.getElementById("admin-error").textContent = message || "";
  document.getElementById("admin-pass").value = "";
  const email = document.getElementById("admin-email");
  (email.value ? document.getElementById("admin-pass") : email).focus();
}

/* ¿La sesión abierta es de alguien que puede publicar? */
async function isSiteAdmin(sb) {
  const { data, error } = await sb.rpc("is_site_admin");
  return !error && data === true;
}

async function openAdmin() {
  showAdminGate(t("admin.checking"));
  try {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    if (data.session && (await isSiteAdmin(sb))) return adminUnlocked();
    showAdminGate("");
  } catch (e) {
    showAdminGate(t("admin.offline"));
  }
}

function adminUnlocked() {
  document.getElementById("admin-gate").hidden = true;
  document.getElementById("app-shell").hidden = false;
  document.getElementById("admin-legacy").hidden = !legacyDraft();
  fillIconSelect();
  renderAdminItems();
  renderAdminRepos();
  renderSkillsEditor();
  renderEduEditor();
  fillWallpaperForm();
  updateAdminCount();
  gestorStart();
}

function adminSay(text, warn) {
  const box = document.getElementById("admin-count");
  box.textContent = text;
  box.classList.toggle("is-warn", !!warn);
}

function updateAdminCount() {
  document.getElementById("admin-count").classList.remove("is-warn");
  document.getElementById("admin-count").textContent = t("admin.count", {
    n: config.items.length,
    r: config.projects.selected.length,
    f: (config.projects.featured || []).length,
    v: Object.keys(config.projects.videos || {}).length,
  });
}

function fillIconSelect() {
  const sel = document.getElementById("f-icon");
  sel.innerHTML = "";
  ICON_KEYS.forEach((k) => {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = k;
    sel.appendChild(o);
  });
}

function fillParentSelect(exceptId) {
  const sel = document.getElementById("f-parent");
  sel.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = t("admin.f.desktop");
  sel.appendChild(none);
  config.items
    .filter((it) => it.type === "folder" && it.id !== exceptId)
    .forEach((it) => {
      const o = document.createElement("option");
      o.value = it.id;
      o.textContent = L(it.name);
      sel.appendChild(o);
    });
}

function renderAdminItems() {
  const box = document.getElementById("admin-items");
  box.innerHTML = "";

  if (!config.items.length) {
    box.appendChild(el("p", "admin-hint", t("admin.items.none")));
    return;
  }

  config.items.forEach((item, i) => {
    const row = el("div", "admin-row" + (item.parent ? " is-child" : ""));

    const ico = el("span");
    ico.innerHTML = iconSvg(item.icon);
    row.appendChild(ico.firstChild);

    row.appendChild(el("span", "grow", L(item.name)));
    row.appendChild(el("span", "tagpill", item.app || item.type));

    const mk = (txt, title, fn) => {
      const b = el("button", "mini", txt);
      b.type = "button";
      b.title = title;
      b.addEventListener("click", fn);
      return b;
    };

    row.appendChild(mk("▲", "Subir", () => moveItem(i, -1)));
    row.appendChild(mk("▼", "Bajar", () => moveItem(i, 1)));
    row.appendChild(mk("✎", "Editar", () => editItem(item.id)));
    row.appendChild(
      mk("✕", "Borrar", () => {
        // Los hijos suben al escritorio en vez de quedar huérfanos
        config.items.forEach((c) => {
          if (c.parent === item.id) c.parent = null;
        });
        config.items.splice(i, 1);
        renderAdminItems();
        updateAdminCount();
      })
    );

    box.appendChild(row);
  });
}

function moveItem(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= config.items.length) return;
  const [it] = config.items.splice(i, 1);
  config.items.splice(j, 0, it);
  renderAdminItems();
}

function showItemFields() {
  const type = document.getElementById("f-type").value;
  document.getElementById("field-app").hidden = type !== "app";
  document.getElementById("field-url").hidden = type !== "link";
  document.getElementById("field-text-es").hidden = type !== "txt";
  document.getElementById("field-text-en").hidden = type !== "txt";
}

function editItem(id) {
  const item = id ? itemById(id) : null;
  editingId = id || null;

  fillParentSelect(id);
  document.getElementById("item-form").hidden = false;
  document.getElementById("f-name-es").value = item ? item.name.es || "" : "";
  document.getElementById("f-name-en").value = item ? item.name.en || "" : "";
  document.getElementById("f-type").value = item ? item.type : "txt";
  document.getElementById("f-icon").value = item ? item.icon : "txt";
  document.getElementById("f-parent").value = item ? item.parent || "" : "";
  document.getElementById("f-app").value = item && item.app ? item.app : "projects";
  document.getElementById("f-url").value = item ? item.url || "" : "";
  document.getElementById("f-text-es").value = item ? item.text.es || "" : "";
  document.getElementById("f-text-en").value = item ? item.text.en || "" : "";
  showItemFields();
  document.getElementById("f-name-es").focus();
}

function submitItem(e) {
  e.preventDefault();
  const type = document.getElementById("f-type").value;
  const data = {
    id: editingId || "it" + Date.now().toString(36),
    type: type,
    app: type === "app" ? document.getElementById("f-app").value : null,
    icon: document.getElementById("f-icon").value,
    url: type === "link" ? document.getElementById("f-url").value : "",
    parent: document.getElementById("f-parent").value || null,
    name: {
      es: document.getElementById("f-name-es").value.trim(),
      en: document.getElementById("f-name-en").value.trim(),
    },
    text: {
      es: document.getElementById("f-text-es").value,
      en: document.getElementById("f-text-en").value,
    },
  };
  if (!data.name.en) data.name.en = data.name.es;

  if (editingId) {
    const i = config.items.findIndex((it) => it.id === editingId);
    config.items[i] = data;
  } else {
    config.items.push(data);
  }

  editingId = null;
  document.getElementById("item-form").hidden = true;
  renderAdminItems();
  updateAdminCount();
}

function renderAdminRepos() {
  const box = document.getElementById("admin-repos");
  box.innerHTML = "";

  if (!allRepos.length) {
    box.appendChild(el("p", "admin-hint", t("admin.repos.wait")));
    return;
  }

  allRepos.forEach((repo) => {
    const row = el("label", "repo-row");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = repo.name;
    cb.checked = config.projects.selected.includes(repo.name);
    cb.addEventListener("change", () => {
      const sel = config.projects.selected;
      const i = sel.indexOf(repo.name);
      if (cb.checked && i < 0) sel.push(repo.name);
      if (!cb.checked && i >= 0) sel.splice(i, 1);
      updateAdminCount();
    });

    const text = el("span");
    text.appendChild(el("strong", "", repo.name));
    text.appendChild(el("span", "repo-desc", repo.description || "—"));

    row.appendChild(cb);
    row.appendChild(text);

    // Video anclado al proyecto (YouTube, Vimeo o .mp4)
    const card = el("div", "repo-card");
    card.appendChild(row);
    const vid = document.createElement("input");
    vid.type = "url";
    vid.className = "input repo-video";
    vid.placeholder = t("admin.repos.videoPh");
    vid.setAttribute("aria-label", t("admin.repos.video", { name: repo.name }));
    vid.value = (config.projects.videos || {})[repo.name] || "";
    const note = el("span", "repo-video-note");
    const check = () => {
      const url = vid.value.trim();
      const ok = !url || videoSource(url);
      note.textContent = !url ? "" : ok ? "✓ " + t("admin.repos.videoOk") : "✗ " + t("admin.repos.videoBad");
      note.classList.toggle("is-bad", !ok);
      config.projects.videos = config.projects.videos || {};
      if (url && ok) config.projects.videos[repo.name] = url;
      else delete config.projects.videos[repo.name];
      updateAdminCount();
    };
    vid.addEventListener("input", check);
    check();
    card.appendChild(vid);
    card.appendChild(note);

    // O subir el archivo desde el PC a Supabase Storage (bucket
    // project-videos, público para ver, solo el admin sube)
    const up = el("div", "repo-upload");
    const file = document.createElement("input");
    file.type = "file";
    file.accept = "video/mp4,video/webm,video/ogg";
    file.hidden = true;
    const pick = el("button", "btn", "⇪ " + t("admin.repos.upload"));
    pick.type = "button";
    const upNote = el("span", "repo-video-note");
    pick.addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      const f = file.files[0];
      file.value = "";
      if (!f) return;
      upNote.classList.remove("is-bad");
      if (!VIDEO_TYPES[f.type]) {
        upNote.classList.add("is-bad");
        upNote.textContent = "✗ " + t("admin.repos.uploadType");
        return;
      }
      if (f.size > VIDEO_MAX_BYTES) {
        upNote.classList.add("is-bad");
        upNote.textContent = "✗ " + t("admin.repos.uploadBig", { mb: Math.round(f.size / 1048576) });
        return;
      }
      pick.disabled = true;
      upNote.textContent = t("admin.repos.uploading", { mb: (f.size / 1048576).toFixed(1) });
      try {
        vid.value = await uploadVideo(repo.name, f);
        check();
        upNote.textContent = "✓ " + t("admin.repos.uploaded");
      } catch (e) {
        upNote.classList.add("is-bad");
        upNote.textContent = "✗ " + t("admin.repos.uploadFail", { msg: (e && e.message) || "?" });
      } finally {
        pick.disabled = false;
      }
    });
    up.appendChild(pick);
    up.appendChild(file);
    up.appendChild(upNote);
    card.appendChild(up);

    // Destacado: sale primero y en la pestaña "Destacados"
    const star = el("label", "repo-star");
    const sb = document.createElement("input");
    sb.type = "checkbox";
    sb.checked = isFeatured(repo.name);
    sb.addEventListener("change", () => {
      const feat = (config.projects.featured = config.projects.featured || []);
      const i = feat.indexOf(repo.name);
      if (sb.checked && i < 0) feat.push(repo.name);
      if (!sb.checked && i >= 0) feat.splice(i, 1);
      updateAdminCount();
    });
    star.appendChild(sb);
    star.appendChild(el("span", "", "★ " + t("admin.repos.featured")));
    card.appendChild(star);

    // Caso de estudio: rol, problema, solución, resultado (es/en)
    const det = document.createElement("details");
    det.className = "repo-case-edit";
    const cur = repoCase(repo.name) || {};
    det.appendChild(el("summary", "", t("admin.repos.case") + (Object.keys(cur).length ? " ✓" : "")));
    CASE_FIELDS.forEach((f) => {
      ["es", "en"].forEach((lg) => {
        const lab = el("label", "field");
        lab.appendChild(el("span", "", t("app.projects.case." + f) + " (" + lg.toUpperCase() + ")"));
        const ta = document.createElement("textarea");
        ta.className = "input";
        ta.rows = f === "role" ? 1 : 2;
        ta.maxLength = 1200;
        ta.placeholder = t("admin.repos.ph." + f);
        ta.value = (cur[f] && cur[f][lg]) || "";
        ta.addEventListener("input", () => {
          const all = (config.projects.cases = config.projects.cases || {});
          const c = (all[repo.name] = all[repo.name] || {});
          const v = (c[f] = c[f] || { es: "", en: "" });
          v[lg] = ta.value;
          if (!v.es.trim() && !v.en.trim()) delete c[f];
          if (!Object.keys(c).length) delete all[repo.name];
        });
        lab.appendChild(ta);
        det.appendChild(lab);
      });
    });
    card.appendChild(det);
    box.appendChild(card);
  });
}

function fillWallpaperForm() {
  const wp = config.wallpaper;
  document.getElementById("wp-type").value = wp.type;
  document.getElementById("wp-color").value = wp.value || "#000000";
  document.getElementById("wp-color2").value = wp.value2 || "#2a0d0d";
  document.getElementById("wp-url").value = wp.url || "";
  document.getElementById("wp-fx").checked = config.showFx !== false;
  syncWallpaperFields();
}

function syncWallpaperFields() {
  const type = document.getElementById("wp-type").value;
  document.getElementById("wp-field-color").hidden = type === "image";
  document.getElementById("wp-field-color2").hidden = type !== "gradient";
  document.getElementById("wp-field-url").hidden = type !== "image";
}

function readWallpaperForm() {
  config.wallpaper = {
    type: document.getElementById("wp-type").value,
    value: document.getElementById("wp-color").value,
    value2: document.getElementById("wp-color2").value,
    url: document.getElementById("wp-url").value.trim(),
  };
  config.showFx = document.getElementById("wp-fx").checked;
  applyWallpaper();
}

/* ----- Habilidades: un bloque por grupo ----- */
function adminInput(labelKey, value, cls) {
  const wrap = el("div", "field");
  const lab = el("label", "", t(labelKey));
  const input = document.createElement("input");
  input.className = "input " + (cls || "");
  input.value = value || "";
  lab.appendChild(input);
  wrap.appendChild(lab);
  return wrap;
}

function removeBtn(onClick) {
  const b = el("button", "mini edit-remove", "✕");
  b.type = "button";
  b.title = t("admin.remove");
  b.setAttribute("aria-label", t("admin.remove"));
  b.addEventListener("click", onClick);
  return b;
}

function renderSkillsEditor() {
  const box = document.getElementById("admin-skills");
  box.innerHTML = "";
  config.skills.forEach((g, i) => {
    const card = el("fieldset", "edit-card");
    card.appendChild(removeBtn(() => {
      readSkillsForm();
      config.skills.splice(i, 1);
      renderSkillsEditor();
    }));
    const grid = el("div", "form-grid");
    grid.appendChild(adminInput("admin.sk.name.es", g.es, "sk-es"));
    grid.appendChild(adminInput("admin.sk.name.en", g.en, "sk-en"));
    card.appendChild(grid);
    card.appendChild(adminInput("admin.sk.items", g.items.join(", "), "sk-items"));
    box.appendChild(card);
  });
}

function readSkillsForm() {
  const cards = document.querySelectorAll("#admin-skills .edit-card");
  if (!cards.length) return; // editor sin pintar: no tocar la config
  config.skills = [...cards]
    .map((c) => ({
      es: c.querySelector(".sk-es").value.trim(),
      en: c.querySelector(".sk-en").value.trim() || c.querySelector(".sk-es").value.trim(),
      items: c.querySelector(".sk-items").value.split(",").map((s) => s.trim()).filter(Boolean),
    }))
    .filter((g) => g.es || g.items.length);
}

/* ----- Educación: un bloque por estudio ----- */
const EDU_FIELDS = [
  ["title", "es", "admin.ed.title.es"],
  ["title", "en", "admin.ed.title.en"],
  ["place", "es", "admin.ed.place"],
  ["when", "es", "admin.ed.when.es"],
  ["when", "en", "admin.ed.when.en"],
  ["state", "es", "admin.ed.state.es"],
  ["state", "en", "admin.ed.state.en"],
];

function renderEduEditor() {
  const box = document.getElementById("admin-edu");
  box.innerHTML = "";
  config.education.forEach((e, i) => {
    const card = el("fieldset", "edit-card");
    card.appendChild(removeBtn(() => {
      readEduForm();
      config.education.splice(i, 1);
      renderEduEditor();
    }));
    const grid = el("div", "form-grid");
    EDU_FIELDS.forEach(([field, lng, key]) => {
      grid.appendChild(adminInput(key, (e[field] || {})[lng], "ed-" + field + "-" + lng));
    });
    card.appendChild(grid);
    box.appendChild(card);
  });
}

function readEduForm() {
  const cards = document.querySelectorAll("#admin-edu .edit-card");
  if (!cards.length) return;
  config.education = [...cards]
    .map((c) => {
      const v = (f, l) => c.querySelector(".ed-" + f + "-" + l).value.trim();
      const pair = (f) => ({ es: v(f, "es"), en: v(f, "en") || v(f, "es") });
      return {
        title: pair("title"),
        // el centro se escribe una vez: vale para los dos idiomas
        place: { es: v("place", "es"), en: v("place", "es") },
        when: pair("when"),
        state: pair("state"),
      };
    })
    .filter((e) => e.title.es);
}

/* Lo que hay en los formularios pasa a la config */
function readAdminForms() {
  readWallpaperForm();
  if (!document.getElementById("admin-panel-body").hidden) {
    readSkillsForm();
    readEduForm();
  }
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "desktop.json";
  a.click();
  URL.revokeObjectURL(url);
  adminSay(t("admin.exported"));
}

function initAdmin() {
  const email = document.getElementById("admin-email");
  const pass = document.getElementById("admin-pass");
  const enter = document.getElementById("admin-submit");
  const submit = async () => {
    const err = document.getElementById("admin-error");
    if (!email.value.trim() || !pass.value) return email.value.trim() ? pass.focus() : email.focus();
    err.textContent = t("admin.checking");
    enter.disabled = true;
    try {
      const sb = await getSupabase();
      const { error } = await sb.auth.signInWithPassword({
        email: email.value.trim(),
        password: pass.value,
      });
      pass.value = "";
      if (error) {
        err.textContent = t("admin.badlogin");
        pass.focus();
        return;
      }
      if (!(await isSiteAdmin(sb))) {
        await sb.auth.signOut();
        err.textContent = t("admin.notadmin");
        return;
      }
      err.textContent = "";
      adminUnlocked();
    } catch (e) {
      err.textContent = t("admin.offline");
    } finally {
      enter.disabled = false;
    }
  };
  enter.addEventListener("click", submit);
  [email, pass].forEach((input) =>
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    })
  );

  const logout = async () => {
    try {
      await pushOff(); // Antes de salir: borrarlo pide la sesión
      await (await getSupabase()).auth.signOut();
    } catch (e) {}
    showAdminGate("");
  };
  document.getElementById("admin-logout").addEventListener("click", logout);
  document.getElementById("shell-logout").addEventListener("click", logout);

  // Borrador de antes de Supabase: cargarlo en el panel o tirarlo
  document.getElementById("legacy-load").addEventListener("click", () => {
    const draft = legacyDraft();
    if (!draft) return;
    applyConfig(draft);
    adminUnlocked();
    document.getElementById("admin-legacy").hidden = false;
    adminSay(t("admin.legacy.loaded"));
  });
  document.getElementById("legacy-drop").addEventListener("click", () => {
    try { localStorage.removeItem(CFG_KEY); } catch (e) {}
    document.getElementById("admin-legacy").hidden = true;
  });

  document.getElementById("admin-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    document.querySelectorAll("#admin-tabs .tab").forEach((b) => {
      b.classList.toggle("is-active", b === tab);
    });
    ["items", "look", "repos", "skills", "edu"].forEach((name) => {
      document.getElementById("tab-" + name).hidden = name !== tab.dataset.tab;
    });
  });

  document.getElementById("skill-add").addEventListener("click", () => {
    readSkillsForm();
    config.skills.push({ es: "", en: "", items: [] });
    renderSkillsEditor();
    const last = document.querySelector("#admin-skills .edit-card:last-child .sk-es");
    if (last) last.focus();
  });
  document.getElementById("edu-add").addEventListener("click", () => {
    readEduForm();
    const empty = { es: "", en: "" };
    config.education.push({ title: { ...empty }, place: { ...empty }, when: { ...empty }, state: { ...empty } });
    renderEduEditor();
    const last = document.querySelector("#admin-edu .edit-card:last-child input");
    if (last) last.focus();
  });

  document.getElementById("item-add").addEventListener("click", () => editItem(null));
  document.getElementById("item-cancel").addEventListener("click", () => {
    editingId = null;
    document.getElementById("item-form").hidden = true;
  });
  document.getElementById("f-type").addEventListener("change", showItemFields);
  document.getElementById("item-form").addEventListener("submit", submitItem);

  ["wp-type", "wp-color", "wp-color2", "wp-url", "wp-fx"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      syncWallpaperFields();
      readWallpaperForm();
    });
  });

  // Publicar: va a Supabase y de ahí, en vivo, a todas las visitas
  const save = document.getElementById("admin-save");
  save.addEventListener("click", async () => {
    readAdminForms();
    renderDesktop();
    renderStartMenu();
    renderLauncher();
    repaintOpenWindows({ keepForms: true });
    save.disabled = true;
    adminSay(t("admin.saving"));
    try {
      config = await publishData(normalizeConfig(config));
      // Lo de este navegador ya está publicado: el borrador viejo sobra
      try { localStorage.removeItem(CFG_KEY); } catch (e) {}
      document.getElementById("admin-legacy").hidden = true;
      adminSay(t("admin.saved"));
    } catch (e) {
      adminSay(t("admin.saveFail", { msg: (e && e.message) || "?" }), true);
    } finally {
      save.disabled = false;
    }
  });

  document.getElementById("admin-export").addEventListener("click", () => {
    readAdminForms();
    exportConfig();
  });

  // Restablecer publica "{}": todos vuelven al escritorio de fábrica,
  // y los iconos nuevos que traiga el código aparecen solos
  document.getElementById("admin-reset").addEventListener("click", async () => {
    if (!window.confirm(t("admin.resetAsk"))) return;
    adminSay(t("admin.saving"));
    try {
      const next = await publishData({});
      closeAllWins();
      applyConfig(next);
      adminUnlocked();
      adminSay(t("admin.saved"));
    } catch (e) {
      adminSay(t("admin.saveFail", { msg: (e && e.message) || "?" }), true);
    }
  });
}

/* ---------------------------------------------------------
   Arranque de la página
   --------------------------------------------------------- */
function onAdminLang() {
  document.title = "Panel · AM Developer";
}

function adminWebRefresh() {
  if (!document.getElementById("app-shell").hidden) adminUnlocked();
}

document.addEventListener("DOMContentLoaded", async () => {
  harvestBaseLang();
  let data = await fetchRemoteData();
  if (data === undefined) data = cachedRemoteData();
  config = await configFromData(data);
  lastRemote = stableJson(config);

  let startLang = DEFAULT_LANG;
  try {
    startLang = localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
  } catch (e) {}
  applyLang(startLang);

  initAdmin();
  initShell();
  openAdmin();

  // Los repos llenan la pestaña Proyectos de la web
  loadRepos().then(() => {
    if (!document.getElementById("app-shell").hidden) renderAdminRepos();
  });
});
