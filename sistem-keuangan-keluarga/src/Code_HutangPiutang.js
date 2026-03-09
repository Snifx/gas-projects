// ══════════════════════════════════════════════════════════════════
//  Code_HutangPiutang.gs  —  Fitur Hutang & Piutang  v1.2
//  Snifx Financial App
// ══════════════════════════════════════════════════════════════════

/**
 * Ambil daftar Hutang & Piutang.
 * @param {string} [tipe] - 'HUTANG' | 'PIUTANG' | undefined (semua)
 */
function getHutangPiutangList(tipe) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.HUTANG_PIUTANG);
    if (!sheet) return { success: true, data: [] };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [] };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows    = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    const list = rows
      .filter(row => row[0]) // skip empty rows
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      })
      .filter(hp => !tipe || hp.tipe === tipe);

    // Attach reminders
    const reminders = _getHPReminders(list, 7);

    return {
      success: true,
      data: list,
      reminders: reminders
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Catat Hutang atau Piutang baru.
 * HUTANG: buat PENGELUARAN dengan kategori user + akun _NO_AKUN_ (budget terpotong, saldo tidak)
 * PIUTANG: buat PENGELUARAN dengan _PIUTANG_OUT_ + akun real (saldo terpotong, budget tidak)
 */
function addHutangPiutang(data) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = _ensureHutangPiutangSheet(ss);

    const tanggal   = new Date(data.tanggal);
    const idHP      = _generateHPId(tanggal);
    const tipe      = data.tipe; // 'HUTANG' | 'PIUTANG'
    const isHutang  = tipe === 'HUTANG';

    // ── Buat transaksi ────────────────────────────────────────────
    const trxData = {
      tanggal         : data.tanggal,
      tipe            : 'PENGELUARAN',
      id_kategori     : isHutang ? data.id_kategori : APP_CONFIG.CATEGORY.PIUTANG_OUT,
      nama_kategori   : isHutang ? (data.nama_kategori || data.id_kategori) : 'Piutang Keluar',
      id_akun         : isHutang ? APP_CONFIG.CATEGORY.NO_AKUN : data.id_akun,
      jumlah          : data.total_pinjaman,
      deskripsi       : (isHutang ? '[HUTANG] ' : '[PIUTANG] ') + data.deskripsi + ' — ' + data.nama_pihak,
      metode_bayar    : 'TRANSFER_BANK',
      anggota_keluarga: data.anggota_keluarga || 'Bersama',
      catatan         : data.keterangan || '',
      id_hp           : idHP
    };
    const trxResult = addTransaksi(trxData);
    if (!trxResult.success) return trxResult;

    // ── Simpan record HP ──────────────────────────────────────────
    const jatuhTempo = data.tanggal_jatuh_tempo ? new Date(data.tanggal_jatuh_tempo) : '';

    sheet.appendRow([
      idHP,
      tipe,
      data.nama_pihak,
      data.deskripsi,
      isHutang ? data.id_kategori    : APP_CONFIG.CATEGORY.PIUTANG_OUT,
      isHutang ? data.nama_kategori  : 'Piutang Keluar',
      isHutang ? APP_CONFIG.CATEGORY.NO_AKUN : data.id_akun,
      parseFloat(data.total_pinjaman),
      0, // total_terbayar
      tanggal,
      jatuhTempo,
      APP_CONFIG.STATUS.HP_AKTIF,
      data.keterangan || ''
    ]);

    return {
      success: true,
      message: `${tipe === 'HUTANG' ? 'Hutang' : 'Piutang'} berhasil dicatat. ID: ${idHP}`,
      id_hp: idHP
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Bayar cicilan hutang.
 * Buat PENGELUARAN dengan kategori _BAYAR_HUTANG_ (saldo terpotong, budget TIDAK terpotong).
 */
function bayarHutang(data) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.HUTANG_PIUTANG);
    if (!sheet) return { success: false, message: 'Sheet Hutang_Piutang tidak ditemukan.' };

    const hp = _findHPRecord(sheet, data.id_hp);
    if (!hp) return { success: false, message: 'Record HP tidak ditemukan: ' + data.id_hp };

    const jumlah = parseFloat(data.jumlah);

    // Buat transaksi pengeluaran (kategori _BAYAR_HUTANG_ → excluded from budget)
    const trxData = {
      tanggal         : data.tanggal,
      tipe            : 'PENGELUARAN',
      id_kategori     : APP_CONFIG.CATEGORY.BAYAR_HUTANG,
      nama_kategori   : 'Bayar Hutang',
      id_akun         : data.id_akun,
      jumlah          : jumlah,
      deskripsi       : '[BAYAR HUTANG] ' + hp.obj.nama_pihak + ' — ' + hp.obj.deskripsi,
      metode_bayar    : 'TRANSFER_BANK',
      anggota_keluarga: data.anggota_keluarga || 'Bersama',
      catatan         : '',
      id_hp           : data.id_hp
    };
    const trxResult = addTransaksi(trxData);
    if (!trxResult.success) return trxResult;

    // Update total_terbayar
    const newTerbayar = (parseFloat(hp.obj.total_terbayar) || 0) + jumlah;
    const colTerbayar = hp.headers.indexOf('total_terbayar') + 1;
    sheet.getRange(hp.row, colTerbayar).setValue(newTerbayar);

    // Auto-lunas jika sudah >= total
    const totalPinjaman = parseFloat(hp.obj.total_pinjaman) || 0;
    if (newTerbayar >= totalPinjaman) {
      const colStatus = hp.headers.indexOf('status') + 1;
      sheet.getRange(hp.row, colStatus).setValue(APP_CONFIG.STATUS.HP_LUNAS);
      return { success: true, message: `Pembayaran dicatat. Hutang ke ${hp.obj.nama_pihak} LUNAS! 🎉` };
    }

    const sisaStr = 'Rp ' + (totalPinjaman - newTerbayar).toLocaleString('id');
    return { success: true, message: `Pembayaran Rp ${jumlah.toLocaleString('id')} dicatat. Sisa hutang: ${sisaStr}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Terima kembali pembayaran piutang.
 * Buat PENDAPATAN dengan _PIUTANG_IN_ (saldo bertambah, muncul sebagai "Penerimaan Piutang").
 */
function terimaKembalianPiutang(data) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.HUTANG_PIUTANG);
    if (!sheet) return { success: false, message: 'Sheet Hutang_Piutang tidak ditemukan.' };

    const hp = _findHPRecord(sheet, data.id_hp);
    if (!hp) return { success: false, message: 'Record HP tidak ditemukan: ' + data.id_hp };

    const jumlah = parseFloat(data.jumlah);

    // Buat transaksi pendapatan
    const trxData = {
      tanggal         : data.tanggal,
      tipe            : 'PENDAPATAN',
      id_kategori     : APP_CONFIG.CATEGORY.PIUTANG_IN,
      nama_kategori   : 'Penerimaan Piutang',
      id_akun         : data.id_akun,
      jumlah          : jumlah,
      deskripsi       : '[TERIMA PIUTANG] ' + hp.obj.nama_pihak + ' — ' + hp.obj.deskripsi,
      metode_bayar    : 'TRANSFER_BANK',
      anggota_keluarga: data.anggota_keluarga || 'Bersama',
      catatan         : '',
      id_hp           : data.id_hp
    };
    const trxResult = addTransaksi(trxData);
    if (!trxResult.success) return trxResult;

    // Update total_terbayar
    const newTerbayar = (parseFloat(hp.obj.total_terbayar) || 0) + jumlah;
    const colTerbayar = hp.headers.indexOf('total_terbayar') + 1;
    sheet.getRange(hp.row, colTerbayar).setValue(newTerbayar);

    // Auto-lunas
    const totalPinjaman = parseFloat(hp.obj.total_pinjaman) || 0;
    if (newTerbayar >= totalPinjaman) {
      const colStatus = hp.headers.indexOf('status') + 1;
      sheet.getRange(hp.row, colStatus).setValue(APP_CONFIG.STATUS.HP_LUNAS);
      return { success: true, message: `Penerimaan dicatat. Piutang dari ${hp.obj.nama_pihak} LUNAS! 🎉` };
    }

    return { success: true, message: `Penerimaan Rp ${jumlah.toLocaleString('id')} dicatat.` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Tandai HP sebagai LUNAS secara manual.
 */
function lunasHP(idHP) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.HUTANG_PIUTANG);
    if (!sheet) return { success: false, message: 'Sheet tidak ditemukan.' };

    const hp = _findHPRecord(sheet, idHP);
    if (!hp) return { success: false, message: 'Record tidak ditemukan: ' + idHP };

    const colStatus = hp.headers.indexOf('status') + 1;
    sheet.getRange(hp.row, colStatus).setValue(APP_CONFIG.STATUS.HP_LUNAS);

    return { success: true, message: `${hp.obj.nama_pihak} ditandai LUNAS.` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ── Helper: Reminders ──────────────────────────────────────────────
function _getHPReminders(list, nHari) {
  const now      = new Date();
  now.setHours(0,0,0,0);
  const batas    = new Date(now);
  batas.setDate(batas.getDate() + nHari);

  return list
    .filter(hp => hp.status === 'AKTIF' && hp.tanggal_jatuh_tempo)
    .map(hp => {
      const jt      = new Date(hp.tanggal_jatuh_tempo);
      jt.setHours(0,0,0,0);
      const diffMs  = jt - now;
      const diffDay = Math.round(diffMs / (1000*60*60*24));
      return { ...hp, hari_lagi: Math.abs(diffDay), sudah_lewat: diffDay < 0, jt };
    })
    .filter(hp => hp.sudah_lewat || hp.jt <= batas)
    .sort((a,b) => a.jt - b.jt);
}

// ── Helper: Find HP record ─────────────────────────────────────────
function _findHPRecord(sheet, idHP) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows    = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const colId   = headers.indexOf('id_hp');

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][colId]) === String(idHP)) {
      const obj = {};
      headers.forEach((h, j) => { obj[h] = rows[i][j]; });
      return { row: i + 2, headers, obj };
    }
  }
  return null;
}

// ── Helper: Generate HP ID ─────────────────────────────────────────
function _generateHPId(dateObj) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(APP_CONFIG.SHEETS.HUTANG_PIUTANG);

  const yyyy  = dateObj.getFullYear();
  const mm    = String(dateObj.getMonth() + 1).padStart(2, '0');
  const prefix = `HP${yyyy}${mm}`;

  if (!sheet || sheet.getLastRow() < 2) return prefix + '001';

  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(r => String(r[0]))
    .filter(id => id.startsWith(prefix));

  if (ids.length === 0) return prefix + '001';

  const maxSeq = Math.max(...ids.map(id => parseInt(id.slice(-3), 10) || 0));
  return prefix + String(maxSeq + 1).padStart(3, '0');
}

// ── Helper: Ensure sheet exists ────────────────────────────────────
function _ensureHutangPiutangSheet(ss) {
  const name    = APP_CONFIG.SHEETS.HUTANG_PIUTANG;
  let sheet     = ss.getSheetByName(name);
  if (sheet) return sheet;

  sheet = ss.insertSheet(name);
  const headers = [
    'id_hp','tipe','nama_pihak','deskripsi',
    'id_kategori','nama_kategori','id_akun',
    'total_pinjaman','total_terbayar',
    'tanggal_mulai','tanggal_jatuh_tempo',
    'status','keterangan'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#076653').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  Logger.log('Created sheet: ' + name);
  return sheet;
}
