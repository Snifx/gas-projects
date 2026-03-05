/**
 * MODUL: MAINTENANCE & TRIGGER SETUP
 * v1.1 CHANGES:
 *   - setupSchema(): tambah kolom baru v1.1
 *       Master_Akun  → limit_kredit, tgl_cetak_tagihan, tgl_jatuh_tempo
 *       Transaksi    → id_cicilan
 *       Saldo_Akun   → sisa_limit (kolom informasi, tidak di-compute oleh sheet)
 *   - setupSchema(): auto-create sheet Cicilan_Tracking jika belum ada
 *   - Fungsi lain tidak berubah
 */

// ══════════════════════════════════════════════════════════════
//  SETUP SCHEMA
// ══════════════════════════════════════════════════════════════

/**
 * Memastikan semua kolom dan sheet wajib ada.
 * Aman dijalankan berulang kali — tidak menghapus data yang ada.
 *
 * Kolom yang dikelola v1.1:
 *   Master_Akun        → limit_kredit (0), tgl_cetak_tagihan (0), tgl_jatuh_tempo (0)
 *   Transaksi          → id_cicilan ('')
 *   Saldo_Akun         → sisa_limit ('')   [computed di backend, bukan formula sheet]
 *   Sheet baru         → Cicilan_Tracking  [dibuat jika belum ada]
 *
 * Kolom dari v2.2 (tetap dikelola):
 *   Transaksi          → status_hapus, id_akun_tujuan, input_by
 *   Arisan_Tracking    → status_aktif
 *   Master_Akun        → status_aktif
 *   Master_Kategori    → status_aktif
 */
function setupSchema() {
  const ui = SpreadsheetApp.getUi();

  try {
    const log = [];

    // ── Transaksi ──────────────────────────────────────────────────────────
    log.push(_ensureColumn(APP_CONFIG.SHEETS.TRANSAKSI, 'status_hapus',   APP_CONFIG.STATUS.AKTIF));
    log.push(_ensureColumn(APP_CONFIG.SHEETS.TRANSAKSI, 'id_akun_tujuan', ''));   // v2.2
    log.push(_ensureColumn(APP_CONFIG.SHEETS.TRANSAKSI, 'input_by',       ''));   // v2.2
    log.push(_ensureColumn(APP_CONFIG.SHEETS.TRANSAKSI, 'id_cicilan',     ''));   // v1.1 NEW

    // ── Master_Akun ────────────────────────────────────────────────────────
    log.push(_ensureColumn(APP_CONFIG.SHEETS.MASTER_AKUN, 'status_aktif',        APP_CONFIG.STATUS.MASTER_AKTIF));
    log.push(_ensureColumn(APP_CONFIG.SHEETS.MASTER_AKUN, 'limit_kredit',        '0'));   // v1.1 NEW
    log.push(_ensureColumn(APP_CONFIG.SHEETS.MASTER_AKUN, 'tgl_cetak_tagihan',   '0'));   // v1.1 NEW
    log.push(_ensureColumn(APP_CONFIG.SHEETS.MASTER_AKUN, 'tgl_jatuh_tempo',     '0'));   // v1.1 NEW

    // ── Saldo_Akun ─────────────────────────────────────────────────────────
    log.push(_ensureColumn(APP_CONFIG.SHEETS.SALDO, 'sisa_limit', ''));   // v1.1 NEW (informasi saja)

    // ── Arisan_Tracking ────────────────────────────────────────────────────
    log.push(_ensureColumn(APP_CONFIG.SHEETS.ARISAN, 'status_aktif', APP_CONFIG.STATUS.ARISAN_AKTIF));

    // ── Master_Kategori ────────────────────────────────────────────────────
    log.push(_ensureColumn(APP_CONFIG.SHEETS.MASTER_KATEGORI, 'status_aktif', APP_CONFIG.STATUS.MASTER_AKTIF));

    // ── Cicilan_Tracking (v1.1 NEW — buat sheet jika belum ada) ───────────
    log.push(_ensureCicilanSheet());

    // Bersihkan cache
    invalidateAllCache();

    const summary = log.join('\n');
    console.log('setupSchema v1.1 selesai:\n' + summary);

    ui.alert(
      '✅ Setup Schema v1.1 Selesai',
      summary + '\n\nCache telah dibersihkan.\nFitur Kartu Kredit & Cicilan siap digunakan.',
      ui.ButtonSet.OK
    );

  } catch (e) {
    console.error('setupSchema error:', e.message, e.stack);
    ui.alert('❌ Error saat Setup Schema', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Memastikan sheet Cicilan_Tracking ada dengan header lengkap.
 * Jika sudah ada → tidak mengubah apapun.
 * Jika belum ada → buat sheet baru dengan header dan freeze row.
 * @return {string} Pesan log
 */
function _ensureCicilanSheet() {
  const sheetName = APP_CONFIG.SHEETS.CICILAN;
  const ss        = SpreadsheetApp.getActiveSpreadsheet();

  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    return `✔ Sheet "${sheetName}" sudah ada.`;
  }

  // Buat sheet baru
  sheet = ss.insertSheet(sheetName);

  // Header sesuai schema Cicilan_Tracking
  const headers = [
    'id_cicilan',
    'id_transaksi_awal',
    'id_akun_kredit',
    'nama_barang',
    'total_harga',
    'tenor_bulan',
    'cicilan_per_bulan',
    'sisa_tenor',
    'total_terbayar',
    'tgl_jatuh_tempo',
    'status',
    'keterangan'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header: bold, background hijau gelap, teks putih
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#076653');
  headerRange.setFontColor('#ffffff');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Auto-resize kolom
  sheet.autoResizeColumns(1, headers.length);

  return `➕ Sheet "${sheetName}" berhasil dibuat dengan ${headers.length} kolom.`;
}

/**
 * Helper: Menambahkan kolom ke sheet jika belum ada.
 * Mengisi semua baris data yang ada dengan nilai default.
 *
 * @param  {string} sheetName    - Nama sheet
 * @param  {string} columnName   - Nama kolom (header)
 * @param  {string} defaultValue - Nilai default untuk baris yang ada
 * @return {string} - Pesan log hasil operasi
 */
function _ensureColumn(sheetName, columnName, defaultValue) {
  const sheet   = getSheet(sheetName);
  const lastCol = sheet.getLastColumn();

  if (lastCol === 0) return `⚠️ Sheet "${sheetName}" kosong, skip.`;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const exists  = headers.map(h => (h || '').toString().trim()).includes(columnName);

  if (exists) {
    return `✔ Kolom "${columnName}" sudah ada di sheet "${sheetName}".`;
  }

  const newColIndex = lastCol + 1;
  sheet.getRange(1, newColIndex).setValue(columnName);

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const defaults = Array.from({ length: lastRow - 1 }, () => [defaultValue]);
    sheet.getRange(2, newColIndex, lastRow - 1, 1).setValues(defaults);
  }

  return `➕ Kolom "${columnName}" ditambahkan ke "${sheetName}" (${lastRow - 1} baris diisi "${defaultValue}").`;
}


// ══════════════════════════════════════════════════════════════
//  CACHE MANAGEMENT (tidak berubah)
// ══════════════════════════════════════════════════════════════

function clearAllAppCache() {
  try {
    invalidateAllCache();
    const msg = 'Cache sistem berhasil dibersihkan pada ' + new Date().toLocaleString('id-ID');
    console.log(msg);
    try { SpreadsheetApp.getUi().alert('✅ Cache Dibersihkan', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (_) {}
    return { success: true, message: msg };
  } catch (e) {
    console.error('clearAllAppCache error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  TRIGGER SETUP (tidak berubah)
// ══════════════════════════════════════════════════════════════

function setupDailyTriggers() {
  const ui = SpreadsheetApp.getUi();
  try {
    const allTriggers = ScriptApp.getProjectTriggers();
    let removed = 0;
    allTriggers.forEach(t => {
      if (t.getHandlerFunction() === 'clearAllAppCache') {
        ScriptApp.deleteTrigger(t); removed++;
      }
    });

    ScriptApp.newTrigger('clearAllAppCache')
      .timeBased().everyDays(1).atHour(0).create();

    const msg = `Trigger harian berhasil dipasang.\n${removed > 0 ? `${removed} trigger lama dihapus.\n` : ''}Cache dibersihkan otomatis tiap hari jam 00:00–01:00.`;
    console.log(msg);
    ui.alert('✅ Trigger Dipasang', msg, ui.ButtonSet.OK);
  } catch (e) {
    console.error('setupDailyTriggers error:', e.message);
    ui.alert('❌ Error', 'Gagal memasang trigger: ' + e.message, ui.ButtonSet.OK);
  }
}
