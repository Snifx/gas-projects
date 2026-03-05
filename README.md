# Google Apps Script Collections

Repositori ini berisi kumpulan solusi otomatisasi berbasis **Google Apps Script (GAS)** untuk berbagai kebutuhan administrasi dan personal. Proyek di sini dikembangkan menggunakan JavaScript/TypeScript dan dikelola secara lokal menggunakan `clasp`.

## 📂 Daftar Proyek

| Nama Proyek | Deskripsi | Status |
| :--- | :--- | :--- |
| [Sistem Administrasi RT 005](./sistem-administrasi-rt/) | Otomatisasi pendataan warga, iuran bulanan, dan pelaporan keuangan RT. | 🚀 Production |
| [Sistem Keuangan Keluarga](./sistem-keuangan-keluarga/) | Pencatatan pengeluaran otomatis dari Google Forms ke Dashboard Keuangan. | 🛠 Development |

## 🛠 Teknologi & Tooling

- **Language:** JavaScript (ES6+) / TypeScript
- **Environment:** Google Apps Script
- **Management:** [clasp](https://github.com/google/clasp) (Command Line Apps Script Projects)
- **Source Control:** GitHub

## 🚀 Alur Pengembangan Lokal

Repositori ini dikelola menggunakan `clasp` untuk sinkronisasi kode dari lokal ke skrip Google Sheets.

1.  **Clone Repo:** `git clone https://github.com/username/repo-name.git`
2.  **Install Dependencies:** `npm install`
3.  **Login ke Google:** `clasp login`
4.  **Pull Kode:** `cd folder-proyek && clasp pull`
