/**
 * MODUL: BUDGET ENGINE
 * v2.0 (NEW): Manajemen Budget Bulanan dengan metode 50/30/20.
 *
 * Sheet:
 *   Budget_Bulanan  → kolom: bulan, id_kategori, nama_kategori, pos, budget, keterangan
 *   Budget_Template → kolom: id_kategori, nama_kategori, pos, budget, keterangan, tahun
 *
 * Fungsi yang tersedia:
 *   getBudgetByMonth(bulan)             - Ambil item budget bulan tertentu
 *   getBudgetTemplate()                 - Ambil semua item template
 *   addBudgetItem(data)                 - Tambah item budget ke bulan tertentu
 *   updateBudgetItem(bulan, idKat, upd) - Update nominal budget
 *   deleteBudgetItem(bulan, idKat)      - Hapus item budget dari bulan tertentu
 *   copyBudgetFromTemplate(bulan)       - Salin template ke bulan baru
 *   getAvailableBudgetMonths()          - Daftar bulan yang ada di Budget_Bulanan
 */

// ══════════════════════════════════════════════════════════════
//  READ
// ══════════════════════════════════════════════════════════════

/**
 * Mengambil semua item budget untuk bulan tertentu.
 * @param  {string} bulan - Format "YYYY-MM"
 * @return {Object} { success, data: [...] }
 */
function getBudgetByMonth(bulan) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.BUDGET);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.BUDGET);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    const result = data
      .map(row => mapRowToObject(row, headerMap))
      .filter(obj => {
        const b = (obj.bulan || '').toString().trim().substring(0, 7);
        return b === bulan && obj.id_kategori;
      })
      .map(obj => ({
        ...obj,
        budget: parseFloat(obj.budget) || 0
      }))
      .sort((a, b) => {
        // Sort by pos grouping: KEBUTUHAN → KEINGINAN → TABUNGAN → INVESTASI → lainnya
        const order = ['KEBUTUHAN','KEINGINAN','TABUNGAN','INVESTASI'];
        const ai    = order.indexOf((a.pos || '').toUpperCase());
        const bi    = order.indexOf((b.pos || '').toUpperCase());
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

    return { success: true, data: result };

  } catch (e) {
    console.error('getBudgetByMonth error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Mengambil semua item dari Budget_Template.
 * @return {Object} { success, data: [...] }
 */
function getBudgetTemplate() {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.BUDGET_TEMPLATE);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.BUDGET_TEMPLATE);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    const result = data
      .map(row => mapRowToObject(row, headerMap))
      .filter(obj => obj.id_kategori)
      .map(obj => ({
        ...obj,
        budget: parseFloat(obj.budget) || 0
      }));

    return { success: true, data: result };

  } catch (e) {
    console.error('getBudgetTemplate error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Mendapatkan daftar bulan yang ada di Budget_Bulanan.
 * @return {Object} { success, data: [{iso, display}, ...] }
 */
function getAvailableBudgetMonths() {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.BUDGET);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.BUDGET);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    const bulanSet = new Set();
    // Tambahkan bulan saat ini
    bulanSet.add(getCurrentBulanISO());

    data.forEach(row => {
      const obj = mapRowToObject(row, headerMap);
      const b   = (obj.bulan || '').toString().trim().substring(0, 7);
      if (/^\d{4}-\d{2}$/.test(b)) bulanSet.add(b);
    });

    const sorted = Array.from(bulanSet).sort().reverse();
    return {
      success: true,
      data   : sorted.map(iso => ({ iso, display: bulanToDisplay(iso) }))
    };

  } catch (e) {
    console.error('getAvailableBudgetMonths error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: TAMBAH ITEM BUDGET
// ══════════════════════════════════════════════════════════════

/**
 * Menambah satu item budget ke bulan tertentu.
 * @param  {Object} data - { bulan, id_kategori, nama_kategori, pos, budget, keterangan }
 * @return {Object} { success, message }
 */
function addBudgetItem(data) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.BUDGET);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.BUDGET);

    if (!data.bulan)        throw new Error('Bulan wajib diisi.');
    if (!data.id_kategori)  throw new Error('Kategori wajib dipilih.');
    if ((parseFloat(data.budget) || 0) < 0) throw new Error('Budget tidak boleh negatif.');

    // Cek duplikat — satu kategori hanya boleh satu kali per bulan
    const existing = getBudgetByMonth(data.bulan);
    if (existing.success) {
      const dup = existing.data.find(b => b.id_kategori === data.id_kategori);
      if (dup) throw new Error(`Kategori "${data.id_kategori}" sudah ada di budget bulan ${bulanToDisplay(data.bulan)}.`);
    }

    const newItem = {
      bulan        : data.bulan,
      id_kategori  : data.id_kategori,
      nama_kategori: data.nama_kategori || '',
      pos          : data.pos           || '',
      budget       : parseFloat(data.budget) || 0,
      keterangan   : data.keterangan    || ''
    };

    const rowData = mapObjectToRow(newItem, headerMap);
    sheet.appendRow(rowData);

    return { success: true, message: `Budget untuk "${data.nama_kategori || data.id_kategori}" berhasil ditambahkan.` };

  } catch (e) {
    console.error('addBudgetItem error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Update item budget (nominal dan keterangan).
 * @param  {string} bulan       - Format "YYYY-MM"
 * @param  {string} idKategori  - ID kategori
 * @param  {Object} updatedData - { budget, keterangan }
 * @return {Object} { success, message }
 */
function updateBudgetItem(bulan, idKategori, updatedData) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.BUDGET);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.BUDGET);
    const fullData  = sheet.getDataRange().getValues();

    const bulanIdx  = headerMap['bulan'];
    const katIdx    = headerMap['id_kategori'];
    const budgetIdx = headerMap['budget'];
    const ketIdx    = headerMap['keterangan'];

    if (bulanIdx === undefined || katIdx === undefined) throw new Error('Header sheet Budget_Bulanan tidak lengkap.');

    let found = false;
    for (let i = 1; i < fullData.length; i++) {
      const rowBulan = (fullData[i][bulanIdx] || '').toString().substring(0, 7);
      const rowKat   = (fullData[i][katIdx]   || '').toString();
      if (rowBulan === bulan && rowKat === idKategori) {
        if (updatedData.budget !== undefined && budgetIdx !== undefined) {
          fullData[i][budgetIdx] = parseFloat(updatedData.budget) || 0;
        }
        if (updatedData.keterangan !== undefined && ketIdx !== undefined) {
          fullData[i][ketIdx] = updatedData.keterangan;
        }
        found = true;
        break;
      }
    }

    if (!found) throw new Error(`Item budget "${idKategori}" untuk bulan ${bulanToDisplay(bulan)} tidak ditemukan.`);

    sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);
    return { success: true, message: 'Budget berhasil diperbarui.' };

  } catch (e) {
    console.error('updateBudgetItem error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Hapus satu item budget dari bulan tertentu.
 * @param  {string} bulan      - Format "YYYY-MM"
 * @param  {string} idKategori - ID kategori
 * @return {Object} { success, message }
 */
function deleteBudgetItem(bulan, idKategori) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.BUDGET);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.BUDGET);
    const data      = sheet.getDataRange().getValues();

    const bulanIdx = headerMap['bulan'];
    const katIdx   = headerMap['id_kategori'];

    if (bulanIdx === undefined || katIdx === undefined) throw new Error('Header sheet Budget_Bulanan tidak lengkap.');

    let rowToDelete = -1;
    for (let i = 1; i < data.length; i++) {
      const rowBulan = (data[i][bulanIdx] || '').toString().substring(0, 7);
      const rowKat   = (data[i][katIdx]   || '').toString();
      if (rowBulan === bulan && rowKat === idKategori) {
        rowToDelete = i + 1;
        break;
      }
    }

    if (rowToDelete === -1) throw new Error(`Item budget tidak ditemukan.`);

    sheet.deleteRow(rowToDelete);
    return { success: true, message: 'Item budget berhasil dihapus.' };

  } catch (e) {
    console.error('deleteBudgetItem error:', e.message);
    return { success: false, message: e.message };
  }
}

// ══════════════════════════════════════════════════════════════
//  WRITE: MANAJEMEN TEMPLATE
// ══════════════════════════════════════════════════════════════

/**
 * Menambah item baru ke Budget_Template.
 * @param  {Object} data - { id_kategori, nama_kategori, pos, budget, keterangan, tahun }
 * @return {Object} { success, message }
 */
function addBudgetTemplateItem(data) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.BUDGET_TEMPLATE);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.BUDGET_TEMPLATE);

    if (!data.id_kategori) throw new Error('Kategori wajib dipilih.');
    if ((parseFloat(data.budget) || 0) < 0) throw new Error('Budget tidak boleh negatif.');

    // Cek duplikat per tahun
    const existing = getBudgetTemplate();
    if (existing.success) {
      const dup = existing.data.find(t =>
        t.id_kategori === data.id_kategori &&
        (t.tahun || '').toString() === (data.tahun || '').toString()
      );
      if (dup) throw new Error(`Kategori "${data.id_kategori}" sudah ada di template tahun ${data.tahun || '-'}.`);
    }

    const newItem = {
      id_kategori  : data.id_kategori,
      nama_kategori: data.nama_kategori || '',
      pos          : data.pos           || '',
      budget       : parseFloat(data.budget) || 0,
      keterangan   : data.keterangan    || '',
      tahun        : data.tahun         || ''
    };

    const rowData = mapObjectToRow(newItem, headerMap);
    sheet.appendRow(rowData);

    invalidateCache(`header_map_${APP_CONFIG.SHEETS.BUDGET_TEMPLATE}`);
    return { success: true, message: `Item "${data.nama_kategori || data.id_kategori}" berhasil ditambahkan ke template.` };

  } catch (e) {
    console.error('addBudgetTemplateItem error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Update item di Budget_Template.
 * @param  {string} idKategori  - ID kategori
 * @param  {string} tahun       - Tahun item (untuk identifikasi unik jika ada duplikat antar tahun)
 * @param  {Object} updatedData - { budget, keterangan, tahun }
 * @return {Object} { success, message }
 */
function updateBudgetTemplateItem(idKategori, tahun, updatedData) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.BUDGET_TEMPLATE);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.BUDGET_TEMPLATE);
    const fullData  = sheet.getDataRange().getValues();

    const katIdx    = headerMap['id_kategori'];
    const tahunIdx  = headerMap['tahun'];
    const budgetIdx = headerMap['budget'];
    const ketIdx    = headerMap['keterangan'];

    if (katIdx === undefined) throw new Error('Header sheet Budget_Template tidak lengkap.');

    let found = false;
    for (let i = 1; i < fullData.length; i++) {
      const rowKat   = (fullData[i][katIdx]   || '').toString();
      const rowTahun = tahunIdx !== undefined ? (fullData[i][tahunIdx] || '').toString() : '';
      const matchTahun = tahunIdx === undefined || rowTahun === (tahun || '').toString();

      if (rowKat === idKategori && matchTahun) {
        if (updatedData.budget !== undefined && budgetIdx !== undefined) {
          fullData[i][budgetIdx] = parseFloat(updatedData.budget) || 0;
        }
        if (updatedData.keterangan !== undefined && ketIdx !== undefined) {
          fullData[i][ketIdx] = updatedData.keterangan;
        }
        if (updatedData.tahun !== undefined && tahunIdx !== undefined) {
          fullData[i][tahunIdx] = updatedData.tahun;
        }
        found = true;
        break;
      }
    }

    if (!found) throw new Error(`Item template "${idKategori}" tidak ditemukan.`);

    sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);
    return { success: true, message: 'Item template berhasil diperbarui.' };

  } catch (e) {
    console.error('updateBudgetTemplateItem error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Hapus item dari Budget_Template (hapus permanen).
 * @param  {string} idKategori - ID kategori
 * @param  {string} tahun      - Tahun item
 * @return {Object} { success, message }
 */
function deleteBudgetTemplateItem(idKategori, tahun) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.BUDGET_TEMPLATE);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.BUDGET_TEMPLATE);
    const data      = sheet.getDataRange().getValues();

    const katIdx   = headerMap['id_kategori'];
    const tahunIdx = headerMap['tahun'];

    if (katIdx === undefined) throw new Error('Header sheet Budget_Template tidak lengkap.');

    let rowToDelete = -1;
    for (let i = 1; i < data.length; i++) {
      const rowKat   = (data[i][katIdx]   || '').toString();
      const rowTahun = tahunIdx !== undefined ? (data[i][tahunIdx] || '').toString() : '';
      const matchTahun = tahunIdx === undefined || rowTahun === (tahun || '').toString();

      if (rowKat === idKategori && matchTahun) {
        rowToDelete = i + 1;
        break;
      }
    }

    if (rowToDelete === -1) throw new Error('Item template tidak ditemukan.');

    sheet.deleteRow(rowToDelete);
    return { success: true, message: 'Item template berhasil dihapus.' };

  } catch (e) {
    console.error('deleteBudgetTemplateItem error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Menyalin semua item dari Budget_Template ke bulan tertentu di Budget_Bulanan.
 * Jika bulan sudah ada item, fungsi ini MENAMBAHKAN item template yang belum ada
 * (tidak menimpa item yang sudah ada).
 *
 * @param  {string} bulan - Format "YYYY-MM"
 * @return {Object} { success, message, added, skipped }
 */
function copyBudgetFromTemplate(bulan) {
  try {
    if (!bulan || !/^\d{4}-\d{2}$/.test(bulan)) throw new Error('Format bulan tidak valid. Gunakan YYYY-MM.');

    const templateResult = getBudgetTemplate();
    if (!templateResult.success) throw new Error('Gagal membaca template: ' + templateResult.message);
    if (templateResult.data.length === 0) throw new Error('Budget_Template kosong. Isi template terlebih dahulu.');

    const existingResult = getBudgetByMonth(bulan);
    const existingIds    = existingResult.success
      ? new Set(existingResult.data.map(b => b.id_kategori))
      : new Set();

    const sheetBudget = getSheet(APP_CONFIG.SHEETS.BUDGET);
    const headerMap   = getHeaderMap(APP_CONFIG.SHEETS.BUDGET);

    let added   = 0;
    let skipped = 0;

    templateResult.data.forEach(item => {
      if (existingIds.has(item.id_kategori)) {
        skipped++;
        return;
      }
      const newItem = {
        bulan        : bulan,
        id_kategori  : item.id_kategori,
        nama_kategori: item.nama_kategori || '',
        pos          : item.pos           || '',
        budget       : parseFloat(item.budget) || 0,
        keterangan   : item.keterangan    || ''
      };
      sheetBudget.appendRow(mapObjectToRow(newItem, headerMap));
      added++;
    });

    const msg = `✅ ${added} item berhasil disalin dari template ke ${bulanToDisplay(bulan)}.` +
                (skipped > 0 ? ` (${skipped} item dilewati karena sudah ada.)` : '');

    return { success: true, message: msg, added, skipped };

  } catch (e) {
    console.error('copyBudgetFromTemplate error:', e.message);
    return { success: false, message: e.message };
  }
}
