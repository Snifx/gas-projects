/**
 * MODUL: ARISAN ENGINE
 * Menangani logika iuran (PENGELUARAN) dan penerimaan (PENDAPATAN) arisan.
 *
 * FIX: Filter ketat pola ID arisan (AR + angka) di getArisanList().
 * NEW: addArisan()        — Daftar kelompok arisan baru dari Web App.
 * NEW: deactivateArisan() — Nonaktifkan kelompok arisan yang sudah selesai.
 * NEW: _generateNextArisanId() — Auto-generate ID AR001, AR002, dst.
 */

// ══════════════════════════════════════════════════════════════
//  HELPER: VALIDASI POLA ID ARISAN
// ══════════════════════════════════════════════════════════════

/**
 * Validasi ID Arisan: harus diawali AR diikuti minimal 1 angka.
 * Contoh valid: AR001, AR01, AR1, AR010
 */
function _isValidArisanId(id) {
  return id && /^AR\d+$/i.test(id.toString().trim());
}

/**
 * Auto-generate ID Arisan berikutnya berdasarkan ID tertinggi yang ada.
 * Contoh: ada AR001, AR002 → generate AR003
 * @private
 */
function _generateNextArisanId() {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.ARISAN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.ARISAN);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    const nums = data
      .map(row => mapRowToObject(row, headerMap))
      .filter(obj => _isValidArisanId(obj.id_arisan))
      .map(obj => parseInt(obj.id_arisan.toString().replace(/^AR/i, ''), 10))
      .filter(n => !isNaN(n));

    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return 'AR' + next.toString().padStart(3, '0');
  } catch (e) {
    return 'AR' + Date.now().toString().slice(-4);
  }
}


// ══════════════════════════════════════════════════════════════
//  READ
// ══════════════════════════════════════════════════════════════

/**
 * Mengambil daftar kelompok arisan yang aktif.
 *
 * FIX: Filter ketat — hanya baris dengan id_arisan pola AR + angka yang diterima.
 *      Baris panduan/keterangan otomatis diabaikan meskipun kolom pertama terisi.
 *
 * @return {Object} { success, data: [...] }
 */
function getArisanList() {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.ARISAN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.ARISAN);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    const result = data
      .map(row => mapRowToObject(row, headerMap))
      .filter(obj => {
        // Filter ketat 1: ID harus pola AR + angka
        if (!_isValidArisanId(obj.id_arisan)) return false;

        // Filter ketat 2: nama_kelompok harus ada (bukan kosong/angka)
        if (!obj.nama_kelompok || obj.nama_kelompok.toString().trim() === '') return false;

        // Filter status aktif: jika kolom ada, cek nilainya
        if (obj.status_aktif) {
          return obj.status_aktif.toString().toUpperCase() !== APP_CONFIG.STATUS.ARISAN_NONAKTIF;
        }

        return true; // Jika kolom status_aktif belum ada, anggap aktif
      })
      .map(obj => ({
        ...obj,
        jumlah_iuran   : parseFloat(obj.jumlah_iuran)    || 0,
        jumlah_anggota : parseFloat(obj.jumlah_anggota)  || 0,
        total_terkumpul: parseFloat(obj.total_terkumpul) || 0
      }));

    return { success: true, data: result };

  } catch (e) {
    console.error('getArisanList error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: DAFTAR ARISAN BARU
// ══════════════════════════════════════════════════════════════

/**
 * Mendaftarkan kelompok arisan baru ke sheet Arisan_Tracking.
 * ID di-auto-generate (AR003, AR004, dst).
 *
 * @param {Object} data - Field yang diharapkan dari UI:
 *   nama_kelompok  {string}  - Nama kelompok arisan
 *   jumlah_iuran   {number}  - Nominal iuran per periode
 *   periode        {string}  - "BULANAN" atau "MINGGUAN"
 *   jumlah_anggota {number}  - Total peserta dalam kelompok
 *   tanggal_setor  {number}  - Tanggal rutin setor (angka, misal: 20)
 *   keterangan     {string}  - Keterangan tambahan (opsional)
 *
 * @return {Object} { success, id, message }
 */
function addArisan(data) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.ARISAN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.ARISAN);

    // Validasi field wajib
    if (!data.nama_kelompok || data.nama_kelompok.trim() === '') {
      throw new Error('Nama kelompok arisan wajib diisi.');
    }
    const jumlahIuran = parseFloat(data.jumlah_iuran) || 0;
    if (jumlahIuran <= 0) {
      throw new Error('Jumlah iuran harus lebih dari 0.');
    }
    const jumlahAnggota = parseInt(data.jumlah_anggota, 10) || 0;
    if (jumlahAnggota <= 0) {
      throw new Error('Jumlah anggota harus lebih dari 0.');
    }

    // Generate ID
    const newId = _generateNextArisanId();

    // Build objek sesuai header sheet Arisan_Tracking
    const newArisan = {
      id_arisan              : newId,
      nama_kelompok          : data.nama_kelompok.trim(),
      jumlah_iuran           : jumlahIuran,
      periode                : (data.periode || 'BULANAN').toUpperCase(),
      jumlah_anggota         : jumlahAnggota,
      tanggal_setor          : parseInt(data.tanggal_setor, 10) || 1,
      status_bayar_bulan_ini : APP_CONFIG.STATUS.BAYAR_BELUM,   // BELUM
      sudah_dapat_giliran    : APP_CONFIG.STATUS.DAPAT_BELUM,   // BELUM
      tanggal_dapat_giliran  : '',
      total_terkumpul        : jumlahIuran * jumlahAnggota,
      keterangan             : (data.keterangan || '').trim(),
      status_aktif           : APP_CONFIG.STATUS.ARISAN_AKTIF   // YA
    };

    const rowData = mapObjectToRow(newArisan, headerMap);
    sheet.appendRow(rowData);

    // Invalidate header map cache (karena mungkin kolom baru ditambah via setupSchema)
    invalidateCache(`header_map_${APP_CONFIG.SHEETS.ARISAN}`);

    return {
      success: true,
      id     : newId,
      message: `Kelompok arisan "${newArisan.nama_kelompok}" berhasil didaftarkan dengan ID ${newId}.`
    };

  } catch (e) {
    console.error('addArisan error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: NONAKTIFKAN ARISAN
// ══════════════════════════════════════════════════════════════

/**
 * Menonaktifkan kelompok arisan (soft deactivate).
 * Data tetap tersimpan di sheet, hanya status_aktif diubah ke "TIDAK".
 *
 * @param {string} idArisan - Nilai kolom id_arisan
 * @return {Object} { success, message }
 */
function deactivateArisan(idArisan) {
  try {
    if (!_isValidArisanId(idArisan)) {
      throw new Error(`ID Arisan tidak valid: ${idArisan}`);
    }

    const sheet     = getSheet(APP_CONFIG.SHEETS.ARISAN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.ARISAN);
    const fullData  = sheet.getDataRange().getValues();
    const idIdx     = headerMap['id_arisan'];
    const statusIdx = headerMap['status_aktif'];

    if (idIdx === undefined) throw new Error("Kolom 'id_arisan' tidak ditemukan.");
    if (statusIdx === undefined) {
      throw new Error("Kolom 'status_aktif' belum ada. Jalankan Setup Schema terlebih dahulu.");
    }

    let found      = false;
    let namaKelompok = '';

    for (let i = 1; i < fullData.length; i++) {
      if (fullData[i][idIdx] === idArisan) {
        namaKelompok = fullData[i][headerMap['nama_kelompok']] || idArisan;
        fullData[i][statusIdx] = APP_CONFIG.STATUS.ARISAN_NONAKTIF; // TIDAK
        found = true;
        break;
      }
    }

    if (!found) throw new Error(`ID Arisan "${idArisan}" tidak ditemukan.`);

    // Batch write
    sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);

    return {
      success: true,
      message: `Kelompok arisan "${namaKelompok}" berhasil dinonaktifkan. Data historis tetap tersimpan.`
    };

  } catch (e) {
    console.error('deactivateArisan error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: BAYAR IURAN
// ══════════════════════════════════════════════════════════════

/**
 * FLOW 1: Bayar Iuran Arisan → Mencatat PENGELUARAN & update status.
 */
function bayarIuranArisan(idArisan, tanggal, idAkun, anggotaKeluarga) {
  try {
    const sheetArisan  = getSheet(APP_CONFIG.SHEETS.ARISAN);
    const headerArisan = getHeaderMap(APP_CONFIG.SHEETS.ARISAN);
    const dataArisan   = sheetArisan.getDataRange().getValues();

    let arisanObj  = null;
    let sheetRowNo = -1;

    for (let i = 1; i < dataArisan.length; i++) {
      if (dataArisan[i][headerArisan['id_arisan']] === idArisan) {
        arisanObj  = mapRowToObject(dataArisan[i], headerArisan);
        sheetRowNo = i + 1;
        break;
      }
    }

    if (!arisanObj) throw new Error('ID Arisan tidak ditemukan: ' + idArisan);

    const statusBayar = (arisanObj.status_bayar_bulan_ini || '').toString().toUpperCase();
    if (statusBayar === APP_CONFIG.STATUS.BAYAR_SUDAH) {
      throw new Error(`Arisan "${arisanObj.nama_kelompok}" sudah dibayar bulan ini.`);
    }

    const nominalIuran = parseFloat(arisanObj.jumlah_iuran) || 0;
    if (nominalIuran <= 0) throw new Error('Nominal iuran tidak valid: ' + arisanObj.jumlah_iuran);

    const trxResult = addTransaksi({
      tanggal         : tanggal,
      tipe            : APP_CONFIG.TIPE.PENGELUARAN,
      id_kategori     : APP_CONFIG.CATEGORY.ARISAN_OUT,
      id_akun         : idAkun,
      jumlah          : nominalIuran,
      deskripsi       : `Iuran Arisan ${arisanObj.nama_kelompok}`,
      metode_bayar    : 'TUNAI',
      anggota_keluarga: anggotaKeluarga,
      catatan         : `Bayar arisan oleh ${anggotaKeluarga}`
    });

    if (!trxResult.success) throw new Error('Gagal catat transaksi: ' + trxResult.message);

    // Update status (targeted cell write — lebih efisien dari full batch write)
    const colStatusBayar  = headerArisan['status_bayar_bulan_ini'];
    const colTanggalSetor = headerArisan['tanggal_setor'];

    if (colStatusBayar !== undefined) {
      sheetArisan.getRange(sheetRowNo, colStatusBayar + 1).setValue(APP_CONFIG.STATUS.BAYAR_SUDAH);
    }
    if (colTanggalSetor !== undefined) {
      sheetArisan.getRange(sheetRowNo, colTanggalSetor + 1).setValue(new Date(tanggal));
    }

    return {
      success: true,
      message: `✅ Iuran "${arisanObj.nama_kelompok}" ${formatRupiah_(nominalIuran)} berhasil dicatat. ID: ${trxResult.id}`
    };

  } catch (e) {
    console.error('bayarIuranArisan error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: TERIMA GILIRAN
// ══════════════════════════════════════════════════════════════

/**
 * FLOW 2: Terima Dana Arisan → Mencatat PENDAPATAN & update status giliran.
 */
function terimaArisan(idArisan, tanggal, idAkun, anggotaKeluarga) {
  try {
    const sheetArisan  = getSheet(APP_CONFIG.SHEETS.ARISAN);
    const headerArisan = getHeaderMap(APP_CONFIG.SHEETS.ARISAN);
    const dataArisan   = sheetArisan.getDataRange().getValues();

    let arisanObj  = null;
    let sheetRowNo = -1;

    for (let i = 1; i < dataArisan.length; i++) {
      if (dataArisan[i][headerArisan['id_arisan']] === idArisan) {
        arisanObj  = mapRowToObject(dataArisan[i], headerArisan);
        sheetRowNo = i + 1;
        break;
      }
    }

    if (!arisanObj) throw new Error('ID Arisan tidak ditemukan: ' + idArisan);

    const statusDapat = (arisanObj.sudah_dapat_giliran || '').toString().toUpperCase();
    if (statusDapat === APP_CONFIG.STATUS.DAPAT_YA) {
      throw new Error(`Arisan "${arisanObj.nama_kelompok}" sudah pernah diterima giliran.`);
    }

    const nominalIuran    = parseFloat(arisanObj.jumlah_iuran)   || 0;
    const jumlahAnggota   = parseFloat(arisanObj.jumlah_anggota) || 1;
    const totalPenerimaan = nominalIuran * jumlahAnggota;

    if (totalPenerimaan <= 0) throw new Error('Kalkulasi total penerimaan tidak valid.');

    const trxResult = addTransaksi({
      tanggal         : tanggal,
      tipe            : APP_CONFIG.TIPE.PENDAPATAN,
      id_kategori     : APP_CONFIG.CATEGORY.ARISAN_IN,
      id_akun         : idAkun,
      jumlah          : totalPenerimaan,
      deskripsi       : `Terima Giliran Arisan: ${arisanObj.nama_kelompok}`,
      metode_bayar    : 'TUNAI',
      anggota_keluarga: anggotaKeluarga,
      catatan         : `${jumlahAnggota} peserta × ${formatRupiah_(nominalIuran)}`
    });

    if (!trxResult.success) throw new Error('Gagal catat transaksi: ' + trxResult.message);

    const colSudahDapat   = headerArisan['sudah_dapat_giliran'];
    const colTanggalDapat = headerArisan['tanggal_dapat_giliran'];

    if (colSudahDapat !== undefined) {
      sheetArisan.getRange(sheetRowNo, colSudahDapat + 1).setValue(APP_CONFIG.STATUS.DAPAT_YA);
    }
    if (colTanggalDapat !== undefined) {
      sheetArisan.getRange(sheetRowNo, colTanggalDapat + 1).setValue(new Date(tanggal));
    }

    return {
      success: true,
      message: `✅ Penerimaan arisan "${arisanObj.nama_kelompok}" ${formatRupiah_(totalPenerimaan)} berhasil dicatat. ID: ${trxResult.id}`
    };

  } catch (e) {
    console.error('terimaArisan error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  RESET BULANAN
// ══════════════════════════════════════════════════════════════

/**
 * Reset status_bayar_bulan_ini semua kelompok arisan ke 'BELUM'.
 */
function resetArisanMonthly() {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.ARISAN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.ARISAN);
    const data      = sheet.getDataRange().getValues();
    const colIdx    = headerMap['status_bayar_bulan_ini'];

    if (colIdx === undefined) {
      throw new Error("Kolom 'status_bayar_bulan_ini' tidak ditemukan. Jalankan Setup Schema terlebih dahulu.");
    }
    if (data.length <= 1) return { success: true, message: 'Tidak ada data arisan untuk di-reset.' };

    let resetCount = 0;
    for (let i = 1; i < data.length; i++) {
      // Hanya reset baris dengan ID valid
      if (_isValidArisanId(data[i][headerMap['id_arisan']])) {
        data[i][colIdx] = APP_CONFIG.STATUS.BAYAR_BELUM;
        resetCount++;
      }
    }

    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    return { success: true, message: `Status bayar ${resetCount} kelompok arisan telah di-reset ke "BELUM".` };

  } catch (e) {
    console.error('resetArisanMonthly error:', e.message);
    return { success: false, message: e.message };
  }
}
