/**
 * MODUL: MASTER DATA MANAGEMENT
 * v1.1 CHANGES:
 *   - addAkun() / updateAkun(): support field baru CC/Paylater
 *       limit_kredit, tgl_cetak_tagihan, tgl_jatuh_tempo
 *   - getMasterAkun(): return field baru (schema-aware, backward-compat)
 *   - getMasterSaldoAkun(): tambah computed field sisa_limit untuk CC/Paylater
 *   - _computeSaldoFromTransaksi(): akun CC/Paylater saldo = negatif utang
 *   - Fungsi lain (archive, delete) tidak berubah
 */

// ══════════════════════════════════════════════════════════════
//  HELPER: VALIDASI POLA ID
// ══════════════════════════════════════════════════════════════

function _isValidAkunId(id) {
  return id && /^A\d+$/i.test(id.toString().trim());
}

function _isValidKategoriId(id) {
  return id && /^K\d+$/i.test(id.toString().trim());
}

/**
 * Cek apakah tipe akun termasuk akun utang (CC/Paylater).
 * @param {string} tipeAkun
 * @return {boolean}
 */
function _isAkunUtang(tipeAkun) {
  return APP_CONFIG.TIPE_AKUN_UTANG.includes((tipeAkun || '').toUpperCase());
}


// ══════════════════════════════════════════════════════════════
//  SEKSI: MASTER KATEGORI (tidak berubah dari v2.2)
// ══════════════════════════════════════════════════════════════

function getMasterKategori() {
  const cacheKey = 'data_master_kategori';
  const cached   = CacheService.getScriptCache().get(cacheKey);
  if (cached) return { success: true, data: JSON.parse(cached), source: 'cache' };

  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.MASTER_KATEGORI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.MASTER_KATEGORI);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    const result = data
      .map(row => mapRowToObject(row, headerMap))
      .filter(obj => {
        if (!_isValidKategoriId(obj.id_kategori)) return false;
        if (obj.status_aktif !== undefined && obj.status_aktif !== '') {
          return obj.status_aktif.toString().toUpperCase() !== APP_CONFIG.STATUS.MASTER_ARSIP;
        }
        return true;
      });

    CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), APP_CONFIG.CACHE_TTL);
    return { success: true, data: result, source: 'sheet' };

  } catch (e) {
    console.error('getMasterKategori error:', e.message);
    return { success: false, message: e.message };
  }
}

function addKategori(data) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.MASTER_KATEGORI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.MASTER_KATEGORI);

    if (!data.id_kategori)   throw new Error('id_kategori wajib diisi.');
    if (!_isValidKategoriId(data.id_kategori)) throw new Error('Format ID Kategori tidak valid. Gunakan K001, K101, dst.');
    if (!data.nama_kategori) throw new Error('nama_kategori wajib diisi.');

    const existing = getMasterKategori();
    if (existing.success) {
      const dup = existing.data.find(k => k.id_kategori === data.id_kategori);
      if (dup) throw new Error(`ID Kategori "${data.id_kategori}" sudah ada.`);
    }

    data.status_aktif = APP_CONFIG.STATUS.MASTER_AKTIF;
    sheet.appendRow(mapObjectToRow(data, headerMap));
    invalidateCache('data_master_kategori', `header_map_${APP_CONFIG.SHEETS.MASTER_KATEGORI}`);
    return { success: true, message: `Kategori "${data.nama_kategori}" berhasil ditambahkan.` };

  } catch (e) {
    console.error('addKategori error:', e.message);
    return { success: false, message: e.message };
  }
}

function updateKategori(kategoriId, updatedData) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.MASTER_KATEGORI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.MASTER_KATEGORI);
    const fullData  = sheet.getDataRange().getValues();
    const idIdx     = headerMap['id_kategori'];
    if (idIdx === undefined) throw new Error("Kolom 'id_kategori' tidak ditemukan.");
    delete updatedData.id_kategori;
    let found = false;
    for (let i = 1; i < fullData.length; i++) {
      if (fullData[i][idIdx] === kategoriId) {
        fullData[i] = mapObjectToRow({ ...mapRowToObject(fullData[i], headerMap), ...updatedData }, headerMap);
        found = true; break;
      }
    }
    if (!found) throw new Error(`Kategori ID "${kategoriId}" tidak ditemukan.`);
    sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);
    invalidateCache('data_master_kategori');
    return { success: true, message: 'Kategori berhasil diperbarui.' };
  } catch (e) {
    console.error('updateKategori error:', e.message);
    return { success: false, message: e.message };
  }
}

function archiveKategori(kategoriId) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.MASTER_KATEGORI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.MASTER_KATEGORI);
    const fullData  = sheet.getDataRange().getValues();
    const idIdx     = headerMap['id_kategori'];
    const statusIdx = headerMap['status_aktif'];
    if (idIdx === undefined)    throw new Error("Kolom 'id_kategori' tidak ditemukan.");
    if (statusIdx === undefined) throw new Error("Kolom 'status_aktif' belum ada. Jalankan Setup Schema.");
    let found = false, nama = '';
    for (let i = 1; i < fullData.length; i++) {
      if (fullData[i][idIdx] === kategoriId) {
        nama = fullData[i][headerMap['nama_kategori']] || kategoriId;
        fullData[i][statusIdx] = APP_CONFIG.STATUS.MASTER_ARSIP;
        found = true; break;
      }
    }
    if (!found) throw new Error(`Kategori ID "${kategoriId}" tidak ditemukan.`);
    sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);
    invalidateCache('data_master_kategori');
    return { success: true, message: `Kategori "${nama}" berhasil diarsipkan.` };
  } catch (e) {
    console.error('archiveKategori error:', e.message);
    return { success: false, message: e.message };
  }
}

function deleteKategori(kategoriId) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.MASTER_KATEGORI);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.MASTER_KATEGORI);
    const data      = sheet.getDataRange().getValues();
    const idIdx     = headerMap['id_kategori'];
    if (idIdx === undefined) throw new Error("Kolom 'id_kategori' tidak ditemukan.");
    let rowToDelete = -1, nama = '';
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === kategoriId) { nama = data[i][headerMap['nama_kategori']] || kategoriId; rowToDelete = i + 1; break; }
    }
    if (rowToDelete === -1) throw new Error(`Kategori ID "${kategoriId}" tidak ditemukan.`);
    sheet.deleteRow(rowToDelete);
    invalidateCache('data_master_kategori', `header_map_${APP_CONFIG.SHEETS.MASTER_KATEGORI}`);
    return { success: true, message: `Kategori "${nama}" berhasil dihapus permanen.` };
  } catch (e) {
    console.error('deleteKategori error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  SEKSI: MASTER AKUN
// ══════════════════════════════════════════════════════════════

/**
 * Mengambil semua Akun AKTIF.
 * v1.1: Mengembalikan field baru CC/Paylater jika ada:
 *   limit_kredit, tgl_cetak_tagihan, tgl_jatuh_tempo
 */
function getMasterAkun() {
  const cacheKey = 'data_master_akun';
  const cached   = CacheService.getScriptCache().get(cacheKey);
  if (cached) return { success: true, data: JSON.parse(cached), source: 'cache' };

  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.MASTER_AKUN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.MASTER_AKUN);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    const result = data
      .map(row => mapRowToObject(row, headerMap))
      .filter(obj => {
        if (!_isValidAkunId(obj.id_akun)) return false;
        if (obj.status_aktif !== undefined && obj.status_aktif !== '') {
          return obj.status_aktif.toString().toUpperCase() !== APP_CONFIG.STATUS.MASTER_ARSIP;
        }
        return true;
      })
      .map(obj => ({
        ...obj,
        saldo_awal         : parseFloat(obj.saldo_awal)          || 0,
        // v1.1: field CC/Paylater — default 0 jika kolom belum ada
        limit_kredit       : parseFloat(obj.limit_kredit)         || 0,
        tgl_cetak_tagihan  : parseInt(obj.tgl_cetak_tagihan, 10)  || 0,
        tgl_jatuh_tempo    : parseInt(obj.tgl_jatuh_tempo,   10)  || 0,
        is_utang           : _isAkunUtang(obj.tipe_akun)
      }));

    CacheService.getScriptCache().put(cacheKey, JSON.stringify(result), APP_CONFIG.CACHE_TTL);
    return { success: true, data: result, source: 'sheet' };

  } catch (e) {
    console.error('getMasterAkun error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Mengambil data Saldo Akun dari sheet Saldo_Akun.
 * v1.1: Tambah computed field sisa_limit untuk akun CC/Paylater.
 *   sisa_limit = limit_kredit - |saldo_akhir negatif|
 *   (saldo CC negatif = sudah terpakai, limit berkurang)
 */
function getMasterSaldoAkun() {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.SALDO);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.SALDO);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    // Ambil limit_kredit dari Master_Akun untuk cross-reference
    const akunResult = getMasterAkun();
    const akunMap    = {};
    if (akunResult.success) {
      akunResult.data.forEach(a => { akunMap[a.id_akun] = a; });
    }

    const result = data
      .map(row => mapRowToObject(row, headerMap))
      .filter(obj => _isValidAkunId(obj.id_akun))
      .map(obj => {
        const saldoAkhir   = parseFloat(obj.saldo_akhir)  || 0;
        const akunMaster   = akunMap[obj.id_akun]          || {};
        const isUtang      = _isAkunUtang(obj.tipe_akun || akunMaster.tipe_akun || '');
        const limitKredit  = parseFloat(akunMaster.limit_kredit) || 0;
        // Untuk CC: saldo_akhir negatif = utang terpakai
        // sisa_limit = limit_kredit - |utang|
        const utangTerpakai = isUtang ? Math.abs(Math.min(saldoAkhir, 0)) : 0;
        const sisaLimit     = isUtang ? Math.max(0, limitKredit - utangTerpakai) : null;

        return {
          ...obj,
          saldo_awal   : parseFloat(obj.saldo_awal)  || 0,
          total_masuk  : parseFloat(obj.total_masuk) || 0,
          total_keluar : parseFloat(obj.total_keluar)|| 0,
          saldo_akhir  : saldoAkhir,
          // v1.1 fields
          is_utang     : isUtang,
          limit_kredit : limitKredit,
          sisa_limit   : sisaLimit,
          tgl_jatuh_tempo: parseInt(akunMaster.tgl_jatuh_tempo, 10) || 0
        };
      });

    return { success: true, data: result };

  } catch (e) {
    console.error('getMasterSaldoAkun error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Menambah Akun Baru.
 * v1.1: Support field limit_kredit, tgl_cetak_tagihan, tgl_jatuh_tempo
 *       (wajib diisi jika tipe_akun = CREDIT_CARD atau PAYLATER)
 */
function addAkun(data) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.MASTER_AKUN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.MASTER_AKUN);

    if (!data.nama_akun) throw new Error('nama_akun wajib diisi.');

    if (!data.id_akun) {
      data.id_akun = _generateNextAkunId();
    }
    if (!_isValidAkunId(data.id_akun)) {
      throw new Error(`Format ID Akun tidak valid: "${data.id_akun}". Gunakan format A001, A010, dst.`);
    }

    const existing = getMasterAkun();
    if (existing.success) {
      if (existing.data.find(a => a.id_akun === data.id_akun)) {
        throw new Error(`ID Akun "${data.id_akun}" sudah ada.`);
      }
    }

    // Validasi khusus CC/Paylater
    if (_isAkunUtang(data.tipe_akun)) {
      if (!data.limit_kredit || parseFloat(data.limit_kredit) <= 0) {
        throw new Error('Limit kredit wajib diisi untuk akun CREDIT_CARD/PAYLATER.');
      }
      if (!data.tgl_jatuh_tempo || parseInt(data.tgl_jatuh_tempo, 10) < 1) {
        throw new Error('Tanggal jatuh tempo wajib diisi untuk akun CREDIT_CARD/PAYLATER.');
      }
    }

    data.saldo_awal          = parseFloat(data.saldo_awal)         || 0;
    data.limit_kredit        = parseFloat(data.limit_kredit)        || 0;
    data.tgl_cetak_tagihan   = parseInt(data.tgl_cetak_tagihan, 10) || 0;
    data.tgl_jatuh_tempo     = parseInt(data.tgl_jatuh_tempo,   10) || 0;
    data.status_aktif        = APP_CONFIG.STATUS.MASTER_AKTIF;

    sheet.appendRow(mapObjectToRow(data, headerMap));
    invalidateCache('data_master_akun', `header_map_${APP_CONFIG.SHEETS.MASTER_AKUN}`);
    return {
      success: true,
      id     : data.id_akun,
      message: `Akun "${data.nama_akun}" berhasil ditambahkan dengan ID ${data.id_akun}.`
    };

  } catch (e) {
    console.error('addAkun error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Update Akun.
 * v1.1: Support update limit_kredit, tgl_cetak_tagihan, tgl_jatuh_tempo
 */
function updateAkun(akunId, updatedData) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.MASTER_AKUN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.MASTER_AKUN);
    const fullData  = sheet.getDataRange().getValues();
    const idIdx     = headerMap['id_akun'];
    if (idIdx === undefined) throw new Error("Kolom 'id_akun' tidak ditemukan.");

    delete updatedData.id_akun;

    let found = false;
    for (let i = 1; i < fullData.length; i++) {
      if (fullData[i][idIdx] === akunId) {
        const current = mapRowToObject(fullData[i], headerMap);
        if (updatedData.saldo_awal       !== undefined) updatedData.saldo_awal       = parseFloat(updatedData.saldo_awal)        || 0;
        if (updatedData.limit_kredit     !== undefined) updatedData.limit_kredit     = parseFloat(updatedData.limit_kredit)      || 0;
        if (updatedData.tgl_cetak_tagihan!== undefined) updatedData.tgl_cetak_tagihan= parseInt(updatedData.tgl_cetak_tagihan,10)|| 0;
        if (updatedData.tgl_jatuh_tempo  !== undefined) updatedData.tgl_jatuh_tempo  = parseInt(updatedData.tgl_jatuh_tempo,  10)|| 0;
        fullData[i] = mapObjectToRow({ ...current, ...updatedData }, headerMap);
        found = true; break;
      }
    }

    if (!found) throw new Error(`Akun ID "${akunId}" tidak ditemukan.`);
    sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);
    invalidateCache('data_master_akun');
    return { success: true, message: 'Akun berhasil diperbarui.' };

  } catch (e) {
    console.error('updateAkun error:', e.message);
    return { success: false, message: e.message };
  }
}

function archiveAkun(akunId) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.MASTER_AKUN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.MASTER_AKUN);
    const fullData  = sheet.getDataRange().getValues();
    const idIdx     = headerMap['id_akun'];
    const statusIdx = headerMap['status_aktif'];
    if (idIdx === undefined)     throw new Error("Kolom 'id_akun' tidak ditemukan.");
    if (statusIdx === undefined) throw new Error("Kolom 'status_aktif' belum ada. Jalankan Setup Schema.");
    let found = false, nama = '';
    for (let i = 1; i < fullData.length; i++) {
      if (fullData[i][idIdx] === akunId) {
        nama = fullData[i][headerMap['nama_akun']] || akunId;
        fullData[i][statusIdx] = APP_CONFIG.STATUS.MASTER_ARSIP;
        found = true; break;
      }
    }
    if (!found) throw new Error(`Akun ID "${akunId}" tidak ditemukan.`);
    sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);
    invalidateCache('data_master_akun');
    return { success: true, message: `Akun "${nama}" berhasil diarsipkan.` };
  } catch (e) {
    console.error('archiveAkun error:', e.message);
    return { success: false, message: e.message };
  }
}

function deleteAkun(akunId) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.MASTER_AKUN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.MASTER_AKUN);
    const data      = sheet.getDataRange().getValues();
    const idIdx     = headerMap['id_akun'];
    if (idIdx === undefined) throw new Error("Kolom 'id_akun' tidak ditemukan.");
    let rowToDelete = -1, nama = '';
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === akunId) { nama = data[i][headerMap['nama_akun']] || akunId; rowToDelete = i + 1; break; }
    }
    if (rowToDelete === -1) throw new Error(`Akun ID "${akunId}" tidak ditemukan.`);
    sheet.deleteRow(rowToDelete);
    invalidateCache('data_master_akun', `header_map_${APP_CONFIG.SHEETS.MASTER_AKUN}`);
    return { success: true, message: `Akun "${nama}" berhasil dihapus permanen.` };
  } catch (e) {
    console.error('deleteAkun error:', e.message);
    return { success: false, message: e.message };
  }
}

function _generateNextAkunId() {
  const existing = getMasterAkun();
  if (!existing.success || existing.data.length === 0) return 'A001';
  const nums = existing.data
    .map(a => parseInt((a.id_akun || '').replace(/^A/i, ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return 'A' + next.toString().padStart(3, '0');
}
