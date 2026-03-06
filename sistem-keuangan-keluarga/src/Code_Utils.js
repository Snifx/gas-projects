/**
 * CORE UTILITIES
 * Semua fungsi helper yang digunakan lintas modul.
 * Standar: Pure functions, no side effects, cacheable.
 */

// ─── SHEET ACCESS ──────────────────────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" tidak ditemukan. Periksa nama sheet di Spreadsheet Anda.`);
  return sheet;
}

// ─── HEADER MAP (CACHED) ───────────────────────────────────────────────────

/**
 * Membuat/membaca map {namaKolom: indexKolom} dari baris pertama sheet.
 * Hasil di-cache selama APP_CONFIG.CACHE_TTL detik.
 */
function getHeaderMap(sheetName) {
  const cache    = CacheService.getScriptCache();
  const cacheKey = `header_map_${sheetName}`;
  const cached   = cache.get(cacheKey);

  if (cached) return JSON.parse(cached);

  const sheet   = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const map = headers.reduce((acc, header, index) => {
    const h = header ? header.toString().trim() : '';
    if (h) acc[h] = index;
    return acc;
  }, {});

  cache.put(cacheKey, JSON.stringify(map), APP_CONFIG.CACHE_TTL);
  return map;
}

// ─── ROW ↔ OBJECT MAPPING ──────────────────────────────────────────────────

/**
 * Konversi array baris ke Object berdasarkan headerMap.
 * Date object dikonversi ke ISO string agar aman di-serialize ke JSON.
 */
function mapRowToObject(row, headerMap) {
  const obj = {};
  for (const key in headerMap) {
    const val = row[headerMap[key]];
    obj[key] = val instanceof Date ? val.toISOString() : (val === undefined ? '' : val);
  }
  return obj;
}

/**
 * Konversi Object ke array baris sesuai urutan headerMap.
 * Field yang tidak ada di headerMap diabaikan.
 */
function mapObjectToRow(object, headerMap) {
  const maxIndex = Math.max(...Object.values(headerMap));
  const row = new Array(maxIndex + 1).fill('');
  for (const key in headerMap) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      row[headerMap[key]] = object[key] !== undefined && object[key] !== null ? object[key] : '';
    }
  }
  return row;
}

// ─── DATE & MONTH HELPERS ──────────────────────────────────────────────────

/**
 * Menghasilkan string format "YYYY-MM" untuk disimpan di kolom bulan.
 * Contoh: new Date('2026-02-15') → "2026-02"
 */
function formatBulan(date) {
  if (!(date instanceof Date)) date = new Date(date);
  const yyyy = date.getFullYear();
  const mm   = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${yyyy}-${mm}`;
}

/**
 * Konversi "YYYY-MM" ke nama bulan Indonesia.
 * Contoh: "2026-02" → "Februari 2026"
 */
function bulanToDisplay(isoMonth) {
  if (!isoMonth) return '';
  const str = isoMonth.toString().trim();
  const [yyyy, mm] = str.split('-');
  const months = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];
  const idx = parseInt(mm, 10) - 1;
  if (idx < 0 || idx > 11) return str;
  return `${months[idx]} ${yyyy}`;
}

/**
 * Mendapatkan bulan sekarang dalam format "YYYY-MM".
 */
function getCurrentBulanISO() {
  return formatBulan(new Date());
}

// ─── ID GENERATOR ──────────────────────────────────────────────────────────

/**
 * Generate ID Transaksi: T{YYYYMM}{SEQ_3DIGIT}
 * Contoh: T202602003
 * @param {Date}   date    - Tanggal transaksi
 * @param {number} lastRow - Nomor baris terakhir di sheet (termasuk header)
 */
function generateTrxId(date, lastRow) {
  if (!(date instanceof Date)) date = new Date(date);
  const yyyy = date.getFullYear().toString();
  const mm   = (date.getMonth() + 1).toString().padStart(2, '0');
  const seq  = Math.max(1, lastRow).toString().padStart(3, '0');
  return `T${yyyy}${mm}${seq}`;
}

// ─── CACHE INVALIDATION ────────────────────────────────────────────────────

/**
 * Hapus satu atau lebih key dari CacheService.
 */
function invalidateCache(...keys) {
  const cache = CacheService.getScriptCache();
  keys.forEach(k => cache.remove(k));
}

/**
 * Hapus semua cache yang dikenal oleh aplikasi ini.
 */
function invalidateAllCache() {
  const cache     = CacheService.getScriptCache();
  const sheetKeys = Object.values(APP_CONFIG.SHEETS).map(s => `header_map_${s}`);
  const dataKeys  = ['data_master_kategori', 'data_master_akun'];
  [...sheetKeys, ...dataKeys].forEach(k => cache.remove(k));
}

/**
 * Format angka ke string Rupiah untuk pesan log backend.
 * @param {number} angka
 * @return {string}
 */
function formatRupiah_(angka) {
  return 'Rp ' + (parseFloat(angka) || 0).toLocaleString('id-ID');
}