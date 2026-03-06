/**
 * GLOBAL CONFIGURATION
 * Sistem Keuangan Keluarga — Snifx
 *
 * v1.2.0 (Hutang & Piutang):
 *   - Tambah SHEETS.HUTANG_PIUTANG
 *   - Tambah CATEGORY.PIUTANG_OUT, PIUTANG_IN, BAYAR_HUTANG, NO_AKUN
 *   - Tambah STATUS.HP_AKTIF, HP_LUNAS
 *
 * v1.1.0 (Cicilan & CC):
 *   - Tambah SHEETS.CICILAN, tipe akun CREDIT_CARD & PAYLATER
 *   - Tambah CICILAN status constants, DSR threshold
 *
 * PENTING: Nama sheet harus sama persis dengan nama tab di Google Sheets.
 * PENTING: Nama kolom (header) harus lowercase snake_case.
 * Jalankan "Setup Schema" dari menu setelah deploy.
 */
const APP_CONFIG = {
  APP_NAME   : "Sistem Keuangan Keluarga",
  APP_VERSION: "1.2.0",
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
    CICILAN         : "Cicilan_Tracking",
    HUTANG_PIUTANG  : "Hutang_Piutang"     // v1.2 NEW
  },

  // ─── Tipe Transaksi ────────────────────────────────────────────────────────
  TIPE: {
    PENDAPATAN : "PENDAPATAN",
    PENGELUARAN: "PENGELUARAN",
    TRANSFER   : "TRANSFER"
  },

  // ─── Tipe Akun ─────────────────────────────────────────────────────────────
  TIPE_AKUN: {
    CASH       : "CASH",
    BANK       : "BANK",
    E_WALLET   : "E-WALLET",
    TABUNGAN   : "TABUNGAN",
    INVESTASI  : "INVESTASI",
    CREDIT_CARD: "CREDIT_CARD",
    PAYLATER   : "PAYLATER"
  },

  // ─── Tipe akun yang bersifat utang (saldo negatif = utang) ────────────────
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
    CICILAN_LUNAS : "LUNAS",
    // Hutang & Piutang (v1.2)
    HP_AKTIF: "AKTIF",
    HP_LUNAS: "LUNAS"
  },

  // ─── Kategori Khusus ───────────────────────────────────────────────────────
  CATEGORY: {
    ARISAN_IN         : "K005",
    ARISAN_OUT        : "K601",
    TRANSFER_ID       : "_TRANSFER_",       // tidak masuk laporan 50/30/20 & Sankey
    BAYAR_TAGIHAN_ID  : "_BAYAR_TAGIHAN_",  // v1.1: bayar tagihan CC/Paylater
    // v1.2 Hutang & Piutang
    PIUTANG_OUT       : "_PIUTANG_OUT_",    // dana keluar piutang — exclude budget, potong saldo
    PIUTANG_IN        : "_PIUTANG_IN_",     // dana kembali piutang — masuk statistik terpisah
    BAYAR_HUTANG      : "_BAYAR_HUTANG_",   // bayar hutang — exclude budget, potong saldo
    NO_AKUN           : "_NO_AKUN_"         // akun virtual hutang — tidak potong saldo
  },

  // ─── Kategori yang dikecualikan dari budget 50/30/20 ──────────────────────
  // Digunakan di getDashboardData() dan getSankeyData()
  EXCLUDE_FROM_BUDGET: [
    "_TRANSFER_",
    "_BAYAR_TAGIHAN_",
    "_PIUTANG_OUT_",
    "_PIUTANG_IN_",
    "_BAYAR_HUTANG_"
  ],

  // ─── Target Metode 50/30/20 ────────────────────────────────────────────────
  BUDGET_TARGET: {
    KEBUTUHAN: 50,
    KEINGINAN: 30,
    TABUNGAN : 20
  },

  // ─── DSR (Debt Service Ratio) Threshold ───────────────────────────────────
  DSR_THRESHOLD: {
    WARNING: 25,
    DANGER : 30
  },

  // ─── Cache TTL ─────────────────────────────────────────────────────────────
  CACHE_TTL: 21600  // 6 jam (detik)
};
