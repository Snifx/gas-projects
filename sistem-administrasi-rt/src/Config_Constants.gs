/**
 * Config_Constants.gs
 * Application constants and configuration
 * Version: 2.1 - Added Tagihan, Transaksi, Kategori Pembukuan
 * Last Updated: 2026-02-03
 */

// ============================================
// SPREADSHEET REFERENCE - MUST BE FIRST!
// ============================================
/**
 * Global Spreadsheet reference
 * This MUST be defined before any other code that uses it
 */
const SS = SpreadsheetApp.getActiveSpreadsheet();

// ============================================
// MAIN CONFIGURATION
// ============================================

/**
 * Main CONFIG object
 * Contains all application constants
 */
const CONFIG = {
  /**
   * Application info
   */
  APP: {
    NAME: 'Sistem Administrasi RT 005',
    VERSION: '2.5',
    AUTHOR: 'RT 005 Admin',
    RT_NAME: 'RT 005',
    RW_NAME: 'RW 006',
    KELURAHAN: 'Jatibening Baru',
    KECAMATAN: 'Pondokgede',
    KOTA: 'Kota Bekasi'
  },
  
  /**
   * Sheet names mapping
   * Maps logical names to actual Google Sheet names
   */
  SHEET_NAMES: {
    DATA_RUMAH: 'Data_Rumah',
    KARTU_KELUARGA: 'Kartu_Keluarga',
    IURAN_RUMAH: 'Iuran_Rumah',
    KOMPONEN_IURAN: 'Komponen_Iuran',
    KATEGORI: 'Kategori',
    PENGURUS: 'Pengurus',
    // ===== TAMBAHAN BARU =====
    TAGIHAN_BULANAN: 'Tagihan_Bulanan',
    TRANSAKSI_KAS: 'Transaksi_Kas',
    KATEGORI_PEMBUKUAN: 'Kategori_pembukuan'
  },
  
  /**
   * ID prefixes for auto-generated IDs
   */
  ID_PREFIX: {
    RUMAH: 'RM',
    KK: 'KK',
    KOMPONEN: 'KI',
    KATEGORI: 'KAT',
    // ===== TAMBAHAN BARU =====
    TAGIHAN: 'TG',
    TRANSAKSI: 'TR',
    KATEGORI_PEMBUKUAN: 'KAT'
  },
  
  /**
   * ID lengths (total including prefix)
   */
  ID_LENGTH: {
    RUMAH: 11,      // RM000000001
    KK: 11,         // KK000000001
    KOMPONEN: 12,   // KI_000000001
    KATEGORI: 12,   // KAT000000001
    // ===== TAMBAHAN BARU =====
    TAGIHAN: 12,    // TG000000001
    TRANSAKSI: 12,  // TR000000001
    KATEGORI_PEMBUKUAN: 12  // KAT000000001
  },
  
  /**
   * Authentication settings
   */
  AUTH: {
    ADMIN_ROLE: 'Admin',
    DEFAULT_ROLE: 'User'
  },
  
  /**
   * Success messages
   */
  SUCCESS_MESSAGES: {
    DATA_CREATED: 'Data berhasil ditambahkan',
    DATA_UPDATED: 'Data berhasil diperbarui',
    DATA_DELETED: 'Data berhasil dihapus',
    LOGIN_SUCCESS: 'Login berhasil'
  },
  
  /**
   * Error messages
   */
  ERROR_MESSAGES: {
    SHEET_NOT_FOUND: 'Sheet tidak ditemukan',
    DATA_NOT_FOUND: 'Data tidak ditemukan',
    INVALID_DATA: 'Data tidak valid',
    PERMISSION_DENIED: 'Akses ditolak',
    SYSTEM_ERROR: 'Terjadi kesalahan sistem',
    AUTHENTICATION_FAILED: 'Username atau password salah',
    UNKNOWN_ERROR: 'Terjadi kesalahan yang tidak diketahui'
  },
  
  /**
   * Validation rules
   */
  VALIDATION: {
    NIK_LENGTH: 16,
    NO_KK_LENGTH: 16,
    MIN_USERNAME_LENGTH: 3,
    MIN_PASSWORD_LENGTH: 3
  },
  
  /**
   * Format settings
   */
  FORMAT: {
    CURRENCY: 'Rp ',
    DATE_FORMAT: 'yyyy-MM-dd',
    DATETIME_FORMAT: 'yyyy-MM-dd HH:mm:ss'
  },
  
  /**
   * Status values
   */
  STATUS: {
    ACTIVE: 'Aktif',
    INACTIVE: 'Tidak Aktif',
    BERPENGHUNI: 'Berpenghuni',
    KOSONG: 'Kosong'
  },
  
  /**
   * Role values
   */
  ROLES: {
    ADMIN: 'Admin',
    PENGURUS: 'Pengurus',
    USER: 'User'
  }
};

/**
 * Freeze CONFIG to prevent modifications
 * This ensures CONFIG values cannot be changed at runtime
 */
Object.freeze(CONFIG);

/**
 * Test function to verify CONFIG and SS are loaded
 */
function testConfig() {
  console.log('=== Testing CONFIG & SS ===');
  
  // Test SS
  console.log('SS defined:', typeof SS !== 'undefined');
  if (typeof SS !== 'undefined') {
    console.log('Spreadsheet name:', SS.getName());
  }
  console.log('');
  
  // Test CONFIG
  console.log('App Name:', CONFIG.APP.NAME);
  console.log('Version:', CONFIG.APP.VERSION);
  console.log('');
  
  console.log('Sheet Names:');
  for (const [key, value] of Object.entries(CONFIG.SHEET_NAMES)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('');
  
  console.log('✅ CONFIG loaded successfully!');
}
