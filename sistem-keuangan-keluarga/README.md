# 💰 Sistem Keuangan Keluarga (Google Sheets + Apps Script)

[![Snifx](https://img.shields.io/badge/Powered%20By-Snifx-blue)](https://github.com/username-anda)
[![Platform](https://img.shields.io/badge/Platform-Google%20Sheets-green)](https://www.google.com/sheets/about/)
[![Language](https://img.shields.io/badge/Language-Google%20Apps%20Script-yellow)](https://developers.google.com/apps-script)

Sistem manajemen keuangan personal/keluarga berbasis Google Sheets yang dilengkapi dengan otomatisasi **Google Apps Script**. Sistem ini dirancang untuk memantau arus kas (cash flow), pengelolaan budget, pelacakan saldo antar akun (bank/e-wallet), hingga monitoring arisan secara real-time.

---

## 🚀 Fitur Utama

- **Otomatisasi Input:** Skrip untuk mempercepat input data transaksi tanpa perlu mengisi tabel secara manual.
- **Multi-Account Tracking:** Pantau saldo di berbagai rekening bank, e-wallet, dan uang tunai secara konsolidasi.
- **Budgeting 50/30/20:** Analisis otomatis pengeluaran berdasarkan pos Kebutuhan, Keinginan, dan Tabungan/Investasi.
- **Arisan Monitoring:** Pelacakan status pembayaran dan giliran arisan yang terintegrasi dengan arus kas.
- **Rekap Bulanan Otomatis:** Laporan performa keuangan yang dihasilkan secara otomatis setiap bulan.

## 📂 Struktur Repositori

- `/src`: Berisi file `.gs` (Google Apps Script) untuk logika otomatisasi.
- `/templates`: Contoh struktur file CSV/Google Sheets yang digunakan.
- `README.md`: Dokumentasi proyek.

## 🛠️ Teknologi yang Digunakan

- **Google Sheets**: Sebagai basis data dan antarmuka pengguna (UI).
- **Google Apps Script (JavaScript based)**: Sebagai engine otomatisasi backend.
- **GitHub**: Untuk version control dan manajemen kode.

## ⚙️ Cara Instalasi (Development)

1. **Clone Repositori:**
   ```bash
   git clone [https://github.com/username-anda/nama-repo.git](https://github.com/Snifx/Apps_Script-Sistem_Keuangan_Keluarga.git)
2. **Setup Google Sheets:**
Buat Google Sheets baru dan sesuaikan nama sheet sesuai dengan master data (Transaksi, Master_Akun, Master_Kategori, dll).

3. **Copy-Paste Script:**
Buka Extensions > Apps Script di Google Sheets Anda, lalu salin kode dari file di folder src ke dalam editor Apps Script.

4. **Setup Trigger:**
Konfigurasikan trigger (seperti onEdit atau time-based trigger) melalui dashboard Apps Script jika diperlukan.

## 📋 Struktur Data
Sistem ini menggunakan beberapa tabel utama:

1. Master_Kategori: Pengelompokan jenis transaksi.
2. Master_Akun: Daftar dompet/bank yang dimiliki.
3. Transaksi: Log harian pendapatan dan pengeluaran.
4. Arisan_Tracking: Monitoring khusus kegiatan arisan.

## 🛡️ Lisensi
Proyek ini dikembangkan oleh Snifx. Distribusi dan penggunaan untuk komersial harap menghubungi pengembang.
