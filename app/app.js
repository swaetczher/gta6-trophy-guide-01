/* Panduan Trophy GTA VI — app/app.js
   Ditulis ulang dari nol pada ronde rebuild-2 (20 Nov 2026), di sesi
   terekam R3. Bukan salinan naskah lama: struktur, nama fungsi, dan
   nama variabel semuanya baru, tetapi perilaku dipertahankan penuh.
   Halaman ini statis dan offline — datanya berasal dari
   data/trophies.json (55 trophy, sumber: riset.md job
   2026-11-19-gta6-trophy-guide-01). Centang tersimpan di
   localStorage. Filter juga bisa dipreset lewat query URL, misal
   ?grade=Silver&category=activity&missable=1&spoiler=0 — dipakai
   untuk tangkapan layar dan tautan langsung. Tidak ada logo atau
   artwork resmi Rockstar di sini; ikon hanya teks dan CSS. */
(() => {
  "use strict";

  const SAVE_KEY = "gta6-trophy-guide-v1";
  const DATA_PATH = "data/trophies.json";
  const GRADE_ORDER = ["Platinum", "Gold", "Silver", "Bronze"];
  const KNOWN_GRADES = new Set(GRADE_ORDER);

  /* ============ Fungsi murni: tidak menyentuh DOM ============ */

  // Rangkuman progres dari daftar trophy + peta centang.
  // Mengembalikan jumlah selesai, total, persen, status platinum,
  // dan hitungan selesai/total untuk tiap grade.
  const summarizeProgress = (list, doneMap) => {
    const perGrade = Object.fromEntries(
      GRADE_ORDER.map((grade) => [grade, { done: 0, total: 0 }]),
    );
    let finished = 0;
    for (const trophy of list) {
      const slot = perGrade[trophy.grade] ?? (perGrade[trophy.grade] = { done: 0, total: 0 });
      slot.total += 1;
      if (doneMap[trophy.id]) {
        finished += 1;
        slot.done += 1;
      }
    }
    const total = list.length;
    return {
      done: finished,
      total,
      pct: total === 0 ? 0 : Math.round((finished / total) * 100),
      platinum: total > 0 && finished === total,
      byGrade: perGrade,
    };
  };

  // Menyaring daftar trophy menurut opsi: grade, category,
  // missableOnly, unverifiedOnly, status (done/todo), query teks,
  // dan peta centang. Kategori "online" tidak pernah cocok dengan
  // trophy mana pun — game ini memang tidak punya trophy online.
  const selectTrophies = (list, opts) => {
    const needle = (opts.query ?? "").trim().toLowerCase();
    return list.filter((trophy) => {
      if (opts.grade && opts.grade !== "all" && trophy.grade !== opts.grade) return false;
      if (opts.category && opts.category !== "all" && trophy.category !== opts.category) return false;
      if (opts.missableOnly && !trophy.missable) return false;
      if (opts.unverifiedOnly && !trophy.unverified) return false;
      if (opts.status === "done" && !opts.checked[trophy.id]) return false;
      if (opts.status === "todo" && opts.checked[trophy.id]) return false;
      if (needle) {
        const haystack = `${trophy.name} ${trophy.description} ${trophy.guide ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  };

  // Membaca preset filter dari query string URL (untuk tangkapan layar).
  // Hanya grade yang dikenal yang diterima; sisanya diabaikan diam-diam.
  const presetsFromQuery = (search) => {
    const params = new URLSearchParams(search ?? "");
    const found = {};
    const grade = params.get("grade");
    if (grade && KNOWN_GRADES.has(grade)) found.grade = grade;
    const category = params.get("category");
    if (category) found.category = category;
    if (params.get("missable") === "1") found.missableOnly = true;
    if (params.get("unverified") === "1") found.unverifiedOnly = true;
    if (params.get("spoiler") === "0") found.hideSpoilers = false;
    const query = params.get("q");
    if (query) found.query = query;
    return found;
  };

  // Memeriksa bentuk payload JSON: dipakai saat import progres dan
  // saat memvalidasi data/trophies.json. Objek wajib membawa array
  // trophies yang tiap butirnya punya id string.
  const checkImportShape = (payload) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, error: "File bukan objek JSON yang valid." };
    }
    if (!Array.isArray(payload.trophies)) {
      return { ok: false, error: "Field 'trophies' tidak ditemukan / bukan array." };
    }
    for (let index = 0; index < payload.trophies.length; index += 1) {
      if (typeof payload.trophies[index].id !== "string") {
        return { ok: false, error: `Trophy ke-${index + 1} tidak punya id string.` };
      }
    }
    return { ok: true };
  };

  // Menyusun objek export dari state saat ini (diunduh sebagai JSON).
  const makeExportPayload = (list, doneMap, hideSpoilers) => ({
    app: "gta6-trophy-guide",
    version: 1,
    exportedAt: new Date().toISOString(),
    hideSpoilers: Boolean(hideSpoilers),
    trophies: list.map((trophy) => ({
      id: trophy.id,
      name: trophy.name,
      checked: Boolean(doneMap[trophy.id]),
    })),
  });

  /* ============ State aplikasi ============ */

  const appState = {
    items: [],
    done: {},
    hideSpoilers: true,
    filter: {
      grade: "all",
      category: "all",
      missableOnly: false,
      unverifiedOnly: false,
      status: "all",
      query: "",
    },
  };

  const readDone = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeDone = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(appState.done));
    } catch {
      showStatus("Gagal menyimpan progres ke browser (penyimpanan diblokir).");
    }
  };

  const readPrefs = () => {
    try {
      const raw = localStorage.getItem(`${SAVE_KEY}:settings`);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (prefs && typeof prefs.hideSpoilers === "boolean") {
        appState.hideSpoilers = prefs.hideSpoilers;
      }
    } catch {
      /* abaikan: pakai default */
    }
  };

  const writePrefs = () => {
    try {
      localStorage.setItem(
        `${SAVE_KEY}:settings`,
        JSON.stringify({ hideSpoilers: appState.hideSpoilers }),
      );
    } catch {
      /* abaikan */
    }
  };

  /* ============ Render ============ */

  const nodes = {};
  const byId = (id) => document.getElementById(id);

  const paintProgress = () => {
    const summary = summarizeProgress(appState.items, appState.done);
    nodes.progressText.textContent = `${summary.done} / ${summary.total} trophy (${summary.pct}%)`;
    nodes.progressFill.style.width = `${summary.pct}%`;
    nodes.progressFill.parentNode.setAttribute("aria-valuenow", String(summary.pct));
    nodes.progressSub.textContent = summary.platinum
      ? "Platinum diraih! Semua trophy selesai — Vice Got a Price! terbuka."
      : summary.total === 0
        ? "Data trophy belum dimuat."
        : `${summary.total - summary.done} trophy lagi menuju Platinum.`;
    document.title = summary.done > 0
      ? `(${summary.done}/${summary.total}) Panduan Trophy GTA VI`
      : "Panduan Trophy GTA VI — Tracker 55 Trophy PS5";
    nodes.gradeBreakdown.replaceChildren();
    for (const grade of GRADE_ORDER) {
      const slot = summary.byGrade[grade] ?? { done: 0, total: 0 };
      const item = document.createElement("li");
      item.textContent = `${grade}: ${slot.done}/${slot.total}`;
      nodes.gradeBreakdown.appendChild(item);
    }
  };

  const tagBadge = (text, extraClass) => {
    const badge = document.createElement("span");
    badge.className = `badge ${extraClass}`;
    badge.textContent = text;
    return badge;
  };

  const buildCard = (trophy) => {
    const isDone = Boolean(appState.done[trophy.id]);
    const card = document.createElement("article");
    // Trophy cerita di-blur selama belum didapat; begitu dicentang,
    // nama + deskripsi + panduannya terbuka ("sampai didapat").
    card.className = `trophy${isDone ? " done" : ""}${trophy.spoiler && !isDone ? " spoiler" : ""}`;
    card.dataset.id = trophy.id;

    const checkCell = document.createElement("div");
    checkCell.className = "trophy-check";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = isDone;
    box.setAttribute("aria-label", `Tandai trophy ${trophy.name} sebagai tercapai`);
    box.addEventListener("change", () => {
      if (box.checked) appState.done[trophy.id] = true;
      else delete appState.done[trophy.id];
      writeDone();
      paintEverything();
    });
    checkCell.appendChild(box);
    card.appendChild(checkCell);

    const body = document.createElement("div");

    const heading = document.createElement("h3");
    heading.className = "trophy-name";
    heading.textContent = trophy.name;
    body.appendChild(heading);

    const meta = document.createElement("div");
    meta.className = "trophy-meta";
    meta.appendChild(tagBadge(trophy.grade || "—", trophy.grade || "Bronze"));
    if (trophy.missable) meta.appendChild(tagBadge("Missable", "missable"));
    if (trophy.unverified) meta.appendChild(tagBadge("Cara belum terverifikasi", "unverified"));
    meta.appendChild(tagBadge(trophy.category || "misc", "cat"));
    body.appendChild(meta);

    const desc = document.createElement("p");
    desc.className = "trophy-desc";
    desc.textContent = trophy.description || "";
    body.appendChild(desc);

    if (trophy.spoiler && !isDone) {
      const hint = document.createElement("p");
      hint.className = "spoiler-note";
      hint.textContent = "Trophy cerita (hidden) — nama, deskripsi, dan panduan disembunyikan oleh pengaturan spoiler sampai trophy ini dicentang.";
      body.appendChild(hint);
    }
    if (trophy.missable && trophy.missableNote) {
      const warn = document.createElement("p");
      warn.className = "trophy-guide missable-note";
      const label = document.createElement("b");
      label.textContent = "Perhatian missable: ";
      warn.append(label, document.createTextNode(trophy.missableNote));
      body.appendChild(warn);
    }
    if (trophy.guide) {
      const guide = document.createElement("p");
      guide.className = "trophy-guide";
      const label = document.createElement("b");
      label.textContent = "Panduan: ";
      guide.append(label, document.createTextNode(trophy.guide));
      body.appendChild(guide);
    }
    if (trophy.guideSource) {
      const source = document.createElement("p");
      source.className = "trophy-source";
      source.textContent = `Sumber: ${trophy.guideSource.label || trophy.guideSource.url || ""}`;
      if (trophy.guideSource.url) {
        source.appendChild(document.createTextNode(" — "));
        const link = document.createElement("a");
        link.href = trophy.guideSource.url;
        link.textContent = trophy.guideSource.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        source.appendChild(link);
      }
      body.appendChild(source);
    }

    card.appendChild(body);
    return card;
  };

  const paintList = () => {
    const visible = selectTrophies(appState.items, {
      ...appState.filter,
      checked: appState.done,
    });
    nodes.list.replaceChildren();
    if (appState.items.length === 0) {
      nodes.list.innerHTML = '<div class="empty-state">Data trophy belum tersedia. Periksa file data/trophies.json.</div>';
    } else if (visible.length === 0) {
      nodes.list.innerHTML = '<div class="empty-state">Tidak ada trophy yang cocok dengan filter/pencarian saat ini.</div>';
    } else {
      for (const trophy of visible) nodes.list.appendChild(buildCard(trophy));
    }
    nodes.countLine.textContent = `Menampilkan ${visible.length} dari ${appState.items.length} trophy.`;
    const stillHidden = appState.items.filter((t) => t.spoiler && !appState.done[t.id]).length;
    nodes.spoilerLine.textContent = appState.hideSpoilers
      ? `Spoiler cerita disembunyikan (blur): ${stillHidden} trophy hidden masih tertutup sampai dicentang.`
      : `Spoiler cerita ditampilkan: semua ${appState.items.length} trophy terlihat.`;
    nodes.onlineNote.hidden = appState.filter.category !== "online";
  };

  const paintSpoilerSetting = () => {
    document.body.classList.toggle("spoilers-on", appState.hideSpoilers);
    nodes.spoilerToggle.checked = appState.hideSpoilers;
  };

  const paintEverything = () => {
    paintProgress();
    paintList();
    paintSpoilerSetting();
  };

  const showStatus = (message) => {
    if (nodes.status) nodes.status.textContent = message;
  };

  /* ============ Export / Import ============ */

  const saveJsonFile = (filename, payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const runExport = () => {
    saveJsonFile(
      "gta6-trophy-progress.json",
      makeExportPayload(appState.items, appState.done, appState.hideSpoilers),
    );
    showStatus(`Progres diekspor (${Object.keys(appState.done).length} trophy tercapai).`);
  };

  const runImport = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const verdict = checkImportShape(payload);
        if (!verdict.ok) {
          showStatus(`Import gagal: ${verdict.error}`);
          return;
        }
        let imported = 0;
        for (const row of payload.trophies) {
          if (row.checked) {
            appState.done[row.id] = true;
            imported += 1;
          } else {
            delete appState.done[row.id];
          }
        }
        if (typeof payload.hideSpoilers === "boolean") {
          appState.hideSpoilers = payload.hideSpoilers;
        }
        writeDone();
        writePrefs();
        paintEverything();
        showStatus(`Import berhasil: ${imported} trophy tercapai dimuat dari file.`);
      } catch {
        showStatus("Import gagal: file bukan JSON yang valid.");
      }
    };
    reader.onerror = () => showStatus("Import gagal: file tidak bisa dibaca.");
    reader.readAsText(file);
  };

  /* ============ Boot ============ */

  const syncControls = () => {
    nodes.gradeFilter.value = appState.filter.grade;
    nodes.categoryFilter.value = appState.filter.category;
    nodes.missableFilter.checked = appState.filter.missableOnly;
    nodes.unverifiedFilter.checked = appState.filter.unverifiedOnly;
    nodes.search.value = appState.filter.query;
  };

  const boot = () => {
    Object.assign(nodes, {
      progressText: byId("progress-text"),
      progressFill: byId("progress-fill"),
      progressSub: byId("progress-sub"),
      gradeBreakdown: byId("grade-breakdown"),
      list: byId("trophy-list"),
      countLine: byId("count-line"),
      spoilerLine: byId("spoiler-line"),
      onlineNote: byId("online-note"),
      status: byId("status-line"),
      spoilerToggle: byId("spoiler-toggle"),
      search: byId("search"),
      gradeFilter: byId("grade-filter"),
      categoryFilter: byId("category-filter"),
      missableFilter: byId("missable-filter"),
      unverifiedFilter: byId("unverified-filter"),
      statusFilter: byId("status-filter"),
      exportBtn: byId("export-btn"),
      importBtn: byId("import-btn"),
      importFile: byId("import-file"),
      resetBtn: byId("reset-btn"),
    });

    appState.done = readDone();
    readPrefs();

    // Preset URL mengalahkan pengaturan tersimpan (untuk tangkapan layar).
    const presets = presetsFromQuery(window.location.search);
    if (presets.grade) appState.filter.grade = presets.grade;
    if (presets.category) appState.filter.category = presets.category;
    if (presets.missableOnly) appState.filter.missableOnly = true;
    if (presets.unverifiedOnly) appState.filter.unverifiedOnly = true;
    if (typeof presets.hideSpoilers === "boolean") appState.hideSpoilers = presets.hideSpoilers;
    if (presets.query) appState.filter.query = presets.query;
    syncControls();

    const rerenderList = () => paintList();
    const bindings = [
      [nodes.search, "input", () => { appState.filter.query = nodes.search.value; rerenderList(); }],
      [nodes.gradeFilter, "change", () => { appState.filter.grade = nodes.gradeFilter.value; rerenderList(); }],
      [nodes.categoryFilter, "change", () => { appState.filter.category = nodes.categoryFilter.value; rerenderList(); }],
      [nodes.missableFilter, "change", () => { appState.filter.missableOnly = nodes.missableFilter.checked; rerenderList(); }],
      [nodes.unverifiedFilter, "change", () => { appState.filter.unverifiedOnly = nodes.unverifiedFilter.checked; rerenderList(); }],
      [nodes.statusFilter, "change", () => { appState.filter.status = nodes.statusFilter.value; rerenderList(); }],
      [nodes.spoilerToggle, "change", () => {
        appState.hideSpoilers = nodes.spoilerToggle.checked;
        writePrefs();
        paintSpoilerSetting();
        paintList();
        showStatus(appState.hideSpoilers ? "Spoiler cerita disembunyikan." : "Spoiler cerita ditampilkan.");
      }],
      [nodes.exportBtn, "click", runExport],
      [nodes.importBtn, "click", () => nodes.importFile.click()],
      [nodes.importFile, "change", () => {
        if (nodes.importFile.files.length > 0) runImport(nodes.importFile.files[0]);
        nodes.importFile.value = "";
      }],
      [nodes.resetBtn, "click", () => {
        if (window.confirm("Hapus semua progres checklist? Tindakan ini tidak bisa dibatalkan.")) {
          appState.done = {};
          writeDone();
          paintEverything();
          showStatus("Progres direset.");
        }
      }],
    ];
    for (const [element, event, handler] of bindings) {
      element.addEventListener(event, handler);
    }

    fetch(DATA_PATH)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        const verdict = checkImportShape(payload);
        if (!verdict.ok) {
          showStatus(`Data trophy tidak valid: ${verdict.error}`);
          return;
        }
        appState.items = payload.trophies;
        paintEverything();
        showStatus(`${payload.trophies.length} trophy dimuat.`);
      })
      .catch((error) => {
        showStatus(`Gagal memuat data/trophies.json: ${error.message}`);
        paintEverything();
      });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Diekspos untuk pengujian otomatis (node + stub DOM minimal).
  window.GTA6Guide = {
    calcProgress: summarizeProgress,
    filterTrophies: selectTrophies,
    readUrlPresets: presetsFromQuery,
    validateImport: checkImportShape,
    buildExport: makeExportPayload,
    STORAGE_KEY: SAVE_KEY,
  };
})();
