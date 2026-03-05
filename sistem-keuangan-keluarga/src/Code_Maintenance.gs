/**
 * MODUL: MAINTENANCE & TRIGGER SETUP
 * Fokus: Schema migration, cache management, trigger automation.
 *
 * v2.0: setupSchema() menambahkan kolom status_aktif ke Master_Akun & Master_Kategori.
 * v2.2: setupSchema() menambahkan kolom id_akun_tujuan dan input_by ke sheet Transaksi
 *       untuk mendukung fitur Transfer Antar Akun dan Multi-User Audit Trail.
 */

// ══════════════════════════════════════════════════════════════
//  SETUP SCHEMA
// ══════════════════════════════════════════════════════════════

/**
 * Memastikan semua kolom wajib ada di setiap sheet.
 * Aman dijalankan berulang kali — tidak menghapus data yang ada.
 *
 * Kolom yang dikelola:
 *   Transaksi       → status_hapus    (default: 'N')
 *   Transaksi       → id_akun_tujuan  (default: '')   [v2.2 Transfer]
 *   Transaksi       → input_by        (default: '')   [v2.2 Multi-User]
 *   Arisan_Tracking → status_aktif    (default: 'YA')
 *   Master_Akun     → status_aktif    (default: 'YA')
 *   Master_Kategori → status_aktif    (default: 'YA')
 *
 * Dipanggil dari menu: Administrasi → Setup Schema
 */
function setupSchema() {
  const ui = SpreadsheetApp.getUi();

  try {
    const log = [];

    // ── Transaksi ──────────────────────────────────────────────────────────
    log.push(_ensureColumn(APP_CONFIG.SHEETS.TRANSAKSI, 'status_hapus',   APP_CONFIG.STATUS.AKTIF));
    log.push(_ensureColumn(APP_CONFIG.SHEETS.TRANSAKSI, 'id_akun_tujuan', ''));   // v2.2: Transfer
    log.push(_ensureColumn(APP_CONFIG.SHEETS.TRANSAKSI, 'input_by',       ''));   // v2.2: Audit trail

    // ── Arisan_Tracking ────────────────────────────────────────────────────
    log.push(_ensureColumn(APP_CONFIG.SHEETS.ARISAN, 'status_aktif', APP_CONFIG.STATUS.ARISAN_AKTIF));

    // ── Master_Akun ────────────────────────────────────────────────────────
    log.push(_ensureColumn(APP_CONFIG.SHEETS.MASTER_AKUN, 'status_aktif', APP_CONFIG.STATUS.MASTER_AKTIF));

    // ── Master_Kategori ────────────────────────────────────────────────────
    log.push(_ensureColumn(APP_CONFIG.SHEETS.MASTER_KATEGORI, 'status_aktif', APP_CONFIG.STATUS.MASTER_AKTIF));

    // Bersihkan semua cache agar headerMap di-regenerasi
    invalidateAllCache();

    const summary = log.join('\n');
    console.log('setupSchema selesai:\n' + summary);

    ui.alert(
      '✅ Setup Schema v2.2 Selesai',
      summary + '\n\nCache telah dibersihkan. Fitur Transfer dan Audit Trail siap digunakan.',
      ui.ButtonSet.OK
    );

  } catch (e) {
    console.error('setupSchema error:', e.message, e.stack);
    ui.alert('❌ Error saat Setup Schema', e.message, ui.ButtonSet.OK);
  }
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

  return `➕ Kolom "${columnName}" berhasil ditambahkan ke sheet "${sheetName}" (${lastRow - 1} baris diisi "${defaultValue}").`;
}


// ══════════════════════════════════════════════════════════════
//  CACHE MANAGEMENT
// ══════════════════════════════════════════════════════════════

function clearAllAppCache() {
  try {
    invalidateAllCache();

    const msg = 'Cache sistem berhasil dibersihkan pada ' + new Date().toLocaleString('id-ID');
    console.log(msg);

    try {
      SpreadsheetApp.getUi().alert('✅ Cache Dibersihkan', msg, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (_) { }

    return { success: true, message: msg };

  } catch (e) {
    console.error('clearAllAppCache error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  TRIGGER SETUP
// ══════════════════════════════════════════════════════════════

function setupDailyTriggers() {
  const ui = SpreadsheetApp.getUi();

  try {
    const allTriggers = ScriptApp.getProjectTriggers();
    let removed = 0;
    allTriggers.forEach(t => {
      if (t.getHandlerFunction() === 'clearAllAppCache') {
        ScriptApp.deleteTrigger(t);
        removed++;
      }
    });

    ScriptApp.newTrigger('clearAllAppCache')
      .timeBased()
      .everyDays(1)
      .atHour(0)
      .create();

    const msg = `Trigger harian berhasil dipasang.\n${removed > 0 ? `${removed} trigger lama dihapus.\n` : ''}Pembersihan cache akan berjalan otomatis tiap hari jam 00:00–01:00.`;
    console.log(msg);
    ui.alert('✅ Trigger Dipasang', msg, ui.ButtonSet.OK);

  } catch (e) {
    console.error('setupDailyTriggers error:', e.message);
    ui.alert('❌ Error', 'Gagal memasang trigger: ' + e.message, ui.ButtonSet.OK);
  }
}
