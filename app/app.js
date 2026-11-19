/* Panduan Trophy GTA VI — logika aplikasi (app/app.js).
   Penulisan ketiga, ronde rebuild-3, 20 Nov 2026, di sesi terekam R4.
   Naskah ini ditulis dari nol lagi: fungsi-fungsi deklaratif biasa,
   nama-nama baru, dan alur yang disusun ulang. Perilaku luarnya sama
   persis dengan ronde sebelumnya: teks antarmuka, kunci localStorage,
   bentuk berkas export, dan API window.GTA6Guide tidak berubah.
   Data trophy dimuat dari data/trophies.json; halaman ini statis dan
   offline, tanpa satu pun permintaan jaringan. Filter bisa dipreset
   lewat query URL (misalnya ?grade=Silver&spoiler=0) untuk tangkapan
   layar. Tidak ada logo atau artwork resmi Rockstar di sini. */
(function () {
  "use strict";

  var KUNCI_SIMpan = "gta6-trophy-guide-v1";
  var JALUR_DATA = "data/trophies.json";
  var URUTAN_GRADE = ["Platinum", "Gold", "Silver", "Bronze"];
  var GRADE_DIKENAL = {};
  URUTAN_GRADE.forEach(function (g) { GRADE_DIKENAL[g] = true; });

  /* ---------- logika murni (tanpa DOM) ---------- */

  function hitungProgres(daftar, centang) {
    var perGrade = {};
    URUTAN_GRADE.forEach(function (g) { perGrade[g] = { done: 0, total: 0 }; });
    var selesai = 0;
    daftar.forEach(function (t) {
      if (!perGrade[t.grade]) perGrade[t.grade] = { done: 0, total: 0 };
      perGrade[t.grade].total += 1;
      if (centang[t.id]) {
        selesai += 1;
        perGrade[t.grade].done += 1;
      }
    });
    var total = daftar.length;
    return {
      done: selesai,
      total: total,
      pct: total === 0 ? 0 : Math.round((selesai / total) * 100),
      platinum: total > 0 && selesai === total,
      byGrade: perGrade,
    };
  }

  function saringDaftar(daftar, opsi) {
    var kata = (opsi.query || "").trim().toLowerCase();
    var hasil = [];
    daftar.forEach(function (t) {
      if (opsi.grade && opsi.grade !== "all" && t.grade !== opsi.grade) return;
      if (opsi.category && opsi.category !== "all" && t.category !== opsi.category) return;
      if (opsi.missableOnly && !t.missable) return;
      if (opsi.unverifiedOnly && !t.unverified) return;
      if (opsi.status === "done" && !opsi.checked[t.id]) return;
      if (opsi.status === "todo" && opsi.checked[t.id]) return;
      if (kata) {
        var cari = (t.name + " " + t.description + " " + (t.guide || "")).toLowerCase();
        if (cari.indexOf(kata) === -1) return;
      }
      hasil.push(t);
    });
    return hasil;
  }

  function presetDariUrl(pencarian) {
    var param = new URLSearchParams(pencarian || "");
    var temu = {};
    var grade = param.get("grade");
    if (grade && GRADE_DIKENAL[grade]) temu.grade = grade;
    var kategori = param.get("category");
    if (kategori) temu.category = kategori;
    if (param.get("missable") === "1") temu.missableOnly = true;
    if (param.get("unverified") === "1") temu.unverifiedOnly = true;
    if (param.get("spoiler") === "0") temu.hideSpoilers = false;
    var q = param.get("q");
    if (q) temu.query = q;
    return temu;
  }

  function periksaBentukImpor(muatan) {
    if (!muatan || typeof muatan !== "object" || Array.isArray(muatan)) {
      return { ok: false, error: "File bukan objek JSON yang valid." };
    }
    if (!Array.isArray(muatan.trophies)) {
      return { ok: false, error: "Field 'trophies' tidak ditemukan / bukan array." };
    }
    for (var i = 0; i < muatan.trophies.length; i += 1) {
      if (typeof muatan.trophies[i].id !== "string") {
        return { ok: false, error: "Trophy ke-" + (i + 1) + " tidak punya id string." };
      }
    }
    return { ok: true };
  }

  function rakitEkspor(daftar, centang, sembunyikanSpoiler) {
    return {
      app: "gta6-trophy-guide",
      version: 1,
      exportedAt: new Date().toISOString(),
      hideSpoilers: Boolean(sembunyikanSpoiler),
      trophies: daftar.map(function (t) {
        return { id: t.id, name: t.name, checked: Boolean(centang[t.id]) };
      }),
    };
  }

  /* ---------- state ---------- */

  var keadaan = {
    daftar: [],
    centang: {},
    sembunyikanSpoiler: true,
    filter: {
      grade: "all",
      category: "all",
      missableOnly: false,
      unverifiedOnly: false,
      status: "all",
      query: "",
    },
  };

  var el = {};

  function ambilEl(id) { return document.getElementById(id); }

  function muatCentang() {
    try {
      var mentah = localStorage.getItem(KUNCI_SIMpan);
      if (!mentah) return {};
      var olah = JSON.parse(mentah);
      return olah && typeof olah === "object" ? olah : {};
    } catch (e) {
      return {};
    }
  }

  function simpanCentang() {
    try {
      localStorage.setItem(KUNCI_SIMpan, JSON.stringify(keadaan.centang));
    } catch (e) {
      tampilStatus("Gagal menyimpan progres ke browser (penyimpanan diblokir).");
    }
  }

  function muatPreferensi() {
    try {
      var mentah = localStorage.getItem(KUNCI_SIMpan + ":settings");
      if (!mentah) return;
      var pref = JSON.parse(mentah);
      if (pref && typeof pref.hideSpoilers === "boolean") {
        keadaan.sembunyikanSpoiler = pref.hideSpoilers;
      }
    } catch (e) {
      /* pakai bawaan */
    }
  }

  function simpanPreferensi() {
    try {
      localStorage.setItem(
        KUNCI_SIMpan + ":settings",
        JSON.stringify({ hideSpoilers: keadaan.sembunyikanSpoiler }),
      );
    } catch (e) {
      /* abaikan */
    }
  }

  function tampilStatus(pesan) {
    if (el.status) el.status.textContent = pesan;
  }

  /* ---------- render ---------- */

  function buatLencana(teks, kelasTambahan) {
    var lencana = document.createElement("span");
    lencana.className = "badge " + kelasTambahan;
    lencana.textContent = teks;
    return lencana;
  }

  function gambarProgres() {
    var ringkas = hitungProgres(keadaan.daftar, keadaan.centang);
    el.progressText.textContent = ringkas.done + " / " + ringkas.total + " trophy (" + ringkas.pct + "%)";
    el.progressFill.style.width = ringkas.pct + "%";
    el.progressFill.parentNode.setAttribute("aria-valuenow", String(ringkas.pct));
    if (ringkas.platinum) {
      el.progressSub.textContent = "Platinum diraih! Semua trophy selesai — Vice Got a Price! terbuka.";
    } else if (ringkas.total === 0) {
      el.progressSub.textContent = "Data trophy belum dimuat.";
    } else {
      el.progressSub.textContent = (ringkas.total - ringkas.done) + " trophy lagi menuju Platinum.";
    }
    document.title = ringkas.done > 0
      ? "(" + ringkas.done + "/" + ringkas.total + ") Panduan Trophy GTA VI"
      : "Panduan Trophy GTA VI — Tracker 55 Trophy PS5";
    el.gradeBreakdown.replaceChildren();
    URUTAN_GRADE.forEach(function (grade) {
      var slot = ringkas.byGrade[grade] || { done: 0, total: 0 };
      var baris = document.createElement("li");
      baris.textContent = grade + ": " + slot.done + "/" + slot.total;
      el.gradeBreakdown.appendChild(baris);
    });
  }

  function rakitKartu(t) {
    var sudah = Boolean(keadaan.centang[t.id]);
    var kartu = document.createElement("article");
    // Trophy cerita tetap blur selama belum didapat; begitu dicentang,
    // nama + deskripsi + panduannya terbuka.
    kartu.className = "trophy" + (sudah ? " done" : "") + (t.spoiler && !sudah ? " spoiler" : "");
    kartu.dataset.id = t.id;

    var selCentang = document.createElement("div");
    selCentang.className = "trophy-check";
    var kotak = document.createElement("input");
    kotak.type = "checkbox";
    kotak.checked = sudah;
    kotak.setAttribute("aria-label", "Tandai trophy " + t.name + " sebagai tercapai");
    kotak.addEventListener("change", function () {
      if (kotak.checked) keadaan.centang[t.id] = true;
      else delete keadaan.centang[t.id];
      simpanCentang();
      gambarSemua();
    });
    selCentang.appendChild(kotak);
    kartu.appendChild(selCentang);

    var isi = document.createElement("div");

    var judul = document.createElement("h3");
    judul.className = "trophy-name";
    judul.textContent = t.name;
    isi.appendChild(judul);

    var meta = document.createElement("div");
    meta.className = "trophy-meta";
    meta.appendChild(buatLencana(t.grade || "—", t.grade || "Bronze"));
    if (t.missable) meta.appendChild(buatLencana("Missable", "missable"));
    if (t.unverified) meta.appendChild(buatLencana("Cara belum terverifikasi", "unverified"));
    meta.appendChild(buatLencana(t.category || "misc", "cat"));
    isi.appendChild(meta);

    var deskripsi = document.createElement("p");
    deskripsi.className = "trophy-desc";
    deskripsi.textContent = t.description || "";
    isi.appendChild(deskripsi);

    if (t.spoiler && !sudah) {
      var petunjuk = document.createElement("p");
      petunjuk.className = "spoiler-note";
      petunjuk.textContent = "Trophy cerita (hidden) — nama, deskripsi, dan panduan disembunyikan oleh pengaturan spoiler sampai trophy ini dicentang.";
      isi.appendChild(petunjuk);
    }
    if (t.missable && t.missableNote) {
      var peringat = document.createElement("p");
      peringat.className = "trophy-guide missable-note";
      var labelPeringat = document.createElement("b");
      labelPeringat.textContent = "Perhatian missable: ";
      peringat.append(labelPeringat, document.createTextNode(t.missableNote));
      isi.appendChild(peringat);
    }
    if (t.guide) {
      var panduan = document.createElement("p");
      panduan.className = "trophy-guide";
      var labelPanduan = document.createElement("b");
      labelPanduan.textContent = "Panduan: ";
      panduan.append(labelPanduan, document.createTextNode(t.guide));
      isi.appendChild(panduan);
    }
    if (t.guideSource) {
      var sumber = document.createElement("p");
      sumber.className = "trophy-source";
      sumber.textContent = "Sumber: " + (t.guideSource.label || t.guideSource.url || "");
      if (t.guideSource.url) {
        sumber.appendChild(document.createTextNode(" — "));
        var tautan = document.createElement("a");
        tautan.href = t.guideSource.url;
        tautan.textContent = t.guideSource.url;
        tautan.target = "_blank";
        tautan.rel = "noopener noreferrer";
        sumber.appendChild(tautan);
      }
      isi.appendChild(sumber);
    }

    kartu.appendChild(isi);
    return kartu;
  }

  function gambarDaftar() {
    var tampak = saringDaftar(keadaan.daftar, {
      grade: keadaan.filter.grade,
      category: keadaan.filter.category,
      missableOnly: keadaan.filter.missableOnly,
      unverifiedOnly: keadaan.filter.unverifiedOnly,
      status: keadaan.filter.status,
      query: keadaan.filter.query,
      checked: keadaan.centang,
    });
    el.list.replaceChildren();
    if (keadaan.daftar.length === 0) {
      el.list.innerHTML = '<div class="empty-state">Data trophy belum tersedia. Periksa file data/trophies.json.</div>';
    } else if (tampak.length === 0) {
      el.list.innerHTML = '<div class="empty-state">Tidak ada trophy yang cocok dengan filter/pencarian saat ini.</div>';
    } else {
      tampak.forEach(function (t) { el.list.appendChild(rakitKartu(t)); });
    }
    el.countLine.textContent = "Menampilkan " + tampak.length + " dari " + keadaan.daftar.length + " trophy.";
    var masihTertutup = keadaan.daftar.filter(function (t) {
      return t.spoiler && !keadaan.centang[t.id];
    }).length;
    el.spoilerLine.textContent = keadaan.sembunyikanSpoiler
      ? "Spoiler cerita disembunyikan (blur): " + masihTertutup + " trophy hidden masih tertutup sampai dicentang."
      : "Spoiler cerita ditampilkan: semua " + keadaan.daftar.length + " trophy terlihat.";
    el.onlineNote.hidden = keadaan.filter.category !== "online";
  }

  function terapkanSpoiler() {
    document.body.classList.toggle("spoilers-on", keadaan.sembunyikanSpoiler);
    el.spoilerToggle.checked = keadaan.sembunyikanSpoiler;
  }

  function gambarSemua() {
    gambarProgres();
    gambarDaftar();
    terapkanSpoiler();
  }

  /* ---------- export / import ---------- */

  function unduhJson(namaBerkas, muatan) {
    var blob = new Blob([JSON.stringify(muatan, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var jangkar = document.createElement("a");
    jangkar.href = url;
    jangkar.download = namaBerkas;
    document.body.appendChild(jangkar);
    jangkar.click();
    document.body.removeChild(jangkar);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function eksporProgres() {
    unduhJson(
      "gta6-trophy-progress.json",
      rakitEkspor(keadaan.daftar, keadaan.centang, keadaan.sembunyikanSpoiler),
    );
    tampilStatus("Progres diekspor (" + Object.keys(keadaan.centang).length + " trophy tercapai).");
  }

  function imporProgres(berkas) {
    var pembaca = new FileReader();
    pembaca.onload = function () {
      try {
        var muatan = JSON.parse(pembaca.result);
        var putusan = periksaBentukImpor(muatan);
        if (!putusan.ok) {
          tampilStatus("Import gagal: " + putusan.error);
          return;
        }
        var terimpor = 0;
        muatan.trophies.forEach(function (baris) {
          if (baris.checked) {
            keadaan.centang[baris.id] = true;
            terimpor += 1;
          } else {
            delete keadaan.centang[baris.id];
          }
        });
        if (typeof muatan.hideSpoilers === "boolean") {
          keadaan.sembunyikanSpoiler = muatan.hideSpoilers;
        }
        simpanCentang();
        simpanPreferensi();
        gambarSemua();
        tampilStatus("Import berhasil: " + terimpor + " trophy tercapai dimuat dari file.");
      } catch (e) {
        tampilStatus("Import gagal: file bukan JSON yang valid.");
      }
    };
    pembaca.onerror = function () { tampilStatus("Import gagal: file tidak bisa dibaca."); };
    pembaca.readAsText(berkas);
  }

  /* ---------- boot ---------- */

  function sinkronKontrol() {
    el.gradeFilter.value = keadaan.filter.grade;
    el.categoryFilter.value = keadaan.filter.category;
    el.missableFilter.checked = keadaan.filter.missableOnly;
    el.unverifiedFilter.checked = keadaan.filter.unverifiedOnly;
    el.search.value = keadaan.filter.query;
  }

  function mulai() {
    el.progressText = ambilEl("progress-text");
    el.progressFill = ambilEl("progress-fill");
    el.progressSub = ambilEl("progress-sub");
    el.gradeBreakdown = ambilEl("grade-breakdown");
    el.list = ambilEl("trophy-list");
    el.countLine = ambilEl("count-line");
    el.spoilerLine = ambilEl("spoiler-line");
    el.onlineNote = ambilEl("online-note");
    el.status = ambilEl("status-line");
    el.spoilerToggle = ambilEl("spoiler-toggle");
    el.search = ambilEl("search");
    el.gradeFilter = ambilEl("grade-filter");
    el.categoryFilter = ambilEl("category-filter");
    el.missableFilter = ambilEl("missable-filter");
    el.unverifiedFilter = ambilEl("unverified-filter");
    el.statusFilter = ambilEl("status-filter");
    el.exportBtn = ambilEl("export-btn");
    el.importBtn = ambilEl("import-btn");
    el.importFile = ambilEl("import-file");
    el.resetBtn = ambilEl("reset-btn");

    keadaan.centang = muatCentang();
    muatPreferensi();

    // Preset URL mengalahkan preferensi tersimpan (untuk tangkapan layar).
    var preset = presetDariUrl(window.location.search);
    if (preset.grade) keadaan.filter.grade = preset.grade;
    if (preset.category) keadaan.filter.category = preset.category;
    if (preset.missableOnly) keadaan.filter.missableOnly = true;
    if (preset.unverifiedOnly) keadaan.filter.unverifiedOnly = true;
    if (typeof preset.hideSpoilers === "boolean") keadaan.sembunyikanSpoiler = preset.hideSpoilers;
    if (preset.query) keadaan.filter.query = preset.query;
    sinkronKontrol();

    el.search.addEventListener("input", function () {
      keadaan.filter.query = el.search.value;
      gambarDaftar();
    });
    el.gradeFilter.addEventListener("change", function () {
      keadaan.filter.grade = el.gradeFilter.value;
      gambarDaftar();
    });
    el.categoryFilter.addEventListener("change", function () {
      keadaan.filter.category = el.categoryFilter.value;
      gambarDaftar();
    });
    el.missableFilter.addEventListener("change", function () {
      keadaan.filter.missableOnly = el.missableFilter.checked;
      gambarDaftar();
    });
    el.unverifiedFilter.addEventListener("change", function () {
      keadaan.filter.unverifiedOnly = el.unverifiedFilter.checked;
      gambarDaftar();
    });
    el.statusFilter.addEventListener("change", function () {
      keadaan.filter.status = el.statusFilter.value;
      gambarDaftar();
    });
    el.spoilerToggle.addEventListener("change", function () {
      keadaan.sembunyikanSpoiler = el.spoilerToggle.checked;
      simpanPreferensi();
      terapkanSpoiler();
      gambarDaftar();
      tampilStatus(keadaan.sembunyikanSpoiler ? "Spoiler cerita disembunyikan." : "Spoiler cerita ditampilkan.");
    });
    el.exportBtn.addEventListener("click", eksporProgres);
    el.importBtn.addEventListener("click", function () { el.importFile.click(); });
    el.importFile.addEventListener("change", function () {
      if (el.importFile.files.length > 0) imporProgres(el.importFile.files[0]);
      el.importFile.value = "";
    });
    el.resetBtn.addEventListener("click", function () {
      if (window.confirm("Hapus semua progres checklist? Tindakan ini tidak bisa dibatalkan.")) {
        keadaan.centang = {};
        simpanCentang();
        gambarSemua();
        tampilStatus("Progres direset.");
      }
    });

    fetch(JALUR_DATA)
      .then(function (respon) {
        if (!respon.ok) throw new Error("HTTP " + respon.status);
        return respon.json();
      })
      .then(function (muatan) {
        var putusan = periksaBentukImpor(muatan);
        if (!putusan.ok) {
          tampilStatus("Data trophy tidak valid: " + putusan.error);
          return;
        }
        keadaan.daftar = muatan.trophies;
        gambarSemua();
        tampilStatus(muatan.trophies.length + " trophy dimuat.");
      })
      .catch(function (galat) {
        tampilStatus("Gagal memuat data/trophies.json: " + galat.message);
        gambarSemua();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mulai);
  } else {
    mulai();
  }

  // Diekspos untuk pengujian otomatis (node + stub DOM minimal).
  window.GTA6Guide = {
    calcProgress: hitungProgres,
    filterTrophies: saringDaftar,
    readUrlPresets: presetDariUrl,
    validateImport: periksaBentukImpor,
    buildExport: rakitEkspor,
    STORAGE_KEY: KUNCI_SIMpan,
  };
})();
