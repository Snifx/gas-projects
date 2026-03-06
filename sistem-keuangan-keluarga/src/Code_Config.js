/**
 * GLOBAL CONFIGURATION
 * Sistem Keuangan Keluarga — Snifx
 *
 * v2.2.0 → v1.1.0:
 *   - Tambah SHEETS.CICILAN (sheet baru Cicilan_Tracking)
 *   - Tambah tipe akun CREDIT_CARD & PAYLATER
 *   - Tambah CICILAN status constants
 *   - Tambah DSR threshold (warning 25%, danger 30%)
 *   - Tambah CATEGORY.BAYAR_TAGIHAN_ID untuk pembayaran tagihan CC
 *
 * PENTING: Nama sheet di bawah harus sama persis dengan nama tab di Google Sheets.
 * PENTING: Nama kolom (header) harus lowercase snake_case.
 * Jalankan "Setup Schema" dari menu setelah deploy untuk memastikan semua kolom ada.
 */
const APP_CONFIG = {
  APP_NAME   : "Sistem Keuangan Keluarga",
  APP_VERSION: "1.1.0",
  SCHEMA_VERSION: "2026-06",

  // ─── Nama Sheet ────────────────────────────────────────────────────────────
  SHEETS: {
    MASTER_KATEGORI : "Master_Kategori",
    MASTER_AKUN     : "Master_Akun",
    TRANSAKSI       : "Transaksi",
    BUDGET          : "Budget_Bulanan",
    BUDGET_TEMPLATE : "Budget_Template",
    REKAP           : "Rekap_Bulanan",
    SALDO           : "Saldo_Akun",
    ARISAN          : "Arisan_Tracking",
    CICILAN         : "Cicilan_Tracking"    // v1.1 NEW
  },

  // ─── Tipe Transaksi ────────────────────────────────────────────────────────
  TIPE: {
    PENDAPATAN : "PENDAPATAN",
    PENGELUARAN: "PENGELUARAN",
    TRANSFER   : "TRANSFER"   // pergeseran saldo internal antar akun (v2.2)
  },

  // ─── Tipe Akun ─────────────────────────────────────────────────────────────
  TIPE_AKUN: {
    CASH       : "CASH",
    BANK       : "BANK",
    E_WALLET   : "E-WALLET",
    TABUNGAN   : "TABUNGAN",
    INVESTASI  : "INVESTASI",
    CREDIT_CARD: "CREDIT_CARD",   // v1.1 NEW — saldo = utang (negatif)
    PAYLATER   : "PAYLATER"       // v1.1 NEW — saldo = utang (negatif)
  },

  // ─── Tipe akun yang bersifat utang (saldo negatif = utang) ────────────────
  // Digunakan di berbagai modul untuk membedakan logika saldo
  TIPE_AKUN_UTANG: ["CREDIT_CARD", "PAYLATER"],

  // ─── Status ────────────────────────────────────────────────────────────────
  STATUS: {
    // Transaksi
    HAPUS : "Y",
    AKTIF : "N",
    // Arisan
    BAYAR_SUDAH    : "SUDAH",
    BAYAR_BELUM    : "BELUM",
    DAPAT_YA       : "YA",
    DAPAT_BELUM    : "BELUM",
    ARISAN_AKTIF   : "YA",
    ARISAN_NONAKTIF: "TIDAK",
    // Master Akun & Kategori
    MASTER_AKTIF: "YA",
    MASTER_ARSIP: "TIDAK",
    // Cicilan (v1.1)
    CICILAN_AKTIF : "AKTIF",
    CICILAN_LUNAS : "LUNAS"
  },

  // ─── Kategori Khusus ───────────────────────────────────────────────────────
  CATEGORY: {
    ARISAN_IN         : "K005",
    ARISAN_OUT        : "K601",
    TRANSFER_ID       : "_TRANSFER_",      // v2.2: tidak masuk laporan 50/30/20
    BAYAR_TAGIHAN_ID  : "_BAYAR_TAGIHAN_"  // v1.1: pembayaran tagihan CC/Paylater
                                            // (hanya transfer internal, bukan pengeluaran)
  },

  // ─── Target Metode 50/30/20 ────────────────────────────────────────────────
  BUDGET_TARGET: {
    KEBUTUHAN: 50,
    KEINGINAN: 30,
    TABUNGAN : 20
  },

  // ─── DSR (Debt Service Ratio) Threshold ───────────────────────────────────
  // Persentase cicilan utang terhadap total pendapatan
  DSR_THRESHOLD: {
    WARNING: 25,   // kuning — mulai perlu waspada
    DANGER : 30    // merah  — sudah tidak sehat
  },

  // ─── Cache TTL ─────────────────────────────────────────────────────────────
  CACHE_TTL: 21600  // 6 jam (detik)
};
