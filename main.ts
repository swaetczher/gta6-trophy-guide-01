// Entrypoint penyerahan gta6-trophy-guide-01 (Node 22, pustaka standar saja).
// Penulisan ketiga, ronde rebuild-3 (20 Nov 2026): nama variabel,
// komentar, dan pesan log ditulis ulang; perilaku tetap sama.
//
// Isi penyerahannya ada di folder app/ di sebelah file ini: berkas
// statis biasa yang dibuka browser lewat app/index.html (tanpa langkah
// build, tanpa jaringan), sedangkan daftar + panduan ke-55 trophy ada
// di app/data/trophies.json. Tugas skrip ini hanya menyerahkan: salin
// app/ dan screenshots/ ke /output, lalu tulis /output/dossier.json —
// ringkasan untuk juri (tangkapan layar, berkas saat pertama dimuat
// beserta ukurannya, dan sumbernya) — memakai pustaka make.fun yang
// sudah di-vendor. Jangan ubah vendor/makefun-frontend.ts: penilai
// menuntut dossier.json sama persis byte demi byte dengan yang ditulis
// salinan pustakanya sendiri.
//
// Server dev lokal: `node serve.ts`, lalu buka http://localhost:8080.
// Di luar kontainer penilai, MAKEFUN_OUTPUT_DIR menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const akarRepo = fileURLToPath(new URL(".", import.meta.url));
const keluaran = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const KODE = "gta6-trophy-guide-01";

console.error(`[${KODE}] menyerahkan: app/ + screenshots/ -> ${keluaran}`);
mkdirSync(keluaran, { recursive: true });

// Gagal cepat dengan pesan yang jelas bila berkas utama hilang,
// daripada menyerahkan dossier setengah jadi.
const berkasUtama = join(akarRepo, "app", "index.html");
if (!existsSync(berkasUtama)) {
  throw new Error(`[${KODE}] berkas utama tidak ditemukan: ${berkasUtama}`);
}
cpSync(join(akarRepo, "app"), join(keluaran, "app"), { recursive: true });
mkdirSync(join(keluaran, "screenshots"), { recursive: true });
const direktoriShot = join(akarRepo, "screenshots");
if (existsSync(direktoriShot)) {
  cpSync(direktoriShot, join(keluaran, "screenshots"), { recursive: true });
}

// Batas dari penilai (reference/gate.json): hanya text_max_bytes yang
// membentuk byte dossier; sisanya menolak entri yang memang akan
// ditolak penilai (lebih dari 4 tangkapan layar atau satu di atas
// 256 KiB; lebih dari 993 berkas + direktori di app/ atau 48 MiB
// berkas app/: app/ dihitung berdampingan dengan batas 1000 entri
// /output sendiri, berikut screenshots/ dan dossier.json di dalamnya).
const letakDossier = join(keluaran, "dossier.json");
writeFileSync(
  letakDossier,
  buildDossier(keluaran, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);

console.error(`[${KODE}] beres: dossier.json ditulis di ${letakDossier}`);
