/* GTA VI Trophy Guide & Tracker — app/app.js
   Ditulis ulang penuh di sesi Produksi terekam 19 Nov 2026.
   Aplikasi statis offline: data trophy dimuat dari data/trophies.json
   (sumber data: riset.md job 2026-11-19-gta6-trophy-guide-01).
   Checklist tersimpan di localStorage (kunci STORAGE_KEY).
   Preset filter lewat URL: ?grade=Silver&category=activity&missable=1
   &spoiler=0 — dipakai untuk tangkapan layar dan tautan langsung.
   Tanpa logo/artwork resmi Rockstar; semua ikon berupa teks dan CSS. */
(function () {
  "use strict";

  var STORAGE_KEY = "gta6-trophy-guide-v1";
  var DATA_URL = "data/trophies.json";
  var GRADES = ["Platinum", "Gold", "Silver", "Bronze"];

  /* ---------- Logika murni (bisa diuji tanpa DOM) ---------- */

  // Ringkasan progres: total, tercapai, persen, status platinum,
  // dan rincian tercapai/total per grade.
  function calcProgress(trophies, checked) {
    var total = trophies.length;
    var done = 0;
    var byGrade = {};
    GRADES.forEach(function (g) { byGrade[g] = { done: 0, total: 0 }; });
    trophies.forEach(function (t) {
      var slot = byGrade[t.grade] || (byGrade[t.grade] = { done: 0, total: 0 });
      slot.total += 1;
      if (checked[t.id]) { done += 1; slot.done += 1; }
    });
    var pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return {
      done: done,
      total: total,
      pct: pct,
      platinum: total > 0 && done === total,
      byGrade: byGrade
    };
  }

  // Saring daftar trophy. filters: { grade, category, missableOnly,
  // unverifiedOnly, status, query, checked }.
  // Kategori "online" sengaja tidak cocok dengan trophy apa pun:
  // game ini tidak punya trophy online.
  function filterTrophies(trophies, filters) {
    var q = (filters.query || "").trim().toLowerCase();
    return trophies.filter(function (t) {
      if (filters.grade && filters.grade !== "all" && t.grade !== filters.grade) return false;
      if (filters.category && filters.category !== "all" && t.category !== filters.category) return false;
      if (filters.missableOnly && !t.missable) return false;
      if (filters.unverifiedOnly && !t.unverified) return false;
      if (filters.status === "done" && !filters.checked[t.id]) return false;
      if (filters.status === "todo" && filters.checked[t.id]) return false;
      if (q) {
        var hay = (t.name + " " + t.description + " " + (t.guide || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  // Baca preset filter dari query string URL (dipakai tangkapan layar).
  function readUrlPresets(search) {
    var out = {};
    var params = new URLSearchParams(search || "");
    var grade = params.get("grade");
    if (grade && GRADES.indexOf(grade) !== -1) out.grade = grade;
    var category = params.get("category");
    if (category) out.category = category;
    if (params.get("missable") === "1") out.missableOnly = true;
    if (params.get("unverified") === "1") out.unverifiedOnly = true;
    if (params.get("spoiler") === "0") out.hideSpoilers = false;
    var q = params.get("q");
    if (q) out.query = q;
    return out;
  }

  // Validasi struktur file JSON: objek dengan array trophies berisi id string.
  // Dipakai untuk import progres DAN untuk memvalidasi data/trophies.json.
  function validateImport(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: "File bukan objek JSON yang valid." };
    }
    if (!Array.isArray(data.trophies)) {
      return { ok: false, error: "Field 'trophies' tidak ditemukan / bukan array." };
    }
    for (var i = 0; i < data.trophies.length; i++) {
      if (typeof data.trophies[i].id !== "string") {
        return { ok: false, error: "Trophy ke-" + (i + 1) + " tidak punya id string." };
      }
    }
    return { ok: true };
  }

  // Bangun objek export dari state saat ini (untuk diunduh sebagai JSON).
  function buildExport(trophies, checked, hideSpoilers) {
    return {
      app: "gta6-trophy-guide",
      version: 1,
      exportedAt: new Date().toISOString(),
      hideSpoilers: !!hideSpoilers,
      trophies: trophies.map(function (t) {
        return { id: t.id, name: t.name, checked: !!checked[t.id] };
      })
    };
  }

  /* ---------- State ---------- */

  var state = {
    trophies: [],
    checked: {},
    hideSpoilers: true,
    filters: {
      grade: "all",
      category: "all",
      missableOnly: false,
      unverifiedOnly: false,
      status: "all",
      query: ""
    }
  };

  function loadChecked() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveChecked() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.checked));
    } catch (e) {
      setStatus("Gagal menyimpan progres ke browser (penyimpanan diblokir).");
    }
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY + ":settings");
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s && typeof s.hideSpoilers === "boolean") state.hideSpoilers = s.hideSpoilers;
    } catch (e) { /* abaikan: pakai default */ }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY + ":settings", JSON.stringify({ hideSpoilers: state.hideSpoilers }));
    } catch (e) { /* abaikan */ }
  }

  /* ---------- Render ---------- */

  var els = {};
  function $(id) { return document.getElementById(id); }

  function renderProgress() {
    var p = calcProgress(state.trophies, state.checked);
    els.progressText.textContent = p.done + " / " + p.total + " trophy (" + p.pct + "%)";
    els.progressFill.style.width = p.pct + "%";
    els.progressFill.parentNode.setAttribute("aria-valuenow", String(p.pct));
    els.progressSub.textContent = p.platinum
      ? "Platinum diraih! Semua trophy selesai — Vice Got a Price! terbuka."
      : p.total === 0
        ? "Data trophy belum dimuat."
        : (p.total - p.done) + " trophy lagi menuju Platinum.";
    document.title = p.done > 0
      ? "(" + p.done + "/" + p.total + ") Panduan Trophy GTA VI"
      : "Panduan Trophy GTA VI — Tracker 55 Trophy PS5";
    els.gradeBreakdown.innerHTML = "";
    GRADES.forEach(function (g) {
      var slot = p.byGrade[g] || { done: 0, total: 0 };
      var li = document.createElement("li");
      li.textContent = g + ": " + slot.done + "/" + slot.total;
      els.gradeBreakdown.appendChild(li);
    });
  }

  function trophyCard(t) {
    var done = !!state.checked[t.id];
    var card = document.createElement("article");
    // Spoiler di-blur bila trophy belum didapat; begitu dicentang,
    // nama + deskripsi + panduannya terbuka (disembunyikan "sampai didapat").
    card.className = "trophy" + (done ? " done" : "") + (t.spoiler && !done ? " spoiler" : "");
    card.dataset.id = t.id;

    var checkWrap = document.createElement("div");
    checkWrap.className = "trophy-check";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = done;
    cb.setAttribute("aria-label", "Tandai trophy " + t.name + " sebagai tercapai");
    cb.addEventListener("change", function () {
      if (cb.checked) state.checked[t.id] = true;
      else delete state.checked[t.id];
      saveChecked();
      renderAll();
    });
    checkWrap.appendChild(cb);
    card.appendChild(checkWrap);

    var body = document.createElement("div");

    var name = document.createElement("h3");
    name.className = "trophy-name";
    name.textContent = t.name;
    body.appendChild(name);

    var meta = document.createElement("div");
    meta.className = "trophy-meta";
    var grade = document.createElement("span");
    grade.className = "badge " + (t.grade || "Bronze");
    grade.textContent = t.grade || "—";
    meta.appendChild(grade);
    if (t.missable) {
      var m = document.createElement("span");
      m.className = "badge missable";
      m.textContent = "Missable";
      meta.appendChild(m);
    }
    if (t.unverified) {
      var u = document.createElement("span");
      u.className = "badge unverified";
      u.textContent = "Cara belum terverifikasi";
      meta.appendChild(u);
    }
    var cat = document.createElement("span");
    cat.className = "badge cat";
    cat.textContent = t.category || "misc";
    meta.appendChild(cat);
    body.appendChild(meta);

    var desc = document.createElement("p");
    desc.className = "trophy-desc";
    desc.textContent = t.description || "";
    body.appendChild(desc);

    if (t.spoiler && !done) {
      var note = document.createElement("p");
      note.className = "spoiler-note";
      note.textContent = "Trophy cerita (hidden) — nama, deskripsi, dan panduan disembunyikan oleh pengaturan spoiler sampai trophy ini dicentang.";
      body.appendChild(note);
    }
    if (t.missable && t.missableNote) {
      var mn = document.createElement("p");
      mn.className = "trophy-guide missable-note";
      mn.appendChild(document.createElement("b")).textContent = "Perhatian missable: ";
      mn.appendChild(document.createTextNode(t.missableNote));
      body.appendChild(mn);
    }
    if (t.guide) {
      var g = document.createElement("p");
      g.className = "trophy-guide";
      g.appendChild(document.createElement("b")).textContent = "Panduan: ";
      g.appendChild(document.createTextNode(t.guide));
      body.appendChild(g);
    }
    if (t.guideSource) {
      var s = document.createElement("p");
      s.className = "trophy-source";
      s.textContent = "Sumber: " + (t.guideSource.label || t.guideSource.url || "");
      if (t.guideSource.url) {
        s.appendChild(document.createTextNode(" — "));
        var a = document.createElement("a");
        a.href = t.guideSource.url;
        a.textContent = t.guideSource.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        s.appendChild(a);
      }
      body.appendChild(s);
    }

    card.appendChild(body);
    return card;
  }

  function renderList() {
    var filters = {
      grade: state.filters.grade,
      category: state.filters.category,
      missableOnly: state.filters.missableOnly,
      unverifiedOnly: state.filters.unverifiedOnly,
      status: state.filters.status,
      query: state.filters.query,
      checked: state.checked
    };
    var list = filterTrophies(state.trophies, filters);
    els.list.innerHTML = "";
    if (state.trophies.length === 0) {
      els.list.innerHTML = '<div class="empty-state">Data trophy belum tersedia. Periksa file data/trophies.json.</div>';
    } else if (list.length === 0) {
      els.list.innerHTML = '<div class="empty-state">Tidak ada trophy yang cocok dengan filter/pencarian saat ini.</div>';
    } else {
      list.forEach(function (t) { els.list.appendChild(trophyCard(t)); });
    }
    els.countLine.textContent = "Menampilkan " + list.length + " dari " + state.trophies.length + " trophy.";
    var hidden = state.trophies.filter(function (t) { return t.spoiler && !state.checked[t.id]; }).length;
    els.spoilerLine.textContent = state.hideSpoilers
      ? "Spoiler cerita disembunyikan (blur): " + hidden + " trophy hidden masih tertutup sampai dicentang."
      : "Spoiler cerita ditampilkan: semua " + state.trophies.length + " trophy terlihat.";
    els.onlineNote.hidden = state.filters.category !== "online";
  }

  function renderSpoilerSetting() {
    document.body.classList.toggle("spoilers-on", state.hideSpoilers);
    els.spoilerToggle.checked = state.hideSpoilers;
  }

  function renderAll() {
    renderProgress();
    renderList();
    renderSpoilerSetting();
  }

  function setStatus(msg) {
    if (els.status) els.status.textContent = msg;
  }

  /* ---------- Export / Import ---------- */

  function downloadJson(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function doExport() {
    var payload = buildExport(state.trophies, state.checked, state.hideSpoilers);
    downloadJson("gta6-trophy-progress.json", payload);
    setStatus("Progres diekspor (" + Object.keys(state.checked).length + " trophy tercapai).");
  }

  function doImport(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var v = validateImport(data);
        if (!v.ok) { setStatus("Import gagal: " + v.error); return; }
        var imported = 0;
        data.trophies.forEach(function (row) {
          if (row.checked) { state.checked[row.id] = true; imported += 1; }
          else { delete state.checked[row.id]; }
        });
        if (typeof data.hideSpoilers === "boolean") state.hideSpoilers = data.hideSpoilers;
        saveChecked();
        saveSettings();
        renderAll();
        setStatus("Import berhasil: " + imported + " trophy tercapai dimuat dari file.");
      } catch (e) {
        setStatus("Import gagal: file bukan JSON yang valid.");
      }
    };
    reader.onerror = function () { setStatus("Import gagal: file tidak bisa dibaca."); };
    reader.readAsText(file);
  }

  /* ---------- Init ---------- */

  function applyPresetsToControls() {
    els.gradeFilter.value = state.filters.grade;
    els.categoryFilter.value = state.filters.category;
    els.missableFilter.checked = state.filters.missableOnly;
    els.unverifiedFilter.checked = state.filters.unverifiedOnly;
    els.search.value = state.filters.query;
  }

  function init() {
    els = {
      progressText: $("progress-text"),
      progressFill: $("progress-fill"),
      progressSub: $("progress-sub"),
      gradeBreakdown: $("grade-breakdown"),
      list: $("trophy-list"),
      countLine: $("count-line"),
      spoilerLine: $("spoiler-line"),
      onlineNote: $("online-note"),
      status: $("status-line"),
      spoilerToggle: $("spoiler-toggle"),
      search: $("search"),
      gradeFilter: $("grade-filter"),
      categoryFilter: $("category-filter"),
      missableFilter: $("missable-filter"),
      unverifiedFilter: $("unverified-filter"),
      statusFilter: $("status-filter"),
      exportBtn: $("export-btn"),
      importBtn: $("import-btn"),
      importFile: $("import-file"),
      resetBtn: $("reset-btn")
    };

    state.checked = loadChecked();
    loadSettings();

    // Preset URL mengalahkan pengaturan tersimpan (untuk tangkapan layar).
    var presets = readUrlPresets(window.location.search);
    if (presets.grade) state.filters.grade = presets.grade;
    if (presets.category) state.filters.category = presets.category;
    if (presets.missableOnly) state.filters.missableOnly = true;
    if (presets.unverifiedOnly) state.filters.unverifiedOnly = true;
    if (typeof presets.hideSpoilers === "boolean") state.hideSpoilers = presets.hideSpoilers;
    if (presets.query) state.filters.query = presets.query;
    applyPresetsToControls();

    els.search.addEventListener("input", function () { state.filters.query = els.search.value; renderList(); });
    els.gradeFilter.addEventListener("change", function () { state.filters.grade = els.gradeFilter.value; renderList(); });
    els.categoryFilter.addEventListener("change", function () { state.filters.category = els.categoryFilter.value; renderList(); });
    els.missableFilter.addEventListener("change", function () { state.filters.missableOnly = els.missableFilter.checked; renderList(); });
    els.unverifiedFilter.addEventListener("change", function () { state.filters.unverifiedOnly = els.unverifiedFilter.checked; renderList(); });
    els.statusFilter.addEventListener("change", function () { state.filters.status = els.statusFilter.value; renderList(); });
    els.spoilerToggle.addEventListener("change", function () {
      state.hideSpoilers = els.spoilerToggle.checked;
      saveSettings();
      renderSpoilerSetting();
      renderList();
      setStatus(state.hideSpoilers ? "Spoiler cerita disembunyikan." : "Spoiler cerita ditampilkan.");
    });
    els.exportBtn.addEventListener("click", doExport);
    els.importBtn.addEventListener("click", function () { els.importFile.click(); });
    els.importFile.addEventListener("change", function () {
      if (els.importFile.files.length > 0) doImport(els.importFile.files[0]);
      els.importFile.value = "";
    });
    els.resetBtn.addEventListener("click", function () {
      if (window.confirm("Hapus semua progres checklist? Tindakan ini tidak bisa dibatalkan.")) {
        state.checked = {};
        saveChecked();
        renderAll();
        setStatus("Progres direset.");
      }
    });

    fetch(DATA_URL)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) {
        var v = validateImport(data);
        if (!v.ok) { setStatus("Data trophy tidak valid: " + v.error); return; }
        state.trophies = data.trophies;
        renderAll();
        setStatus(data.trophies.length + " trophy dimuat.");
      })
      .catch(function (e) {
        setStatus("Gagal memuat data/trophies.json: " + e.message);
        renderAll();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Diekspos untuk pengujian otomatis (node + stub DOM minimal).
  window.GTA6Guide = {
    calcProgress: calcProgress,
    filterTrophies: filterTrophies,
    readUrlPresets: readUrlPresets,
    validateImport: validateImport,
    buildExport: buildExport,
    STORAGE_KEY: STORAGE_KEY
  };
})();
