// Entrypoint penyerahan gta6-trophy-guide-01 (Node 22, pustaka standar saja).
// Panduan trophy-nya sendiri adalah folder app/ di sebelah file ini:
// berkas statis biasa yang dibuka browser di app/index.html (tanpa
// langkah build, tanpa jaringan), dan daftar + panduan ke-55 trophy
// tinggal di app/data/trophies.json. Tugas skrip ini hanya menyerahkan:
// menyalin app/ dan screenshots/ ke /output lalu menulis
// /output/dossier.json — ringkasan yang dibaca juri (tangkapan layar,
// berkas saat pertama dimuat beserta ukurannya, dan sumbernya) —
// memakai pustaka make.fun yang sudah di-vendor. Jangan ubah
// vendor/makefun-frontend.ts: penilai menuntut dossier.json sama
// persis byte demi byte dengan yang ditulis salinan pustakanya sendiri.
//
// Jalankan server dev lokal dengan `node serve.ts`, lalu buka
// http://localhost:8080. Di luar kontainer penilai, MAKEFUN_OUTPUT_DIR
// menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Ditulis ulang pada ronde rebuild-2 (20 Nov 2026): nama variabel,
// komentar, dan pesan log semuanya baru; perilaku dan isi dossier
// tidak berubah.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const folderAsal = fileURLToPath(new URL(".", import.meta.url));
const folderTujuan = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const KODE_ENTRI = "gta6-trophy-guide-01";

console.error(`[${KODE_ENTRI}] mulai menyerahkan: app/ + screenshots/ -> ${folderTujuan}`);
mkdirSync(folderTujuan, { recursive: true });

// Berhenti cepat dengan pesan yang jelas bila berkas utama hilang,
// daripada menyerahkan dossier setengah jadi.
const halamanUtama = join(folderAsal, "app", "index.html");
if (!existsSync(halamanUtama)) {
  throw new Error(`[${KODE_ENTRI}] berkas utama tidak ada: ${halamanUtama}`);
}
cpSync(join(folderAsal, "app"), join(folderTujuan, "app"), { recursive: true });
mkdirSync(join(folderTujuan, "screenshots"), { recursive: true });
const folderShot = join(folderAsal, "screenshots");
if (existsSync(folderShot)) {
  cpSync(folderShot, join(folderTujuan, "screenshots"), { recursive: true });
}

// Batas dari penilai (reference/gate.json): hanya text_max_bytes yang
// membentuk byte dossier; sisanya menolak entri yang memang akan
// ditolak penilai (lebih dari 4 tangkapan layar atau satu di atas
// 256 KiB; lebih dari 993 berkas + direktori di app/ atau 48 MiB
// berkas app/: app/ dihitung berdampingan dengan batas 1000 entri
// /output sendiri, berikut screenshots/ dan dossier.json di dalamnya).
const jalurDossier = join(folderTujuan, "dossier.json");
writeFileSync(
  jalurDossier,
  buildDossier(folderTujuan, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);

console.error(`[${KODE_ENTRI}] selesai: dossier.json tersimpan di ${jalurDossier}`);
