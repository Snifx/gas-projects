# Sistem Administrasi RT 005

Aplikasi web berbasis **Google Apps Script** untuk mengelola administrasi RT 005, RW 006, Kelurahan Jatibening Baru, Kecamatan Pondokgede, Kota Bekasi.

**Versi:** 2.5

---

## Fitur Utama

- **Data Rumah** — CRUD data rumah beserta info jumlah jiwa, kendaraan, dan status hunian
- **Kartu Keluarga (KK)** — Pencatatan data anggota keluarga per rumah
- **Komponen & Iuran** — Manajemen komponen iuran dan kalkulasi iuran bulanan per rumah
- **Tagihan Bulanan** — Generate tagihan 12 bulan sekaligus, manajemen tunggakan, dan pelunasan
- **Kas RT** — Pencatatan pemasukan dan pengeluaran kas RT dengan ringkasan saldo
- **Autentikasi** — Login berbasis role (Admin / Pengurus / User) via sheet Pengurus

---

## Teknologi

| Komponen | Detail |
|---|---|
| Platform | Google Apps Script (GAS) |
| Runtime | V8 |
| Antarmuka | HTML Service (Web App) |
| Penyimpanan | Google Sheets |
| Timezone | Asia/Bangkok |
| Akses | `ANYONE_ANONYMOUS` |

---

## Struktur Proyek

```
sistem-administrasi-rt/
├── appsscript.json              # Konfigurasi GAS (runtime, timezone, webapp)
├── .clasp.json                  # Konfigurasi clasp CLI
├── .claspignore                 # File yang dikecualikan saat push
├── README.md
└── src/
    ├── Config_Constants.js      # Konstanta aplikasi (CONFIG)
    ├── Config_SheetColumns.js   # Indeks kolom semua sheet (COLUMNS)
    ├── Main.js                  # Entry point web app & handler API frontend
    ├── Index.html               # Antarmuka pengguna (SPA)
    │
    ├── Model_Rumah.js           # CRUD sheet Data_Rumah
    ├── Model_KK.js              # CRUD sheet Kartu_Keluarga
    ├── Model_Iuran.js           # CRUD sheet Iuran_Rumah
    ├── Model_Komponen.js        # CRUD sheet Komponen_Iuran
    ├── Model_Kategori.js        # CRUD sheet Kategori
    ├── Model_Tagihan.js         # CRUD sheet Tagihan_Bulanan
    ├── Model_Transaksi.js       # CRUD sheet Transaksi_Kas
    │
    ├── Service_Auth.js          # Autentikasi & otorisasi
    ├── Service_Rumah.js         # Business logic data rumah
    ├── Service_KK.js            # Business logic kartu keluarga
    ├── Service_Iuran.js         # Business logic iuran
    ├── Service_Tagihan.js       # Business logic tagihan & tunggakan
    ├── Service_Transaksi.js     # Business logic kas RT
    │
    ├── Utils_Date.js            # Utilitas tanggal
    ├── Utils_Number.js          # Utilitas angka
    ├── Utils_String.js          # Utilitas string
    │
    └── Migration_Fix_tanggal_lunas.js  # Script migrasi data
```

---

## Struktur Google Sheets

Aplikasi membutuhkan satu Spreadsheet dengan sheet-sheet berikut:

| Sheet | Deskripsi | Kolom Utama |
|---|---|---|
| `Data_Rumah` | Data unit rumah | Rumah_ID, Nama_Jalan, Nomor_Rumah, Jumlah_Jiwa, Mobil, Motor, Status, Total_Iuran, Tunggakan |
| `Kartu_Keluarga` | Data anggota keluarga | KK_ID, Rumah_ID, NIK, Nama, Status, Jenis_Kelamin, Tanggal_Lahir, Agama, Pekerjaan, dll |
| `Iuran_Rumah` | Konfigurasi iuran per rumah | Rumah_ID, Komponen_ID, Nominal_Default, Nominal_Override, Qty, Total |
| `Komponen_Iuran` | Daftar komponen iuran | Komponen_ID, Nama_Komponen, Satuan, Nominal, Status |
| `Kategori` | Kategori umum (jenis kelamin, agama, dll) | Tipe, Nilai, Status |
| `Pengurus` | Akun pengguna sistem | Username, Password, Nama, Jabatan, Role, Status |
| `Tagihan_Bulanan` | Tagihan iuran & tunggakan per rumah | Tagihan_ID, Rumah_ID, Periode, Total_Tagihan, Total_Terbayar, Sisa, Status, Tanggal_Lunas |
| `Transaksi_Kas` | Pencatatan kas masuk & keluar | Transaksi_ID, Tanggal, Jenis, Kategori_ID, Nominal, Tagihan_ID, Metode_Pembayaran |
| `Kategori_pembukuan` | Kategori transaksi kas | Kategori_ID, Nama_Kategori, Deskripsi, Tipe, Status |

---

## Format ID Otomatis

| Entitas | Contoh ID |
|---|---|
| Rumah | `RM000000001` |
| Kartu Keluarga | `KK000000001` |
| Komponen Iuran | `KI000000001` |
| Tagihan | `TG000000001` |
| Transaksi | `TR000000001` |

ID di-generate otomatis dengan melanjutkan nomor urut tertinggi yang sudah ada di sheet.

---

## Role & Hak Akses

| Role | Deskripsi |
|---|---|
| `Admin` | Akses penuh ke seluruh fitur |
| `Pengurus` | Akses operasional (input data, catat pembayaran) |
| `User` | Akses terbatas (lihat data) |

Akun dikelola di sheet `Pengurus`. Password disimpan dalam plain text — **tidak disarankan untuk produksi skala besar**.

---

## Deployment

### Prasyarat

- Akun Google
- [clasp CLI](https://github.com/google/clasp) terinstall (`npm install -g @google/clasp`)
- Node.js

### Langkah Deploy

1. **Login clasp**
   ```bash
   clasp login
   ```

2. **Clone atau buat project GAS**
   ```bash
   # Jika project sudah ada (gunakan Script ID dari .clasp.json)
   clasp clone <scriptId>

   # Atau buat baru
   clasp create --type webapp --title "Sistem Administrasi RT 005"
   ```

3. **Push kode ke GAS**
   ```bash
   cd sistem-administrasi-rt
   clasp push
   ```

4. **Deploy sebagai Web App**
   - Buka [script.google.com](https://script.google.com)
   - Pilih project → **Deploy** → **New deployment**
   - Tipe: **Web app**
   - Execute as: `User deploying the web app`
   - Who has access: `Anyone` (atau sesuaikan kebutuhan)
   - Klik **Deploy** dan catat URL yang dihasilkan

5. **Hubungkan ke Spreadsheet**
   - Pastikan script dijalankan dari Spreadsheet yang berisi semua sheet yang dibutuhkan
   - Atau buka Spreadsheet → **Extensions** → **Apps Script** lalu paste kode secara manual

---

## Konfigurasi Awal

Setelah deploy, lakukan setup berikut di Google Sheets:

1. Buat semua sheet sesuai daftar di atas dengan header kolom yang tepat
2. Isi minimal satu baris di sheet `Pengurus` dengan:
   - `Username`: nama pengguna admin
   - `Password`: kata sandi
   - `Role`: `Admin`
   - `Status`: `Aktif`
3. Isi sheet `Komponen_Iuran` dengan komponen iuran yang berlaku (misalnya: Iuran Keamanan, Kebersihan, dll)
4. Isi sheet `Kategori_pembukuan` dengan kategori kas (misalnya: Iuran RT, Operasional, dll)

---

## Penggunaan

### Generate Tagihan Tahunan

1. Pastikan data rumah dan komponen iuran sudah terisi
2. Di halaman Tagihan, pilih rumah dan tahun
3. Klik **Generate Tagihan** → sistem akan membuat 12 tagihan bulanan otomatis

### Catat Pembayaran

1. Buka halaman Tagihan untuk rumah yang bersangkutan
2. Pilih tagihan yang dibayar
3. Input nominal dan metode pembayaran
4. Sistem otomatis memperbarui status tagihan (Lunas / Belum Lunas) dan mencatat ke Transaksi_Kas

### Import Tunggakan

Untuk memasukkan tunggakan dari periode sebelumnya:
1. Buka halaman Tagihan rumah terkait
2. Gunakan fitur **Import Tunggakan**
3. Input nominal dan keterangan tunggakan

---

## Pengembangan Lokal

```bash
# Tarik kode terbaru dari GAS
clasp pull

# Push perubahan ke GAS
clasp push

# Buka editor GAS di browser
clasp open
```

---

## Catatan Teknis

- Seluruh data disimpan di Google Sheets; tidak ada database eksternal
- Indeks kolom sheet didefinisikan di `Config_SheetColumns.js` (0-based). Jika struktur sheet berubah, update file ini
- Session autentikasi dikelola di sisi client menggunakan `sessionStorage` browser
- Timezone default: **Asia/Bangkok** (WIB + 0, setara UTC+7)
- File `Migration_Fix_tanggal_lunas.js` hanya digunakan untuk migrasi data sekali jalan

---

## Lisensi

Proyek ini dibuat untuk keperluan internal administrasi RT 005, RW 006, Jatibening Baru.
