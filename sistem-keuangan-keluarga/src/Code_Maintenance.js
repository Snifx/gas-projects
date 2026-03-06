/**
 * MODUL: MAINTENANCE ENGINE
 * v1.2 CHANGES:
 *   - setupSchema(): buat sheet Hutang_Piutang jika belum ada
 *   - setupSchema(): tambah kolom id_hp ke sheet Transaksi jika belum ada
 *   - Schema Hutang_Piutang: 13 kolom sesuai spesifikasi
 *
 * v1.1 CHANGES:
 *   - setupSchema(): buat sheet Cicilan_Tracking
 *   - setupSchema(): tambah kolom id_cicilan ke sheet Transaksi
 */

// ══════════════════════════════════════════════════════════════
//  SCHEMA DEFINITIONS
// ══════════════════════════════════════════════════════════════

const SCHEMA = {
  Master_Kategori: {
    headers: ['id_kategori', 'nama_kategori', 'tipe', 'pos', 'deskripsi', 'warna', 'urutan', 'aktif'],
    freeze : 1,
    widths : [120, 200, 120, 120, 250, 80, 70, 60]
  },
  Master_Akun: {
    headers: ['id_akun', 'nama_akun', 'tipe_akun', 'saldo_awal', 'limit_kredit', 'tgl_jatuh_tempo', 'aktif', 'keterangan'],
    freeze : 1,
    widths : [120, 200, 120, 130, 130, 130, 60, 200]
  },
  Transaksi: {
    headers: [
      'id_transaksi', 'tanggal', 'bulan', 'id_akun', 'id_kategori',
      'tipe', 'jumlah', 'deskripsi', 'metode_bayar', 'anggota_keluarga',
      'catatan', 'status_hapus', 'input_by', 'id_akun_tujuan',
      'id_cicilan',  // v1.1
      'id_hp'        // v1.2
    ],
    freeze: 1,
    widths: [150, 100, 90, 120, 120, 110, 120, 250, 110, 130, 200, 90, 180, 120, 130, 130]
  },
  Budget_Bulanan: {
    headers: ['id_budget', 'bulan', 'id_kategori', 'nama_kategori', 'pos', 'budget', 'keterangan'],
    freeze : 1,
    widths : [130, 80, 120, 200, 120, 130, 200]
  },
  Budget_Template: {
    headers: ['id_template', 'nama_template', 'id_kategori', 'nama_kategori', 'pos', 'budget', 'aktif'],
    freeze : 1,
    widths : [130, 200, 120, 200, 120, 130, 60]
  },
  Rekap_Bulanan: {
    headers: ['bulan', 'total_pendapatan', 'total_pengeluaran', 'surplus', 'total_kebutuhan', 'total_keinginan', 'total_tabungan', 'terakhir_update'],
    freeze : 1,
    widths : [90, 150, 150, 130, 140, 140, 130, 160]
  },
  Saldo_Akun: {
    headers: ['id_akun', 'nama_akun', 'tipe_akun', 'saldo_awal', 'total_masuk', 'total_keluar', 'saldo_akhir', 'limit_kredit', 'sisa_limit', 'tgl_jatuh_tempo', 'terakhir_update'],
    freeze : 1,
    widths : [120, 200, 120, 130, 130, 130, 130, 130, 120, 130, 160]
  },
  Arisan_Tracking: {
    headers: ['id_arisan', 'nama_grup', 'nominal_iuran', 'total_peserta', 'periode', 'tanggal_mulai', 'tanggal_selesai', 'total_dapat', 'sudah_dapat', 'aktif', 'keterangan'],
    freeze : 1,
    widths : [130, 200, 130, 110, 100, 120, 120, 120, 100, 60, 200]
  },
  // v1.1
  Cicilan_Tracking: {
    headers: [
      'id_cicilan', 'id_transaksi_awal', 'id_akun_kredit', 'nama_barang',
      'total_harga', 'tenor_bulan', 'cicilan_per_bulan', 'sudah_terbayar',
      'sisa_cicilan', 'tanggal_mulai', 'tanggal_lunas_est', 'status', 'keterangan'
    ],
    freeze : 1,
    widths : [130, 150, 120, 250, 130, 110, 140, 130, 120, 120, 140, 80, 200]
  },
  // v1.2 NEW
  Hutang_Piutang: {
    headers: [
      'id_hp', 'tipe', 'nama_pihak', 'deskripsi',
      'id_kategori', 'nama_kategori', 'id_akun',
      'total_pinjaman', 'total_terbayar',
      'tanggal_mulai', 'tanggal_jatuh_tempo',
      'status', 'keterangan'
    ],
    freeze : 1,
    widths : [130, 80, 200, 250, 120, 180, 120, 140, 140, 120, 140, 80, 200]
  }
};


// ══════════════════════════════════════════════════════════════
//  MAIN: SETUP SCHEMA
// ══════════════════════════════════════════════════════════════

/**
 * Menginisialisasi / memperbarui skema semua sheet.
 * Safe to re-run — tidak akan menghapus data.
 */
function setupSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const results = [];

  Object.entries(SCHEMA).forEach(([sheetName, schemaDef]) => {
    try {
      let sheet = ss.getSheetByName(sheetName);
      let created = false;

      if (!sheet) {
        sheet   = ss.insertSheet(sheetName);
        created = true;
      }

      _ensureHeaders(sheet, schemaDef.headers, schemaDef.widths || []);
      if (schemaDef.freeze) sheet.setFrozenRows(schemaDef.freeze);

      results.push({ sheet: sheetName, status: created ? 'CREATED' : 'UPDATED' });

    } catch (err) {
      results.push({ sheet: sheetName, status: 'ERROR', error: err.message });
      console.error(`setupSchema [${sheetName}]:`, err.message);
    }
  });

  // ── v1.1 Migration: tambah id_cicilan ke Transaksi ─────────────────────────
  _migrateAddColumn(ss, 'Transaksi', 'id_cicilan', 120);

  // ── v1.2 Migration: tambah id_hp ke Transaksi ──────────────────────────────
  _migrateAddColumn(ss, 'Transaksi', 'id_hp', 130);

  // Tampilkan laporan ke console
  console.log('setupSchema results:', JSON.stringify(results, null, 2));

  const allOk   = results.every(r => r.status !== 'ERROR');
  const created = results.filter(r => r.status === 'CREATED').map(r => r.sheet);
  const updated = results.filter(r => r.status === 'UPDATED').map(r => r.sheet);

  return {
    success: allOk,
    message: `Schema setup selesai. Dibuat: [${created.join(', ')}]. Diperbarui: [${updated.join(', ')}].`,
    results: results
  };
}

/**
 * Memastikan header sheet sesuai schema.
 * - Jika sheet kosong → tulis header baru
 * - Jika header sudah ada → tambah kolom yang belum ada (non-destructive)
 * @private
 */
function _ensureHeaders(sheet, headers, widths) {
  const lastCol = sheet.getLastColumn();

  if (lastCol === 0) {
    // Sheet kosong — tulis header baru
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#D3E3FD');
    headerRange.setWrap(false);

    if (widths && widths.length) {
      widths.forEach((w, i) => {
        if (w) sheet.setColumnWidth(i + 1, w);
      });
    }
    return;
  }

  // Sheet sudah ada header — bandingkan dan tambah kolom baru di akhir
  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const existingSet     = new Set(existingHeaders.map(h => h.toString().toLowerCase().trim()));

  headers.forEach((h, i) => {
    if (!existingSet.has(h.toLowerCase().trim())) {
      const newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(h).setFontWeight('bold').setBackground('#D3E3FD');
      if (widths && widths[i]) sheet.setColumnWidth(newCol, widths[i]);
      console.log(`_ensureHeaders: added column "${h}" to "${sheet.getName()}" at col ${newCol}`);
    }
  });
}

/**
 * Migrasi non-destructive: tambah kolom ke sheet yang sudah ada jika belum ada.
 * @private
 */
function _migrateAddColumn(ss, sheetName, colName, width) {
  try {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const lastCol       = sheet.getLastColumn();
    if (lastCol === 0)  return;

    const headerRow     = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const existingNames = headerRow.map(h => h.toString().toLowerCase().trim());

    if (!existingNames.includes(colName.toLowerCase())) {
      const newColIdx = lastCol + 1;
      sheet.getRange(1, newColIdx).setValue(colName).setFontWeight('bold').setBackground('#D3E3FD');
      if (width) sheet.setColumnWidth(newColIdx, width);
      console.log(`_migrateAddColumn: added "${colName}" to "${sheetName}" at col ${newColIdx}`);
    }

  } catch (e) {
    console.error(`_migrateAddColumn [${sheetName}/${colName}]:`, e.message);
  }
}


// ══════════════════════════════════════════════════════════════
//  CACHE UTILITIES (used by Code_Config / others)
// ══════════════════════════════════════════════════════════════

function invalidateCache(cacheKey) {
  try {
    CacheService.getScriptCache().remove(cacheKey);
  } catch (_) {}
}

function invalidateAllCaches() {
  try {
    CacheService.getScriptCache().removeAll([
      'master_kategori',
      'master_akun',
      'master_akun_aktif',
      'saldo_akun'
    ]);
  } catch (_) {}
}


// ══════════════════════════════════════════════════════════════
//  UTILITY: onOpen menu / trigger setup
// ══════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏦 Keuangan Keluarga')
    .addItem('⚙️ Setup Schema', 'setupSchema')
    .addItem('🔄 Rebuild Saldo', 'rebuildSaldoAkun')
    .addItem('🗑️ Hapus Cache', 'invalidateAllCaches')
    .addToUi();
}

function doGet(e) {
  return HtmlService
    .createTemplateFromFile('ui_Index')
    .evaluate()
    .setTitle(APP_CONFIG.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}