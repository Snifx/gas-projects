/**
 * MODUL: TRANSACTION ENGINE
 * v1.1 CHANGES:
 *   - addTransaksi(): jika akun bertipe CC/PAYLATER dan is_cicilan=true
 *     → auto-create record di Cicilan_Tracking via addCicilan()
 *   - addTransaksi(): kolom id_cicilan diisi jika cicilan dibuat
 *   - addTransfer(): tidak berubah dari v2.2
 *   - updateTransaksi() / deleteTransaksi(): tidak berubah
 *
 * SCHEMA TRANSAKSI (v1.1):
 *   id_transaksi, tanggal, bulan, id_akun, id_kategori, tipe, jumlah,
 *   deskripsi, metode_bayar, anggota_keluarga, catatan, status_hapus,
 *   input_by, id_akun_tujuan, id_cicilan  ← BARU v1.1
 *
 * ATURAN CC / PAYLATER:
 *   - Transaksi pengeluaran CC dicatat PENUH di bulan pembelian
 *   - Budget 50/30/20 bulan itu langsung terpotong (user sadar beban penuh)
 *   - Jika is_cicilan=true → addCicilan() auto dipanggil, id_cicilan diisi
 *   - Pembayaran tagihan → addTransfer (Bank → CC), BUKAN addTransaksi baru
 *   - id_kategori BAYAR_TAGIHAN_ID hanya muncul dari addTransfer pembayaran tagihan
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
 * Menambah transaksi baru.
 *
 * v1.1: Jika is_cicilan = true → addCicilan() dipanggil setelah transaksi tersimpan.
 *
 * @param {Object} data {
 *   tanggal          : string  — YYYY-MM-DD
 *   tipe             : string  — PENDAPATAN | PENGELUARAN
 *   id_kategori      : string
 *   id_akun          : string
 *   jumlah           : number
 *   deskripsi        : string
 *   metode_bayar     : string
 *   anggota_keluarga : string
 *   catatan          : string
 *   // v1.1 — parameter cicilan (opsional):
 *   is_cicilan       : boolean — true jika pembelian pakai cicilan CC/Paylater
 *   nama_barang      : string  — nama barang yang dicicil
 *   tenor_bulan      : number  — lama cicilan (bulan)
 * }
 * @return {Object} { success, id, id_cicilan, message }
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
      id_akun_tujuan  : '',
      id_cicilan      : ''    // diisi setelah addCicilan() berhasil (v1.1)
    };

    const rowData = mapObjectToRow(newTrx, headerMap);
    sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);

    invalidateCache('data_transaksi_' + newTrx.bulan);

    // ── v1.1: Auto-create cicilan jika is_cicilan = true ──────────────────
    let idCicilanBaru = '';
    if (data.is_cicilan === true || data.is_cicilan === 'true') {
      const cicilanResult = addCicilan({
        id_transaksi_awal: newTrx.id_transaksi,
        id_akun_kredit   : data.id_akun,
        nama_barang      : data.nama_barang || data.deskripsi || 'Pembelian CC',
        total_harga      : parseFloat(data.jumlah) || 0,
        tenor_bulan      : parseInt(data.tenor_bulan, 10) || 1,
        tanggal          : data.tanggal,
        keterangan       : data.catatan || ''
      });

      if (cicilanResult.success) {
        idCicilanBaru = cicilanResult.id;

        // Update kolom id_cicilan di baris yang baru saja ditulis
        const idCicilanIdx = headerMap['id_cicilan'];
        if (idCicilanIdx !== undefined) {
          sheet.getRange(lastRow + 1, idCicilanIdx + 1).setValue(idCicilanBaru);
        }
        console.log(`addTransaksi: cicilan ${idCicilanBaru} dibuat untuk trx ${newTrx.id_transaksi}`);
      } else {
        // Cicilan gagal dibuat — log warning tapi transaksi tetap tersimpan
        console.warn(`addTransaksi: gagal buat cicilan — ${cicilanResult.message}`);
      }
    }

    const msgCicilan = idCicilanBaru
      ? ` Cicilan dibuat: ${idCicilanBaru}.`
      : '';

    return {
      success    : true,
      id         : newTrx.id_transaksi,
      id_cicilan : idCicilanBaru,
      message    : 'Transaksi berhasil disimpan.' + msgCicilan
    };

  } catch (e) {
    console.error('addTransaksi error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: TRANSFER ANTAR AKUN  (tidak berubah dari v2.2)
// ══════════════════════════════════════════════════════════════

/**
 * Mencatat Transfer Antar Akun secara atomis (2 baris sekaligus).
 *
 * Digunakan untuk:
 *   1. Transfer antar akun reguler (Bank → E-Wallet, dst)
 *   2. Pembayaran tagihan CC/Paylater (Bank → CC) — dipanggil dari bayarTagihanCC()
 *
 * Baris 1 — PENGELUARAN dari akun asal  (saldo berkurang)
 * Baris 2 — PENDAPATAN  ke  akun tujuan (saldo bertambah / utang CC berkurang)
 *
 * id_kategori = "_TRANSFER_" → dikecualikan dari laporan 50/30/20 & Sankey.
 *
 * @param {Object} data { tanggal, id_akun_asal, nama_akun_asal,
 *                        id_akun_tujuan, nama_akun_tujuan, jumlah,
 *                        anggota_keluarga, catatan }
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
    const idKeluar    = generateTrxId(dateObj, lastRow);
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
      id_akun_tujuan  : data.id_akun_tujuan,
      id_cicilan      : ''
    };
    lastRow++;
    sheet.getRange(lastRow, 1, 1, mapObjectToRow(barisKeluar, headerMap).length)
         .setValues([mapObjectToRow(barisKeluar, headerMap)]);

    // ── Baris 2: MASUK ke akun tujuan ──────────────────────────────────────
    const idMasuk    = generateTrxId(dateObj, lastRow);
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
      id_akun_tujuan  : data.id_akun_asal,
      id_cicilan      : ''
    };
    lastRow++;
    sheet.getRange(lastRow, 1, 1, mapObjectToRow(barisMasuk, headerMap).length)
         .setValues([mapObjectToRow(barisMasuk, headerMap)]);

    invalidateCache('data_transaksi_' + bulan);

    return {
      success: true,
      ids    : [idKeluar, idMasuk],
      message: `Transfer ${formatRupiah_(jumlah)} dari ${data.nama_akun_asal || data.id_akun_asal} → ${data.nama_akun_tujuan || data.id_akun_tujuan} berhasil.`
    };

  } catch (e) {
    console.error('addTransfer error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: UPDATE & DELETE (tidak berubah)
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
