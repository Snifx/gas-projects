/**
 * MODUL: CICILAN ENGINE
 * Menangani pelacakan cicilan Kartu Kredit & Paylater.
 *
 * KONSEP "PAY FORWARD":
 *   1. Saat beli barang pakai CC/Paylater → transaksi PENGELUARAN penuh dicatat
 *      di bulan pembelian (budget langsung terpotong, user sadar beban penuh).
 *   2. Record cicilan dibuat di Cicilan_Tracking (tenor, cicilan/bulan, sisa tenor).
 *   3. Tiap bulan, ketika bayar tagihan → addTransfer(Bank → CC) saja
 *      (bukan pengeluaran baru, hanya perpindahan saldo — hindari double-count).
 *   4. Setiap pembayaran tagihan mengurangi sisa_tenor di Cicilan_Tracking.
 *   5. Saat sisa_tenor = 0 → status otomatis LUNAS.
 *
 * SCHEMA Cicilan_Tracking:
 *   id_cicilan        — CYYYYMMXXX  (contoh: C202606001)
 *   id_transaksi_awal — Referensi ke sheet Transaksi saat pembelian
 *   id_akun_kredit    — Akun CC/Paylater yang digunakan (contoh: A007)
 *   nama_barang       — Deskripsi barang/layanan
 *   total_harga       — Total harga setelah diskon
 *   tenor_bulan       — Total lama cicilan (misal: 3, 6, 12)
 *   cicilan_per_bulan — Nominal harus dibayar tiap bulan
 *   sisa_tenor        — Sisa bulan yang belum dibayar (auto berkurang)
 *   total_terbayar    — Akumulasi pembayaran yang sudah dilakukan
 *   tgl_jatuh_tempo   — Tanggal jatuh tempo tagihan (angka 1–31, dari Master_Akun)
 *   status            — AKTIF atau LUNAS
 *   keterangan        — Opsional
 */

// ══════════════════════════════════════════════════════════════
//  HELPER: VALIDASI ID CICILAN
// ══════════════════════════════════════════════════════════════

function _isValidCicilanId(id) {
  return id && /^C\d{7,}$/i.test(id.toString().trim());
}

/**
 * Auto-generate ID Cicilan: CYYYYMMXXX
 * Contoh: C202606001, C202606002
 * @param {Date} dateObj
 * @return {string}
 */
function _generateCicilanId(dateObj) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.CICILAN);
    const lastRow   = sheet.getLastRow();
    const seq       = Math.max(1, lastRow).toString().padStart(3, '0');
    const yyyy      = dateObj.getFullYear().toString();
    const mm        = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    return `C${yyyy}${mm}${seq}`;
  } catch (e) {
    return 'C' + Date.now().toString().slice(-9);
  }
}


// ══════════════════════════════════════════════════════════════
//  READ
// ══════════════════════════════════════════════════════════════

/**
 * Mengambil semua cicilan AKTIF.
 * Digunakan untuk: tab Cicilan, popup reminder, DSR calculation.
 *
 * @return {Object} { success, data: [...] }
 */
function getCicilanList() {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.CICILAN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.CICILAN);
    const data      = sheet.getDataRange().getValues();
    data.shift();

    const result = data
      .map(row => mapRowToObject(row, headerMap))
      .filter(obj => _isValidCicilanId(obj.id_cicilan))
      .map(obj => ({
        ...obj,
        total_harga       : parseFloat(obj.total_harga)        || 0,
        tenor_bulan       : parseInt(obj.tenor_bulan,    10)   || 0,
        cicilan_per_bulan : parseFloat(obj.cicilan_per_bulan)  || 0,
        sisa_tenor        : parseInt(obj.sisa_tenor,     10)   || 0,
        total_terbayar    : parseFloat(obj.total_terbayar)     || 0,
        tgl_jatuh_tempo   : parseInt(obj.tgl_jatuh_tempo, 10)  || 0
      }));

    return { success: true, data: result };

  } catch (e) {
    console.error('getCicilanList error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Mengambil cicilan AKTIF saja (status = AKTIF).
 * @return {Object} { success, data: [...] }
 */
function getCicilanAktif() {
  const all = getCicilanList();
  if (!all.success) return all;
  return {
    success: true,
    data   : all.data.filter(c => c.status === APP_CONFIG.STATUS.CICILAN_AKTIF)
  };
}

/**
 * Menghitung total beban cicilan per bulan dari semua cicilan aktif.
 * Digunakan untuk kalkulasi DSR di dashboard.
 * @return {number} Total cicilan per bulan
 */
function getTotalCicilanPerBulan() {
  const result = getCicilanAktif();
  if (!result.success) return 0;
  return result.data.reduce((sum, c) => sum + c.cicilan_per_bulan, 0);
}

/**
 * Menghitung proyeksi beban cicilan N bulan ke depan (Future Liability).
 * Menggabungkan semua cicilan aktif dan menghitung beban per bulan ke depan.
 *
 * @param  {number} nBulan - Berapa bulan ke depan yang ingin dilihat (default: 6)
 * @return {Object} { success, data: [{bulan, total_beban}, ...], max_bulan }
 */
function getFutureLiability(nBulan) {
  try {
    nBulan = nBulan || 6;
    const cicilanResult = getCicilanAktif();
    if (!cicilanResult.success) throw new Error(cicilanResult.message);

    const now    = new Date();
    const result = [];

    for (let i = 1; i <= nBulan; i++) {
      const futureDate  = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const bulanLabel  = bulanToDisplay(formatBulan(futureDate));
      let   totalBeban  = 0;

      cicilanResult.data.forEach(c => {
        // Cicilan ini masih aktif di bulan ke-i jika sisa tenor > (i-1)
        if (c.sisa_tenor >= i) {
          totalBeban += c.cicilan_per_bulan;
        }
      });

      result.push({
        bulan      : formatBulan(futureDate),
        bulan_label: bulanLabel,
        total_beban: totalBeban
      });
    }

    const maxBeban = Math.max(...result.map(r => r.total_beban), 0);

    return { success: true, data: result, max_beban: maxBeban };

  } catch (e) {
    console.error('getFutureLiability error:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * Mendapatkan cicilan yang jatuh tempo dalam N hari ke depan.
 * Digunakan untuk popup Bill Reminder di dashboard.
 *
 * Logika:
 *   - Ambil tgl_jatuh_tempo dari record cicilan
 *   - Jika hari ini <= jatuh tempo && jatuh tempo - hari ini <= nHari → tampilkan reminder
 *   - Handle wrap bulan (misal: hari ini tgl 28, jatuh tempo tgl 1 bulan depan)
 *
 * @param  {number} nHari - Jendela hari peringatan (default: 7)
 * @return {Object} { success, data: [{...cicilan, hari_lagi, sudah_lewat}] }
 */
function getBillReminders(nHari) {
  try {
    nHari = nHari || 7;
    const cicilanResult = getCicilanAktif();
    if (!cicilanResult.success) throw new Error(cicilanResult.message);

    // Ambil info akun kredit untuk nama akun di reminder
    const akunResult = getMasterAkun();
    const akunMap    = {};
    if (akunResult.success) {
      akunResult.data.forEach(a => { akunMap[a.id_akun] = a; });
    }

    const now       = new Date();
    const hariIni   = now.getDate();
    const bulanIni  = now.getMonth();
    const tahunIni  = now.getFullYear();
    const reminders = [];

    cicilanResult.data.forEach(c => {
      const tglJt = parseInt(c.tgl_jatuh_tempo, 10) || 0;
      if (tglJt === 0) return; // tidak ada jatuh tempo

      // Hitung hari lagi ke jatuh tempo (bulan ini atau bulan depan)
      let targetDate = new Date(tahunIni, bulanIni, tglJt);
      if (targetDate < now) {
        // Sudah lewat bulan ini → cek bulan depan
        targetDate = new Date(tahunIni, bulanIni + 1, tglJt);
      }

      const selisihMs   = targetDate - now;
      const hariLagi    = Math.ceil(selisihMs / (1000 * 60 * 60 * 24));
      const sudahLewat  = hariLagi < 0;

      if (hariLagi <= nHari || sudahLewat) {
        const akun = akunMap[c.id_akun_kredit] || {};
        reminders.push({
          ...c,
          nama_akun_kredit: akun.nama_akun || c.id_akun_kredit,
          hari_lagi       : hariLagi,
          sudah_lewat     : sudahLewat,
          tgl_display     : `${String(tglJt).padStart(2,'0')} ${bulanToDisplay(formatBulan(targetDate)).split(' ')[0]}`
        });
      }
    });

    // Urutkan: yang paling mendesak (hariLagi kecil) duluan
    reminders.sort((a, b) => a.hari_lagi - b.hari_lagi);

    return { success: true, data: reminders };

  } catch (e) {
    console.error('getBillReminders error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: TAMBAH CICILAN BARU
// ══════════════════════════════════════════════════════════════

/**
 * Membuat record cicilan baru di Cicilan_Tracking.
 * Dipanggil otomatis oleh addTransaksi() saat user memilih cicilan.
 *
 * @param  {Object} data {
 *   id_transaksi_awal : string  — ID transaksi pembelian awal
 *   id_akun_kredit    : string  — ID akun CC/Paylater
 *   nama_barang       : string  — Deskripsi barang
 *   total_harga       : number  — Harga total setelah diskon
 *   tenor_bulan       : number  — Lama cicilan (bulan)
 *   tanggal           : string  — Tanggal pembelian (YYYY-MM-DD)
 *   keterangan        : string  — Opsional
 * }
 * @return {Object} { success, id, message }
 */
function addCicilan(data) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.CICILAN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.CICILAN);

    // Validasi
    if (!data.id_akun_kredit)  throw new Error('id_akun_kredit wajib diisi.');
    if (!data.nama_barang)     throw new Error('nama_barang wajib diisi.');
    const totalHarga = parseFloat(data.total_harga) || 0;
    if (totalHarga <= 0)       throw new Error('total_harga harus lebih dari 0.');
    const tenor = parseInt(data.tenor_bulan, 10) || 0;
    if (tenor <= 0)            throw new Error('tenor_bulan harus lebih dari 0.');

    // Ambil tgl_jatuh_tempo dari Master_Akun
    let tglJt = 0;
    try {
      const akunResult = getMasterAkun();
      if (akunResult.success) {
        const akun = akunResult.data.find(a => a.id_akun === data.id_akun_kredit);
        tglJt = parseInt(akun?.tgl_jatuh_tempo, 10) || 0;
      }
    } catch (_) { /* non-critical, default 0 */ }

    const dateObj         = data.tanggal ? new Date(data.tanggal) : new Date();
    const cicilanPerBulan = parseFloat((totalHarga / tenor).toFixed(0));
    const newId           = _generateCicilanId(dateObj);

    const newCicilan = {
      id_cicilan        : newId,
      id_transaksi_awal : data.id_transaksi_awal || '',
      id_akun_kredit    : data.id_akun_kredit,
      nama_barang       : data.nama_barang.trim(),
      total_harga       : totalHarga,
      tenor_bulan       : tenor,
      cicilan_per_bulan : cicilanPerBulan,
      sisa_tenor        : tenor,          // mulai penuh, berkurang setiap bayar
      total_terbayar    : 0,
      tgl_jatuh_tempo   : tglJt,
      status            : APP_CONFIG.STATUS.CICILAN_AKTIF,
      keterangan        : (data.keterangan || '').trim()
    };

    const rowData = mapObjectToRow(newCicilan, headerMap);
    sheet.appendRow(rowData);

    console.log(`addCicilan: ${newId} — ${data.nama_barang} — ${tenor}x${cicilanPerBulan}`);
    return {
      success: true,
      id     : newId,
      cicilan_per_bulan: cicilanPerBulan,
      message: `Cicilan "${data.nama_barang}" ${tenor} bulan × ${formatRupiah_(cicilanPerBulan)} berhasil dibuat (${newId}).`
    };

  } catch (e) {
    console.error('addCicilan error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: BAYAR TAGIHAN CC/PAYLATER
// ══════════════════════════════════════════════════════════════

/**
 * Membayar tagihan Kartu Kredit / Paylater.
 *
 * ALUR:
 *   1. Validasi cicilan aktif & cukup saldo akun bank asal
 *   2. Panggil addTransfer(bank_asal → akun_kredit, cicilan_per_bulan)
 *      → Ini BUKAN pengeluaran, hanya perpindahan saldo internal
 *      → Saldo bank berkurang, utang CC berkurang
 *   3. Update Cicilan_Tracking: sisa_tenor -1, total_terbayar + cicilan_per_bulan
 *   4. Jika sisa_tenor menjadi 0 → status = LUNAS
 *
 * @param {Object} data {
 *   id_cicilan   : string — ID cicilan yang akan dibayar
 *   id_akun_bank : string — Akun bank/kas sumber pembayaran
 *   tanggal      : string — Tanggal bayar (YYYY-MM-DD)
 *   anggota_keluarga: string — Opsional
 * }
 * @return {Object} { success, message, status_cicilan }
 */
function bayarTagihanCC(data) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.CICILAN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.CICILAN);
    const fullData  = sheet.getDataRange().getValues();
    const idIdx     = headerMap['id_cicilan'];

    if (!data.id_cicilan)   throw new Error('id_cicilan wajib diisi.');
    if (!data.id_akun_bank) throw new Error('Akun bank sumber pembayaran wajib dipilih.');

    // Cari record cicilan
    let rowIndex  = -1;
    let cicilanObj = null;
    for (let i = 1; i < fullData.length; i++) {
      if (fullData[i][idIdx] === data.id_cicilan) {
        cicilanObj = mapRowToObject(fullData[i], headerMap);
        rowIndex   = i;
        break;
      }
    }
    if (!cicilanObj)                                       throw new Error(`Cicilan "${data.id_cicilan}" tidak ditemukan.`);
    if (cicilanObj.status === APP_CONFIG.STATUS.CICILAN_LUNAS) throw new Error(`Cicilan "${cicilanObj.nama_barang}" sudah LUNAS.`);
    if ((parseInt(cicilanObj.sisa_tenor, 10) || 0) <= 0)  throw new Error('Sisa tenor sudah 0, tidak perlu bayar.');

    const cicilanPerBulan = parseFloat(cicilanObj.cicilan_per_bulan) || 0;

    // Ambil nama akun kredit untuk deskripsi transfer
    const akunResult       = getMasterAkun();
    const akunKreditObj    = akunResult.success ? akunResult.data.find(a => a.id_akun === cicilanObj.id_akun_kredit) : null;
    const akunBankObj      = akunResult.success ? akunResult.data.find(a => a.id_akun === data.id_akun_bank) : null;
    const namaAkunKredit   = akunKreditObj?.nama_akun || cicilanObj.id_akun_kredit;
    const namaAkunBank     = akunBankObj?.nama_akun   || data.id_akun_bank;

    // Step 1: Transfer Bank → CC (bukan pengeluaran, hanya perpindahan saldo)
    const trfResult = addTransfer({
      tanggal          : data.tanggal,
      id_akun_asal     : data.id_akun_bank,
      nama_akun_asal   : namaAkunBank,
      id_akun_tujuan   : cicilanObj.id_akun_kredit,
      nama_akun_tujuan : namaAkunKredit,
      jumlah           : cicilanPerBulan,
      anggota_keluarga : data.anggota_keluarga || '',
      catatan          : `Bayar tagihan ${namaAkunKredit} — ${cicilanObj.nama_barang} | ${data.id_cicilan}`
    });
    if (!trfResult.success) throw new Error('Gagal catat transfer: ' + trfResult.message);

    // Step 2: Update Cicilan_Tracking
    const sisaTenorBaru    = Math.max(0, (parseInt(cicilanObj.sisa_tenor, 10) || 0) - 1);
    const totalTerbayarBaru= (parseFloat(cicilanObj.total_terbayar) || 0) + cicilanPerBulan;
    const statusBaru       = sisaTenorBaru === 0 ? APP_CONFIG.STATUS.CICILAN_LUNAS : APP_CONFIG.STATUS.CICILAN_AKTIF;

    fullData[rowIndex][headerMap['sisa_tenor']]     = sisaTenorBaru;
    fullData[rowIndex][headerMap['total_terbayar']] = totalTerbayarBaru;
    fullData[rowIndex][headerMap['status']]         = statusBaru;

    sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);

    const msg = statusBaru === APP_CONFIG.STATUS.CICILAN_LUNAS
      ? `✅ Cicilan "${cicilanObj.nama_barang}" LUNAS! Pembayaran terakhir ${formatRupiah_(cicilanPerBulan)} dari ${namaAkunBank}.`
      : `✅ Tagihan ${namaAkunKredit} ${formatRupiah_(cicilanPerBulan)} dari ${namaAkunBank} terbayar. Sisa tenor: ${sisaTenorBaru} bulan.`;

    return {
      success        : true,
      message        : msg,
      status_cicilan : statusBaru,
      sisa_tenor     : sisaTenorBaru,
      total_terbayar : totalTerbayarBaru
    };

  } catch (e) {
    console.error('bayarTagihanCC error:', e.message);
    return { success: false, message: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  WRITE: LUNAS MANUAL
// ══════════════════════════════════════════════════════════════

/**
 * Menandai cicilan sebagai LUNAS secara manual (pelunasan dipercepat).
 * Tidak membuat transaksi transfer — hanya mengubah status.
 * @param {string} idCicilan
 * @return {Object} { success, message }
 */
function lunasCicilan(idCicilan) {
  try {
    const sheet     = getSheet(APP_CONFIG.SHEETS.CICILAN);
    const headerMap = getHeaderMap(APP_CONFIG.SHEETS.CICILAN);
    const fullData  = sheet.getDataRange().getValues();
    const idIdx     = headerMap['id_cicilan'];

    let found = false;
    let nama  = '';
    for (let i = 1; i < fullData.length; i++) {
      if (fullData[i][idIdx] === idCicilan) {
        nama = fullData[i][headerMap['nama_barang']] || idCicilan;
        fullData[i][headerMap['status']]     = APP_CONFIG.STATUS.CICILAN_LUNAS;
        fullData[i][headerMap['sisa_tenor']] = 0;
        found = true;
        break;
      }
    }
    if (!found) throw new Error(`Cicilan "${idCicilan}" tidak ditemukan.`);

    sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);
    return { success: true, message: `Cicilan "${nama}" ditandai LUNAS.` };

  } catch (e) {
    console.error('lunasCicilan error:', e.message);
    return { success: false, message: e.message };
  }
}
