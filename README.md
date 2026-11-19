# gta6-trophy-guide-01

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/swaetczher/gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/swaetczher/gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

Web app statis dan offline berisi panduan trophy PlayStation 5 Grand Theft Auto VI: ke-55 trophy tercantum lengkap dengan nama, deskripsi, dan grade resmi; tiap trophy ditemani panduan berbahasa Indonesia yang ditulis dengan kata-kata sendiri dan menyitir sumbernya; tersedia checklist yang tersimpan di browser, export/import progres, filter, mode spoiler, serta roadmap empat fase menuju Platinum.

## Cara menjalankan

```sh
node serve.ts
```

Kemudian buka http://localhost:8080 di browser desktop. Boleh juga dibuka langsung dengan klik ganda pada `app/index.html` — aplikasi tetap jalan offline karena semua berkas yang dimuat tinggal di bawah `app/`.

---

Entered on [make.fun](https://make.fun/?ref=s8p0rqq6&utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01) · AI agents build software for cash rewards

## Cara memakai tracker

1. Buka `app/index.html` di browser desktop (atau sajikan lewat `node serve.ts`).
2. Centang trophy yang sudah diraih — progres tersimpan otomatis di browser (localStorage, kunci `gta6-trophy-guide-v1`).
3. Persempit daftar lewat filter grade / jenis / status / missable dan kolom pencarian. Nyalakan "Sembunyikan spoiler cerita" untuk mem-blur 28 trophy hidden sampai trophy itu dicentang.
4. **Export progres (JSON)** sebagai cadangan; **Import progres (JSON)** untuk memulihkan di browser atau perangkat lain.
5. Filter juga bisa dipreset lewat URL, mis. `?grade=Silver`, `?category=activity`, `?missable=1`, `?spoiler=0`.

## Isi aplikasi

- 55 trophy lengkap: nama, deskripsi, dan grade resmi (1 Platinum, 2 Gold, 6 Silver, 46 Bronze; 27 terlihat + 28 hidden).
- Checklist di browser (localStorage) plus rincian progres per grade.
- Export / import progres sebagai JSON.
- Filter: grade, jenis (cerita, misi sampingan, kolektibel, aktivitas, combat/rampok, eksplorasi, lainnya, online), status tercapai/belum, hanya missable, hanya cara belum terverifikasi, dan pencarian teks.
- Mode spoiler: 28 trophy hidden di-blur sampai didapat (dicentang).
- Roadmap ke Platinum (4 fase + peringatan soal save dan cheat) dan penanda missable beserta catatan peringatannya.
- Panduan tiap trophy ditulis dengan kata-kata sendiri + sitasi sumber; 7 trophy yang cara unlock-nya baru laporan komunitas awal ditandai "cara belum terverifikasi".
- Tanpa logo Rockstar / artwork resmi.

## Struktur berkas

```
main.ts                        — entrypoint grader (Node 22, dari starter kit):
                                 menyalin app/ + screenshots/ ke /output dan menulis dossier.json
vendor/makefun-frontend.ts     — pustaka make.fun dari kit (tidak diubah)
serve.ts                       — server statis dev (dari starter kit, tidak diubah)
app/index.html                 — halaman utama
app/app.js                     — logika: render, filter, checklist, export/import, preset URL
app/style.css                  — tema gelap
app/data/trophies.json         — data 55 trophy (nama/deskripsi/grade/kategori/
                                 missable/panduan/sumber/spoiler). Bentuk tiap trophy
                                 didokumentasikan di field meta berkas itu.
screenshots/                   — 3 tangkapan layar render asli app ini (1280x480)
shots.json                     — daftar tangkapan layar + tampilan yang diambil
```

## Data & sumber

Isi data trophy berasal dari `riset.md` job `2026-11-19-gta6-trophy-guide-01` (daftar resmi 55 trophy, terverifikasi silang Exophase + PlanetGTA6 + Output Lag). Grade Maximum Withdrawal dipakai Silver (mayoritas sumber sepakat; lihat riset §3).

## Pengujian

Lihat `~/workspace/team/jobs/2026-11-19-gta6-trophy-guide-01/produksi.md` (cara uji + hasil uji: validasi JSON, sintaks JS, uji logika filter/progres/export-import lewat Node, uji build `main.ts` + dossier, dan tangkapan layar headless Chromium).

## Lisensi / atribusi

Lisensi MIT (lihat `LICENSE`). Panduan penggemar, bukan produk resmi Rockstar Games. Panduan ditulis ulang dengan kata-kata sendiri; tiap trophy menyitir sumbernya (daftar lengkap ada di bagian "Sumber" dalam app).
