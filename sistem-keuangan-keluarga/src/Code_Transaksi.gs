/**
 * MODUL: TRANSACTION ENGINE
 * Standar: Batch Read/Write, Soft Delete, Object Mapping.
 *
 * v2.2 CHANGES:
 *   - addTransaksi()  → auto-isi input_by dari Session.getActiveUser()
 *   - addTransfer()   → NEW: Membuat 2 entri untuk pergeseran saldo internal
 *   - updateTransaksi() / deleteTransaksi() → tidak berubah
 *
 * SCHEMA TRANSAKSI:
 *   id_transaksi, tanggal, bulan, id_akun, id_kategori, tipe, jumlah,
 *   deskripsi, metode_bayar, anggota_keluarga, catatan, status_hapus,
 *   input_by, id_akun_tujuan
 *
 * ATURAN TRANSFER:
 *   - UI kirim tipe="TRANSFER" → backend panggil addTransfer() (bukan addTransaksi())
 *   - Membuat 2 baris: PENGELUARAN dari asal + PENDAPATAN ke tujuan
 *   - id_kategori = APP_CONFIG.CATEGORY.TRANSFER_ID → dikecualikan dari laporan
 *   - Keduanya dihubungkan via catatan: "REF:TRF_<timestamp>"
 */

// ══════════════════════════════════════════════════════════════
//  READ
// ══════════════════════════════════════════════════════════════

function getTransaksiByMonth(bulan) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    const filtered = data
      .map(row => mapRowToObject(row, headerMap))
      .filter(obj => {
        const trxBulan = obj.bulan ? obj.bulan.toString().substring(0, 7) : '';
        return trxBulan === bulan && obj.status_hapus !== APP_CONFIG.STATUS.HAPUS;
      })
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    return { success: true, data: filtered, count: filtered.length };

  } catch (e) {
    console.error('getTransaksiByMonth error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: TRANSAKSI NORMAL (PENDAPATAN / PENGELUARAN)
// ══════════════════════════════════════════════════════════════

/**
 * Menambah transaksi baru. Auto-isi input_by dari akun Google aktif.
 * @param  {Object} data - tanggal, tipe, id_kategori, id_akun, jumlah,
 *                         deskripsi, metode_bayar, anggota_keluarga, catatan
 * @return {Object} { success, id, message }
 */
function addTransaksi(data) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);

    const dateObj = data.tanggal ? new Date(data.tanggal) : new Date();
    if (isNaN(dateObj)) throw new Error('Format tanggal tidak valid: ' + data.tanggal);

    if (data.tipe === APP_CONFIG.TIPE.TRANSFER) {
      throw new Error('Gunakan addTransfer() untuk Transfer Antar Akun.');
    }

    const currentUser = _getCurrentUserEmail();
    const lastRow     = sheet.getLastRow();

    const newTrx = {
      id_transaksi    : generateTrxId(dateObj, lastRow),
      tanggal         : dateObj,
      bulan           : formatBulan(dateObj),
      id_akun         : data.id_akun          || '',
      id_kategori     : data.id_kategori       || '',
      tipe            : data.tipe              || '',
      jumlah          : parseFloat(data.jumlah) || 0,
      deskripsi       : data.deskripsi         || '',
      metode_bayar    : data.metode_bayar      || 'TUNAI',
      anggota_keluarga: data.anggota_keluarga  || '',
      catatan         : data.catatan           || '',
      status_hapus    : APP_CONFIG.STATUS.AKTIF,
      input_by        : currentUser,
      id_akun_tujuan  : ''
    };

    const rowData = mapObjectToRow(newTrx, headerMap);
    sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);

    invalidateCache('data_transaksi_' + newTrx.bulan);
    return { success: true, id: newTrx.id_transaksi, message: 'Transaksi berhasil disimpan.' };

  } catch (e) {
    console.error('addTransaksi error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: TRANSFER ANTAR AKUN  (v2.2 NEW)
// ══════════════════════════════════════════════════════════════

/**
 * Mencatat Transfer Antar Akun secara atomis (2 baris sekaligus).
 *
 * Baris 1 — PENGELUARAN dari akun asal  (saldo berkurang)
 * Baris 2 — PENDAPATAN  ke  akun tujuan (saldo bertambah)
 *
 * Keduanya punya id_kategori = "_TRANSFER_" sehingga:
 *   - TIDAK dihitung sebagai pengeluaran/pendapatan di laporan 50/30/20
 *   - TIDAK muncul di Sankey Diagram pengeluaran
 *   - TETAP dihitung dalam perubahan saldo akun (Saldo_Akun sheet)
 *
 * @param  {Object} data {
 *   tanggal          : "YYYY-MM-DD"
 *   id_akun_asal     : "A001"
 *   nama_akun_asal   : "BCA-Ayah"
 *   id_akun_tujuan   : "A006"
 *   nama_akun_tujuan : "GoPay-Ayah"
 *   jumlah           : 500000
 *   catatan          : "isi saldo GoPay"   (opsional)
 * }
 * @return {Object} { success, ids, message }
 */
function addTransfer(data) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);

    const dateObj = data.tanggal ? new Date(data.tanggal) : new Date();
    if (isNaN(dateObj)) throw new Error('Format tanggal tidak valid.');

    const jumlah = parseFloat(data.jumlah) || 0;
    if (jumlah <= 0)              throw new Error('Nominal transfer harus lebih dari 0.');
    if (!data.id_akun_asal)       throw new Error('Akun asal wajib dipilih.');
    if (!data.id_akun_tujuan)     throw new Error('Akun tujuan wajib dipilih.');
    if (data.id_akun_asal === data.id_akun_tujuan) {
      throw new Error('Akun asal dan tujuan tidak boleh sama.');
    }

    const currentUser = _getCurrentUserEmail();
    const bulan       = formatBulan(dateObj);
    const refId       = 'REF:TRF_' + dateObj.getTime();
    const catatanBase = (data.catatan ? data.catatan + ' | ' : '') + refId;
    const TRANSFER_ID = APP_CONFIG.CATEGORY.TRANSFER_ID;

    let lastRow = sheet.getLastRow();

    // ── Baris 1: KELUAR dari akun asal ─────────────────────────────────────
    const idKeluar = generateTrxId(dateObj, lastRow);
    const barisKeluar = {
      id_transaksi    : idKeluar,
      tanggal         : dateObj,
      bulan           : bulan,
      id_akun         : data.id_akun_asal,
      id_kategori     : TRANSFER_ID,
      tipe            : APP_CONFIG.TIPE.PENGELUARAN,
      jumlah          : jumlah,
      deskripsi       : 'Transfer ke ' + (data.nama_akun_tujuan || data.id_akun_tujuan),
      metode_bayar    : 'TRANSFER',
      anggota_keluarga: data.anggota_keluarga || '',
      catatan         : catatanBase,
      status_hapus    : APP_CONFIG.STATUS.AKTIF,
      input_by        : currentUser,
      id_akun_tujuan  : data.id_akun_tujuan
    };
    lastRow++;
    sheet.getRange(lastRow, 1, 1, mapObjectToRow(barisKeluar, headerMap).length)
         .setValues([mapObjectToRow(barisKeluar, headerMap)]);

    // ── Baris 2: MASUK ke akun tujuan ──────────────────────────────────────
    const idMasuk = generateTrxId(dateObj, lastRow);
    const barisMasuk = {
      id_transaksi    : idMasuk,
      tanggal         : dateObj,
      bulan           : bulan,
      id_akun         : data.id_akun_tujuan,
      id_kategori     : TRANSFER_ID,
      tipe            : APP_CONFIG.TIPE.PENDAPATAN,
      jumlah          : jumlah,
      deskripsi       : 'Transfer dari ' + (data.nama_akun_asal || data.id_akun_asal),
      metode_bayar    : 'TRANSFER',
      anggota_keluarga: data.anggota_keluarga || '',
      catatan         : catatanBase,
      status_hapus    : APP_CONFIG.STATUS.AKTIF,
      input_by        : currentUser,
      id_akun_tujuan  : data.id_akun_asal
    };
    lastRow++;
    sheet.getRange(lastRow, 1, 1, mapObjectToRow(barisMasuk, headerMap).length)
         .setValues([mapObjectToRow(barisMasuk, headerMap)]);

    invalidateCache('data_transaksi_' + bulan);

    const namaAsal   = data.nama_akun_asal   || data.id_akun_asal;
    const namaTujuan = data.nama_akun_tujuan || data.id_akun_tujuan;
    return {
      success: true,
      ids    : [idKeluar, idMasuk],
      message: `Transfer Rp ${jumlah.toLocaleString('id-ID')} dari ${namaAsal} → ${namaTujuan} berhasil dicatat.`
    };

  } catch (e) {
    console.error('addTransfer error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: UPDATE & DELETE
// ══════════════════════════════════════════════════════════════

function updateTransaksi(idTransaksi, updatedData) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.TRANSAKSI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.TRANSAKSI);
    const fullData  = sheet.getDataRange().getValues();
    const idIdx     = headerMap['id_transaksi'];

    if (idIdx === undefined) throw new Error("Kolom 'id_transaksi' tidak ditemukan di sheet.");

    let found = false;
    for (let i = 1; i < fullData.length; i++) {
      if (fullData[i][idIdx] === idTransaksi) {
        const currentObj = mapRowToObject(fullData[i], headerMap);
        const merged     = { ...currentObj, ...updatedData };
        if (updatedData.tanggal) merged.bulan = formatBulan(new Date(updatedData.tanggal));
        fullData[i] = mapObjectToRow(merged, headerMap);
        found = true;
        break;
      }
    }

    if (!found) throw new Error('ID Transaksi tidak ditemukan: ' + idTransaksi);
    sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);
    return { success: true, message: 'Transaksi berhasil diperbarui.' };

  } catch (e) {
    console.error('updateTransaksi error:', e.message);
    return { success: false, message: e.message };
  }
}

function deleteTransaksi(idTransaksi) {
  return updateTransaksi(idTransaksi, { status_hapus: APP_CONFIG.STATUS.HAPUS });
}


// ══════════════════════════════════════════════════════════════
//  PRIVATE HELPERS
// ══════════════════════════════════════════════════════════════

function _getCurrentUserEmail() {
  try {
    return Session.getActiveUser().getEmail() || 'user@apps';
  } catch (_) {
    return 'user@apps';
  }
}
